/**
 * 우리 사이 — POST /api/auth/toss (Vercel Serverless Function)
 * ─────────────────────────────────────────────────────
 * 흐름:
 *   1) 클라이언트가 appLogin()으로 받은 { authorizationCode, referrer }를 POST
 *   2) mTLS로 토스 /generate-token 호출 → userKey 추출
 *   3) Firebase Admin SDK로 Custom Token 발급
 *   4) 클라이언트에 { firebaseToken, userKey } 반환
 *
 * 클라이언트 사용 예 (UserContext.tsx):
 *   const r = await fetch(process.env.NEXT_PUBLIC_TOSS_AUTH_FN_URL, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ authorizationCode, referrer }),
 *   });
 *
 * Vercel 함수 URL 형식: https://<project-name>-<hash>.vercel.app/api/auth/toss
 *                       또는 커스텀 도메인 사용 시 https://your-domain/api/auth/toss
 *
 * Apps-in-Toss 웹뷰는 별도 origin이라 CORS 허용 필수.
 * ─────────────────────────────────────────────────────
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { exchangeAuthorizationCode, type Referrer } from '../../lib/appintoss-client';
import { getAdminAuth } from '../../lib/firebase-admin';

// ── JWT payload 디코드 (서명 검증 X — mTLS로 받은 토스 토큰이라 신뢰) ──
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // URL-safe base64 → 표준 base64 + 패딩 보정
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    const payload = JSON.parse(json);
    return typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

// ── userKey 추출 헬퍼 (응답 shape 변동 흡수) ──
//  토스 /generate-token 응답은 OAuth2 표준 → userKey 필드 없음.
//  accessToken JWT의 `sub` claim이 사용자 영구 식별자(앱별 안정).
function extractUserKey(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  // 1) (구·호환) 직접 userKey 필드 — 응답이 바뀌어도 깨지지 않게 유지
  const success = b.success as Record<string, unknown> | undefined;
  if (success && typeof success === 'object' && success.userKey != null) {
    return String(success.userKey);
  }
  const data = b.data as Record<string, unknown> | undefined;
  if (data && typeof data === 'object' && data.userKey != null) {
    return String(data.userKey);
  }
  if (b.userKey != null) return String(b.userKey);

  // 2) (현행) accessToken JWT의 sub claim
  const tokenCandidates: unknown[] = [];
  if (success && typeof success === 'object') tokenCandidates.push(success.accessToken);
  if (data && typeof data === 'object') tokenCandidates.push(data.accessToken);
  tokenCandidates.push(b.accessToken);

  for (const t of tokenCandidates) {
    if (typeof t !== 'string' || t.length === 0) continue;
    const payload = decodeJwtPayload(t);
    if (payload && typeof payload.sub === 'string' && payload.sub.length > 0) {
      return payload.sub;
    }
  }
  return null;
}

// ── CORS (Apps-in-Toss 웹뷰 origin 미정 → 와일드카드) ──
function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age',       '3600');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  // ── 0. 본문 파싱 (Vercel은 Content-Type: application/json이면 자동 파싱) ──
  const body = req.body as { authorizationCode?: unknown; referrer?: unknown } | undefined;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  const authorizationCode = typeof body.authorizationCode === 'string' ? body.authorizationCode : '';
  const referrer = body.referrer as Referrer;

  if (!authorizationCode) {
    res.status(400).json({ error: 'missing_authorization_code' });
    return;
  }
  if (referrer !== 'DEFAULT' && referrer !== 'SANDBOX') {
    res.status(400).json({ error: 'invalid_referrer' });
    return;
  }

  // ── 1. 토스 mTLS 토큰 교환 ──
  let tossRes;
  try {
    tossRes = await exchangeAuthorizationCode({ authorizationCode, referrer });
  } catch (e) {
    console.error('[/api/auth/toss] mTLS 호출 실패:', e);
    res.status(502).json({ error: 'toss_request_failed', message: (e as Error).message });
    return;
  }

  if (tossRes.statusCode < 200 || tossRes.statusCode >= 300) {
    console.error('[/api/auth/toss] 토스 응답 비정상', { status: tossRes.statusCode, raw: tossRes.raw });
    res.status(502).json({ error: 'toss_response_error', status: tossRes.statusCode, body: tossRes.body });
    return;
  }

  // ── 2. userKey 추출 ──
  const userKey = extractUserKey(tossRes.body);
  if (!userKey) {
    console.error('[/api/auth/toss] userKey 없음. 실제 응답:', tossRes.body);
    res.status(502).json({ error: 'user_key_not_found', received: tossRes.body });
    return;
  }

  // ── 3. Firebase Custom Token ──
  let firebaseToken: string;
  try {
    firebaseToken = await getAdminAuth().createCustomToken(userKey, {
      provider: 'apps-in-toss',
      referrer,
    });
  } catch (e) {
    console.error('[/api/auth/toss] Custom Token 발급 실패:', e);
    res.status(500).json({ error: 'firebase_custom_token_failed', message: (e as Error).message });
    return;
  }

  // ── 4. 응답 ──
  res.status(200).json({ firebaseToken, userKey, referrer });
}
