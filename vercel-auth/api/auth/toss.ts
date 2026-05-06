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

// ── userKey 추출 헬퍼 (응답 shape 변동 흡수) ──
function extractUserKey(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  const success = b.success as Record<string, unknown> | undefined;
  if (success && typeof success === 'object' && success.userKey != null) {
    return String(success.userKey);
  }
  const data = b.data as Record<string, unknown> | undefined;
  if (data && typeof data === 'object' && data.userKey != null) {
    return String(data.userKey);
  }
  if (b.userKey != null) return String(b.userKey);
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
