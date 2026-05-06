/**
 * 우리 사이 — Firebase Admin SDK 초기화 (Vercel 서버리스)
 * ─────────────────────────────────────────────────────
 * Custom Token 발급 전용. Vercel 환경변수 우선순위:
 *   ① FIREBASE_ADMIN_SDK_BASE64 — 서비스 계정 .json 파일 통째로 BASE64 (권장)
 *   ② FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (분리형)
 *
 * Vercel 환경변수 등록 시 .json 통째 base64 인코딩해서 한 줄로:
 *   cat service-account.json | base64 | pbcopy   (macOS)
 * ─────────────────────────────────────────────────────
 */

import { initializeApp, getApps, cert, type App, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

function loadServiceAccount(): ServiceAccount {
  // ① BASE64 인코딩된 .json 우선
  const base64 = process.env.FIREBASE_ADMIN_SDK_BASE64;
  if (base64 && base64.length > 0) {
    try {
      const json = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
      return {
        projectId:   json.project_id,
        clientEmail: json.client_email,
        privateKey:  json.private_key,
      };
    } catch (e) {
      throw new Error('FIREBASE_ADMIN_SDK_BASE64 디코딩 실패: ' + (e as Error).message);
    }
  }

  // ② 분리형 (PRIVATE_KEY는 \n 이스케이프된 상태로 들어옴)
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  throw new Error(
    'Firebase Admin 환경변수가 없습니다. ' +
    'FIREBASE_ADMIN_SDK_BASE64 또는 FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY 셋 다 설정 필요.',
  );
}

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;
  return initializeApp({ credential: cert(loadServiceAccount()) });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
