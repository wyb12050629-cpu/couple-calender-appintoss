'use client';

/**
 * 우리 사이 — UserContext (Firebase Auth + Firestore 전용)
 * ─────────────────────────────────────────────────────────────
 * 데모 / Owner 모델 폐기. 모든 신원은 Firebase UID(string)로 통일.
 *
 * authState 전이:
 *   'loading' → 초기 (Firebase Auth 상태 미확인)
 *   'new'     → 미인증 또는 인증됐지만 프로필 미작성(=온보딩 필요)
 *   'ready'   → 프로필 + (커플 정보) 로드 완료, 메인 화면 진입 가능
 *
 * Firestore 구독 구조:
 *   /users/{uid}                 → 자기 프로필 (실시간 onSnapshot)
 *   /users/{partnerUid}          → 파트너 프로필 요약 (커플 연결됐을 때 1회 fetch)
 * ─────────────────────────────────────────────────────────────
 */

import {
  createContext, useContext, useState, useMemo,
  useEffect, useCallback, useRef, ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
} from 'firebase/auth';
import { onSnapshot, setDoc, serverTimestamp, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { getFirebaseAuth } from '@/lib/firebase-client';
import { paths, fetchPartnerSummary, disconnectCouple } from '@/lib/db';
import { isTossApp } from '@/lib/toss';
import type { CharacterType, UserProfile, CoupleStatus, PendingDeletion } from '@/lib/types';

// ── AuthState ──
export type AuthState = 'loading' | 'new' | 'ready';

// ── Context 타입 ──
type UserContextType = {
  authState: AuthState;
  uid:       string | null;
  profile:   UserProfile | null;
  isToss:    boolean;

  /** 해지 예약 정보 (없으면 null). 양쪽 멤버에게 동일하게 노출. */
  pendingDeletion: PendingDeletion | null;

  /** 파트너가 솔로 leave 했는지 — true면 profile.partnerUid=null, partnerNickname='상대방'으로 derive */
  partnerLeft: boolean;

  /** 토스 앱에서 호출: appLogin → /api/auth/toss → Firebase 로그인 */
  loginWithToss: () => Promise<void>;

  /** 온보딩 완료 — Firestore /users/{uid}에 프로필 저장 */
  completeOnboarding: (params: {
    nickname:        string;
    characterType:   CharacterType;
    anniversaryDate: string;
    myBirthday:      string;
    partnerBirthday: string;
  }) => Promise<void>;

  /** 로그아웃 */
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  authState: 'loading',
  uid:       null,
  profile:   null,
  isToss:    false,
  pendingDeletion: null,
  partnerLeft: false,
  loginWithToss:      async () => {},
  completeOnboarding: async () => {},
  logout:             async () => {},
});

// ── Firestore /users/{uid} → UserProfile 변환 ──
function buildProfile(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    uid,
    nickname:         (data.nickname        as string) ?? '',
    characterType:    ((data.characterType  as string) ?? 'poodle_brown') as CharacterType,

    partnerUid:       (data.partnerUid      as string) ?? null,
    partnerNickname:  (data.partnerNickname as string) ?? '상대방',
    partnerCharacter: ((data.partnerCharacter as string) ?? 'dino') as CharacterType,

    anniversaryDate:  (data.anniversaryDate as string) ?? '',
    myBirthday:       (data.myBirthday      as string) ?? '',
    partnerBirthday:  (data.partnerBirthday as string) ?? '',

    isOnboarded:      Boolean(data.isOnboarded),
    coupleId:         (data.coupleId   as string) ?? null,
    coupleStatus:     (data.coupleStatus as CoupleStatus) ?? null,
    inviteCode:       (data.inviteCode as string) ?? null,
  };
}

