/**
 * 우리 사이 — 앱인토스 mTLS HTTPS 클라이언트 (Vercel 서버리스)
 * ─────────────────────────────────────────────────────
 * 공식 예제(toss/apps-in-toss-examples/with-app-login/server) 패턴.
 *
 * Vercel 환경변수 (Project Settings → Environment Variables):
 *   - APPINTOSS_CLIENT_KEY_BASE64   (private_key_base64.txt 파일 내용)
 *   - APPINTOSS_CLIENT_CERT_BASE64  (public_crt_base64.txt 파일 내용)
 *   - APPINTOSS_AUTH_API_BASE       (운영 토큰 endpoint base)
 *   - APPINTOSS_AUTH_API_BASE_SANDBOX (선택)
 * ─────────────────────────────────────────────────────
 */

import * as https from 'https';

export type Referrer = 'DEFAULT' | 'SANDBOX';

let cachedAgent: https.Agent | null = null;

function readBase64FromEnv(envName: string): Buffer {
  const v = process.env[envName];
  if (!v || v.length === 0) {
    throw new Error(`${envName} 환경변수가 비어있습니다. Vercel 환경변수 등록 필요.`);
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

export function getAuthApiBase(referrer: Referrer): string {
  if (referrer === 'SANDBOX') {
    const sandbox = process.env.APPINTOSS_AUTH_API_BASE_SANDBOX;
    if (sandbox && sandbox.length > 0) return sandbox.replace(/\/$/, '');
    console.warn('[appintoss] referrer=SANDBOX인데 APPINTOSS_AUTH_API_BASE_SANDBOX 없음 → DEFAULT 사용');
  }
  const def = process.env.APPINTOSS_AUTH_API_BASE;
  if (!def || def.length === 0) {
    throw new Error('APPINTOSS_AUTH_API_BASE 환경변수가 없습니다.');
  }
  return def.replace(/\/$/, '');
}

type RequestOptions = {
  method:   'GET' | 'POST';
  path:     string;
  body?:    unknown;
  referrer: Referrer;
  headers?: Record<string, string>;
};

type ResponseEnvelope<T = unknown> = {
  statusCode: number;
  body:       T;
  raw:        string;
};

export async function appintossRequest<T = unknown>(opts: RequestOptions): Promise<ResponseEnvelope<T>> {
  const base = getAuthApiBase(opts.referrer);
  const url  = new URL(base + opts.path);
  const data = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port:     url.port || 443,
        path:     url.pathname + url.search,
        method:   opts.method,
        agent:    getAgent(),
        headers: {
          'Content-Type': 'application/json',
          ...(data !== undefined ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...(opts.headers ?? {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let parsed: unknown = raw;
          try { parsed = raw.length > 0 ? JSON.parse(raw) : null; } catch { /* keep as string */ }
          resolve({
            statusCode: res.statusCode ?? 0,
            body:       parsed as T,
            raw,
          });
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    if (data !== undefined) req.write(data);
    req.end();
  });
}

type GenerateTokenBody = {
  authorizationCode: string;
  referrer:          Referrer;
};

export async function exchangeAuthorizationCode(body: GenerateTokenBody) {
  return appintossRequest<unknown>({
    method:   'POST',
    path:     '/generate-token',
    body,
    referrer: body.referrer,
  });
}
