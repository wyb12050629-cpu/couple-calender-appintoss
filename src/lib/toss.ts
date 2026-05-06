/**
 * 우리 사이 × 앱인토스(Apps-in-Toss) SDK
 * ─────────────────────────────────────────────────────
 * 공식 패키지: @apps-in-toss/web-bridge v2.4.7
 *
 * 유저 식별 방식: getAnonymousKey (비게임 미니앱)
 * ─ 서버 불필요, 콘솔 설정 불필요, 유저 동의 불필요
 * ─ 앱인토스 웹뷰 내에서 사용자 고유 키를 즉시 발급
 * ─ Firebase UID 대신 이 키를 사용자 식별자로 활용
 *
 * 문서: https://developers-apps-in-toss.toss.im/user-hash-key/intro.md
 * ─────────────────────────────────────────────────────
 */

// ──────────────────────────────────────────────
// 앱인토스 웹뷰 환경 감지
// ──────────────────────────────────────────────
export function isTossApp(): boolean {
  if (typeof window === 'undefined') return false;
  return /TossApp|TossBrowser|com\.toss\.Toss|Toss\/\d/i.test(navigator.userAgent);
}

// ──────────────────────────────────────────────
// SDK 동적 임포트 (클라이언트 전용, SSR 안전)
// ──────────────────────────────────────────────
let sdkCache: typeof import('@apps-in-toss/web-bridge') | null = null;

async function getSDK() {
  if (typeof window === 'undefined') return null;
  if (sdkCache) return sdkCache;
  try {
    sdkCache = await import('@apps-in-toss/web-bridge');
    return sdkCache;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// 유저 식별키 발급 — getAnonymousKey (비게임 미니앱)
//
// 반환값: 토스가 발급하는 사용자 고유 해시 문자열
// - 동일 사용자 → 항상 동일한 키 반환 (안정적 식별)
// - 서버/동의/콘솔 설정 모두 불필요
// - Firebase Firestore의 문서 ID로 사용 예정
// ──────────────────────────────────────────────
export async function getAnonymousKey(): Promise<string | null> {
  if (!isTossApp()) return null;
  try {
    const sdk = await getSDK();
    if (!sdk) return null;

    // 공식 API: getAnonymousKey (비게임 미니앱)
    if ('getAnonymousKey' in sdk && typeof sdk.getAnonymousKey === 'function') {
      const key = await (sdk.getAnonymousKey as () => Promise<string>)();
      console.log('[우리사이] getAnonymousKey 성공');
      return key ?? null;
    }

    console.warn('[우리사이] getAnonymousKey 메서드를 찾을 수 없음 — SDK 버전 확인 필요');
    return null;
  } catch (e) {
    console.warn('[우리사이] getAnonymousKey 실패:', e);
    return null;
  }
}

// ──────────────────────────────────────────────
// 유저 식별키를 localStorage에 캐시
// UserContext.init()에서 호출 — Firebase 로그인 전 선행 실행
// ──────────────────────────────────────────────
const LS_TOSS_KEY = 'woorisai-toss-anonymous-key';

export async function getOrCacheAnonymousKey(): Promise<string | null> {
  // 1. localStorage 캐시 확인
  const cached = localStorage.getItem(LS_TOSS_KEY);
  if (cached) return cached;

  // 2. SDK 호출
  const key = await getAnonymousKey();
  if (key) {
    localStorage.setItem(LS_TOSS_KEY, key);
  }
  return key;
}

export function getCachedAnonymousKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LS_TOSS_KEY);
}

// ──────────────────────────────────────────────
// 앱인토스 상단 타이틀 설정
// ──────────────────────────────────────────────
export async function setTossTitle(title: string): Promise<void> {
  if (!isTossApp()) return;
  try {
    const sdk = await getSDK();
    if (!sdk) return;
    if ('setTitle' in sdk && typeof sdk.setTitle === 'function') {
      (sdk.setTitle as (t: string) => void)(title);
    }
  } catch { /* 무시 */ }
}

// ──────────────────────────────────────────────
// 뒤로가기 핸들러
// ──────────────────────────────────────────────
export async function registerBackHandler(handler: () => void): Promise<void> {
  if (!isTossApp()) return;
  try {
    const sdk = await getSDK();
    if (!sdk) return;
    if ('onBackPress' in sdk && typeof sdk.onBackPress === 'function') {
      (sdk.onBackPress as (h: () => void) => void)(handler);
    }
  } catch { /* 무시 */ }
}

// ──────────────────────────────────────────────
// 공유하기
// ──────────────────────────────────────────────
export async function tossShare(params: { title: string; text: string }): Promise<boolean> {
  if (!isTossApp()) return false;
  try {
    const sdk = await getSDK();
    if (!sdk) return false;
    if ('share' in sdk && typeof sdk.share === 'function') {
      await (sdk.share as (p: object) => Promise<void>)(params);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// 하위 호환 유지 (기존 참조 코드용)
export { getAnonymousKey as getTossUserId };
export async function autoLoginWithToss() { return null; }
export async function initTossSDK() { await getSDK(); }
