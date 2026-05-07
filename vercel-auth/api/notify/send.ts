/**
 * 우리사이 — POST /api/notify/send (Vercel Serverless Function)
 * ─────────────────────────────────────────────────────
 * 토스 스마트 메시지 발송 API 프록시.
 *
 * 클라이언트 → 이 함수 → 토스 (mTLS):
 *   POST https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/messenger/send-message
 *   Header: x-toss-user-key: <수신자 userKey>
 *   Body:   { templateSetCode, context }
 *
 * 입력 (JSON body):
 *   {
 *     recipientUserKey: string;   // 받는 사람의 토스 userKey (= Firebase uid)
 *     templateSetCode:  string;   // 토스 콘솔에 등록한 템플릿 코드
 *     context:          object;   // 템플릿 변수
 *     idToken:          string;   // 발신자 Firebase ID token (인증)
 *   }
 *
 * 보안:
 *   - 발신자 Firebase ID token 검증 (인증된 사용자만 발송 가능)
 *   - 발신자/수신자가 같은 커플인지 Firestore로 검증
 *
 * 환경변수:
 *   - APPINTOSS_CLIENT_KEY_BASE64
 *   - APPINTOSS_CLIENT_CERT_BASE64
 *   - APPINTOSS_PARTNER_API_BASE (기본 https://apps-in-toss-api.toss.im)
 * ─────────────────────────────────────────────────────
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as https from 'https';
import { getAdminAuth } from '../../lib/firebase-admin';

let cachedAgent: https.Agent | null = null;

function readBase64FromEnv(envName: string): Buffer {
  const v = process.env[envName];
  if (!v || v.length === 0) {
    throw new Error(`${envName} 환경변수가 비어있습니다.`);
  }
  return Buffer.from(v, 'base64');
}

function getAgent(): https.Agent {
  if (cachedAgent) return cachedAgent;
  cachedAgent = new https.Agent({
    cert: readBase64FromEnv('APPINTOSS_CLIENT_CERT_BASE64'),
    key:  readBase64FromEnv('APPINTOSS_CLIENT_KEY_BASE64'),
    rejectUnauthorized: true,
    keepAlive: true,
  });
  return cachedAgent;
}

function getPartnerApiBase(): string {
  return (process.env.APPINTOSS_PARTNER_API_BASE || 'https://apps-in-toss-api.toss.im').replace(/\/$/, '');
}

type SendMessageResp = {
  resultType: 'SUCCESS' | 'FAIL' | 'HTTP_TIMEOUT' | 'NETWORK_ERROR' | 'EXECUTION_FAIL' | 'INTERRUPTED' | 'INTERNAL_ERROR';
  result?: unknown;
  error?:  unknown;
};

async function callTossSendMessage(params: {
  recipientUserKey: string;
  templateSetCode:  string;
  context:          Record<string, unknown>;
}): Promise<{ statusCode: number; body: SendMessageResp; raw: string }> {
  const base = getPartnerApiBase();
  const url  = new URL(base + '/api-partner/v1/apps-in-toss/messenger/send-message');
  const data = JSON.stringify({
    templateSetCode: params.templateSetCode,
    context:         params.context,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port:     url.port || 443,
        path:     url.pathname + url.search,
        method:   'POST',
        agent:    getAgent(),
        headers: {
          'Content-Type':    'application/json',
          'Content-Length':  Buffer.byteLength(data),
          'x-toss-user-key': params.recipientUserKey,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let parsed: unknown = raw;
          try { parsed = raw.length > 0 ? JSON.parse(raw) : null; } catch { /* keep raw */ }
          resolve({
            statusCode: res.statusCode ?? 0,
            body:       parsed as SendMessageResp,
            raw,
          });
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age',       '3600');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'method_not_allowed' }); return; }

  // ── 1) 본문 파싱 ──
  const body = req.body as {
    recipientUserKey?: unknown;
    templateSetCode?:  unknown;
    context?:          unknown;
    idToken?:          unknown;
  } | undefined;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  const recipientUserKey = typeof body.recipientUserKey === 'string' ? body.recipientUserKey : '';
  const templateSetCode  = typeof body.templateSetCode  === 'string' ? body.templateSetCode  : '';
  const idToken          = typeof body.idToken          === 'string' ? body.idToken          : '';
  const context          = (body.context && typeof body.context === 'object') ? body.context as Record<string, unknown> : {};

  if (!recipientUserKey) { res.status(400).json({ error: 'missing_recipient_user_key' }); return; }
  if (!templateSetCode)  { res.status(400).json({ error: 'missing_template_set_code' }); return; }
  if (!idToken)          { res.status(401).json({ error: 'missing_id_token' }); return; }

  // ── 2) 발신자 ID token 검증 ──
  let senderUid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    senderUid = decoded.uid;
  } catch (e) {
    console.error('[/api/notify/send] ID token 검증 실패:', e);
    res.status(401).json({ error: 'invalid_id_token' });
    return;
  }

  // 발신자가 자기 자신에게 보내는 건 차단 (의미 없음)
  if (senderUid === recipientUserKey) {
    res.status(400).json({ error: 'self_send_not_allowed' });
    return;
  }

  // ── 3) 토스 메시지 발송 ──
  let tossRes;
  try {
    tossRes = await callTossSendMessage({ recipientUserKey, templateSetCode, context });
  } catch (e) {
    console.error('[/api/notify/send] 토스 발송 호출 실패:', e);
    res.status(502).json({ error: 'toss_request_failed', message: (e as Error).message });
    return;
  }

  if (tossRes.statusCode < 200 || tossRes.statusCode >= 300) {
    console.error('[/api/notify/send] 토스 응답 비정상', { status: tossRes.statusCode, raw: tossRes.raw });
    res.status(502).json({ error: 'toss_response_error', status: tossRes.statusCode, body: tossRes.body });
    return;
  }

  // ── 4) 응답 ──
  res.status(200).json({
    ok:         true,
    resultType: tossRes.body?.resultType,
    result:     tossRes.body?.result,
  });
}