// ── Provider ──
export function UserProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [uid,       setUid]       = useState<string | null>(null);
  const [profile,   setProfile]   = useState<UserProfile | null>(null);
  const [isToss,    setIsToss]    = useState<boolean>(false);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);
  const [partnerLeft,    setPartnerLeft]    = useState<boolean>(false);

  // 환경 감지
  useEffect(() => { setIsToss(isTossApp()); }, []);

  // ── ready → new 전이 시 / 로 강제 이동 ──
  // 자동 해지 / 명시적 로그아웃 / 토큰 만료 등으로 'ready' 였던 사용자가 'new' 가 되면
  // 다른 라우트(/my 등)에 남아있으면 데이터 없는 빈 화면이 됨. 무조건 '/' 로 보낸다.
  const prevAuthRef = useRef<AuthState>('loading');
  useEffect(() => {
    if (prevAuthRef.current === 'ready' && authState === 'new') {
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    prevAuthRef.current = authState;
  }, [authState]);

  // ── Firebase Auth 구독 ──
  useEffect(() => {
    let unsubProfile: Unsubscribe | null = null;
    let unsubAuth:    Unsubscribe | null = null;

    try {
      unsubAuth = onAuthStateChanged(getFirebaseAuth(), (fbUser) => {
        // 이전 프로필 구독 정리
        if (unsubProfile) { unsubProfile(); unsubProfile = null; }

        if (!fbUser) {
          setUid(null);
          setProfile(null);
          setAuthState('new');
          return;
        }

        setUid(fbUser.uid);

        // /users/{uid} 실시간 구독 — 파트너 연결/온보딩 변경을 즉시 반영
        unsubProfile = onSnapshot(paths.user(fbUser.uid), async (snap) => {
          if (!snap.exists()) {
            setProfile(null);
            setAuthState('new');
            return;
          }
          const data = snap.data() ?? {};
          const p    = buildProfile(fbUser.uid, data);

          // 파트너 정보 보강 (partnerUid는 있는데 nickname 캐시가 비었을 때)
          if (p.partnerUid && (!p.partnerNickname || p.partnerNickname === '상대방')) {
            const summary = await fetchPartnerSummary(p.partnerUid).catch(() => null);
            if (summary) {
              p.partnerNickname  = summary.nickname;
              p.partnerCharacter = summary.characterType as CharacterType;
            }
          }

          setProfile(p);
          setAuthState(p.isOnboarded ? 'ready' : 'new');
        }, (err) => {
          console.error('[UserContext] /users 구독 실패:', err);
          setProfile(null);
          setAuthState('new');
        });
      });
    } catch (e) {
      console.error('[UserContext] Firebase 초기화 실패:', e);
      setAuthState('new');
    }

    return () => {
      if (unsubProfile) unsubProfile();
      if (unsubAuth)    unsubAuth();
    };
  }, []);

  // ── 토스 로그인 ──
  const loginWithToss = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined') return;

    const mod = await import('@apps-in-toss/web-framework').catch(() => null);
    const appLogin = mod && typeof (mod as { appLogin?: unknown }).appLogin === 'function'
      ? (mod as { appLogin: () => Promise<{ authorizationCode: string; referrer: 'DEFAULT' | 'SANDBOX' }> }).appLogin
      : null;

    if (!appLogin) {
      throw new Error('appLogin SDK를 로드하지 못했습니다. 토스 앱 안에서만 동작합니다.');
    }

    const { authorizationCode, referrer } = await appLogin();

    // Apps-in-Toss는 정적 SPA만 패키징하므로 mTLS auth는 Cloud Functions로 분리됨
    // 환경변수: NEXT_PUBLIC_TOSS_AUTH_FN_URL (예: https://asia-northeast3-couple-calender-2c0f4.cloudfunctions.net/issueTossToken)
    const fnUrl = process.env.NEXT_PUBLIC_TOSS_AUTH_FN_URL;
    if (!fnUrl) {
      throw new Error('NEXT_PUBLIC_TOSS_AUTH_FN_URL 환경변수가 없습니다. .env.local 확인 필요.');
    }

    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ authorizationCode, referrer }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`토스 로그인 실패 (${res.status}): ${errBody?.error ?? 'unknown'}`);
    }

    const { firebaseToken } = (await res.json()) as { firebaseToken: string };
    await signInWithCustomToken(getFirebaseAuth(), firebaseToken);
    // onAuthStateChanged → onSnapshot이 알아서 후속 처리
  }, []);

  // ── 온보딩 완료 ──
  const completeOnboarding = useCallback(async (params: {
    nickname:        string;
    characterType:   CharacterType;
    anniversaryDate: string;
    myBirthday:      string;
    partnerBirthday: string;
  }): Promise<void> => {
    const fbUser = getFirebaseAuth().currentUser;
    if (!fbUser) throw new Error('로그인이 필요합니다.');

    await setDoc(paths.user(fbUser.uid), {
      nickname:        params.nickname,
      characterType:   params.characterType,
      anniversaryDate: params.anniversaryDate,
      myBirthday:      params.myBirthday,
      partnerBirthday: params.partnerBirthday,
      isOnboarded:     true,
      updatedAt:       serverTimestamp(),
      createdAt:       serverTimestamp(),
    }, { merge: true });

    // onSnapshot이 곧이어 ready로 전환해 줌
  }, []);

  // ── 로그아웃 ──
  const logout = useCallback(async (): Promise<void> => {
    try {
      const auth = getFirebaseAuth();
      if (auth.currentUser) await signOut(auth);
    } catch (e) {
      console.warn('[UserContext] logout 실패:', e);
    }
    setUid(null);
    setProfile(null);
    setPendingDeletion(null);
    setAuthState('new');
  }, []);

  // ── couples/{coupleId} 구독 (해지 예약 감지) ──
  // pendingDeletion이 set 되면 배너 표시.
  // executeAt이 지나면 양쪽 어느 쪽이든 앱을 연 클라이언트가 실삭제를 트리거.
  useEffect(() => {
    const coupleId = profile?.coupleId;
    if (!coupleId) {
      setPendingDeletion(null);
      setPartnerLeft(false);
      return;
    }

    let unsub: Unsubscribe | null = null;
    let executing = false;   // 중복 실행 가드
    try {
      unsub = onSnapshot(paths.couple(coupleId), async (snap) => {
        if (!snap.exists()) {
          setPendingDeletion(null);
          setPartnerLeft(false);
          return;
        }
        const data = snap.data() ?? {};

        // archivedMember 감지 — 파트너가 솔로 leave 한 경우. UI에서 '상대방'으로 익명화.
        const archived = data.archivedMember as { uid?: string; nickname?: string } | null | undefined;
        setPartnerLeft(!!archived && typeof archived.uid === 'string');

        const pd   = (data.pendingDeletion ?? null) as
          | { requestedBy?: string; requestedAt?: Timestamp | string; executeAt?: Timestamp | string }
          | null;

        if (!pd || !pd.requestedBy || !pd.executeAt) {
          setPendingDeletion(null);
          return;
        }

        const requestedAtIso =
          pd.requestedAt instanceof Timestamp ? pd.requestedAt.toDate().toISOString()
            : typeof pd.requestedAt === 'string' ? pd.requestedAt
            : new Date().toISOString();
        const executeAtIso =
          pd.executeAt instanceof Timestamp ? pd.executeAt.toDate().toISOString()
            : typeof pd.executeAt === 'string' ? pd.executeAt
            : new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        setPendingDeletion({
          requestedBy: pd.requestedBy,
          requestedAt: requestedAtIso,
          executeAt:   executeAtIso,
        });

        // executeAt 지났으면 실삭제 트리거 (멱등성: 한 클라가 실행하면 doc 자체가 사라져 다른 클라엔 no-op)
        if (!executing && new Date(executeAtIso).getTime() <= Date.now()) {
          executing = true;
          try {
            await disconnectCouple(coupleId);
            // 내가 멤버였다면 내 user 문서도 isOnboarded=false로 리셋됐을 것
            // → onSnapshot이 authState를 'new'로 전이시킬 것
          } catch (e) {
            console.warn('[UserContext] 자동 해지 실행 실패:', e);
            executing = false;
          }
        }
      }, (err) => {
        console.warn('[UserContext] couple 구독 실패:', err);
      });
    } catch (e) {
      console.warn('[UserContext] couple 구독 초기화 실패:', e);
    }

    return () => { if (unsub) unsub(); };
  }, [profile?.coupleId]);

  // ── 파트너가 솔로 leave 한 경우 profile derive ──
  // partnerUid를 null로 만들어 EventModal의 'partner' 톤 disabled,
  // EventAcceptToast 동작 OFF, partnerNickname 표시는 '상대방'으로.
  // 캐릭터는 그대로 두는 정책(사용자: "이름만 '상대방' 으로 뜸").
  const effectiveProfile = useMemo<UserProfile | null>(() => {
    if (!profile) return null;
    if (!partnerLeft) return profile;
    return {
      ...profile,
      partnerUid:      null,
      partnerNickname: '상대방',
    };
  }, [profile, partnerLeft]);

  return (
    <UserContext.Provider
      value={{
        authState, uid, profile: effectiveProfile, isToss, pendingDeletion, partnerLeft,
        loginWithToss, completeOnboarding, logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
