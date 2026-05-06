/**
 * 우리 사이 — Firebase 웹 SDK 초기화 (클라이언트)
 * ─────────────────────────────────────────────────────
 * 사용:
 *   import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase-client';
 *   await signInWithCustomToken(getFirebaseAuth(), token);
 *
 * 환경변수: 모두 NEXT_PUBLIC_ 접두사 — 클라이언트 번들에 포함됨 (정상)
 * Firebase Web Config는 공개 가능한 값. 보안은 Firestore 보안 규칙으로.
 * ─────────────────────────────────────────────────────
 */

import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig: FirebaseOptions = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ── 싱글톤 App (Next.js 클라이언트 HMR 대응) ──
function getFirebaseApp(): FirebaseApp {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;

  // 빌드 시점엔 환경변수가 비어있을 수 있으므로 런타임 호출 시점에 검증
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
      'Firebase 클라이언트 환경변수(NEXT_PUBLIC_FIREBASE_*)가 설정되지 않았습니다.'
    );
  }

  return initializeApp(firebaseConfig);
}

// ── 외부 export ──
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}
