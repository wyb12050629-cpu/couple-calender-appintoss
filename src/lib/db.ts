/**
 * 우리 사이 — Firestore CRUD 헬퍼 (클라이언트)
 * ─────────────────────────────────────────────────────
 * 컴포넌트가 직접 firestore SDK를 부르지 않고 이 파일을 거치도록.
 * - 컬렉션 경로 일원화
 * - Firestore 도큐먼트 ↔ 도메인 타입 변환을 한 곳에서
 * - onSnapshot 구독 헬퍼 포함
 *
 * Firestore 컬렉션 구조:
 *   /users/{uid}
 *   /couples/{coupleId}
 *   /couples/{coupleId}/events/{eventId}
 *   /couples/{coupleId}/gratitudes/{gratitudeId}
 *   /inviteCodes/{code}
 * ─────────────────────────────────────────────────────
 */

'use client';

import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, runTransaction,
  Timestamp,
  type DocumentData, type QueryDocumentSnapshot, type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase-client';
import type {
  Event, EventStatus, EventVisibility, Gratitude,
  InviteCodeDoc, CoupleStatus,
} from './types';

// ── 경로 헬퍼 ──
export const paths = {
  user:        (uid: string)       => doc(getFirebaseDb(), 'users', uid),
  couple:      (cid: string)       => doc(getFirebaseDb(), 'couples', cid),
  events:      (cid: string)       => collection(getFirebaseDb(), 'couples', cid, 'events'),
  event:       (cid: string, id: string) => doc(getFirebaseDb(), 'couples', cid, 'events', id),
  gratitudes:  (cid: string)       => collection(getFirebaseDb(), 'couples', cid, 'gratitudes'),
  gratitude:   (cid: string, id: string) => doc(getFirebaseDb(), 'couples', cid, 'gratitudes', id),
  inviteCode:  (code: string)      => doc(getFirebaseDb(), 'inviteCodes', code),
  inviteCodes: ()                  => collection(getFirebaseDb(), 'inviteCodes'),
  couples:     ()                  => collection(getFirebaseDb(), 'couples'),
};

// ── ISO 변환 헬퍼 ──
function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return new Date().toISOString();
}
function toIsoOrNull(v: unknown): string | null {
  if (v == null) return null;
  return toIso(v);
}

// ── Event ──
function eventFromDoc(snap: QueryDocumentSnapshot<DocumentData>, coupleId: string): Event {
  const d = snap.data();
  return {
    id:         snap.id,
    coupleId,
    creatorUid: String(d.creatorUid ?? ''),
    visibility: (d.visibility as EventVisibility) ?? 'private',
    title:      String(d.title ?? ''),
    date:       String(d.date ?? ''),
    endDate:    (d.endDate as string) ?? null,
    startTime:  (d.startTime as string) ?? null,
    endTime:    (d.endTime as string) ?? null,
    allDay:     Boolean(d.allDay),
    memo:       (d.memo as string) ?? null,
    imageUrl:   (d.imageUrl as string) ?? null,
    createdAt:  toIso(d.createdAt),
    status:     (d.status as EventStatus) ?? 'pending',
  };
}

export async function listEvents(coupleId: string): Promise<Event[]> {
  const snap = await getDocs(query(paths.events(coupleId), orderBy('date', 'asc')));
  return snap.docs.map(d => eventFromDoc(d, coupleId));
}

/**
 * 일정 실시간 구독.
 * @param month YYYY-MM 형식 (선택). 지정하면 해당 월만 필터.
 */
export function subscribeEvents(
  coupleId: string,
  onChange: (events: Event[]) => void,
  month?: string,
): Unsubscribe {
  let q = query(paths.events(coupleId), orderBy('date', 'asc'));
  if (month) {
    const start = `${month}-01`;
    const end   = `${month}-31`;
    q = query(paths.events(coupleId), where('date', '>=', start), where('date', '<=', end), orderBy('date', 'asc'));
  }
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map(d => eventFromDoc(d, coupleId)));
  });
}

export async function createEvent(coupleId: string, payload: Omit<Event, 'id' | 'coupleId' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(paths.events(coupleId), {
    creatorUid: payload.creatorUid,
    visibility: payload.visibility,
    title:      payload.title,
    date:       payload.date,
    endDate:    payload.endDate,
    startTime:  payload.startTime,
    endTime:    payload.endTime,
    allDay:     payload.allDay,
    memo:       payload.memo,
    imageUrl:   payload.imageUrl,
    status:     payload.status,
    createdAt:  serverTimestamp(),
  });
  return ref.id;
}

export async function updateEvent(coupleId: string, eventId: string, patch: Partial<Omit<Event, 'id' | 'coupleId' | 'creatorUid' | 'createdAt'>>): Promise<void> {
  await updateDoc(paths.event(coupleId, eventId), patch as DocumentData);
}

export async function deleteEvent(coupleId: string, eventId: string): Promise<void> {
  await deleteDoc(paths.event(coupleId, eventId));
}

export async function setEventStatus(coupleId: string, eventId: string, status: EventStatus): Promise<void> {
  await updateDoc(paths.event(coupleId, eventId), { status });
}

// ── Gratitude ──
function gratitudeFromDoc(snap: QueryDocumentSnapshot<DocumentData>, coupleId: string): Gratitude {
  const d = snap.data();
  return {
    id:        snap.id,
    coupleId,
    fromUid:   String(d.fromUid ?? ''),
    toUid:     String(d.toUid ?? ''),
    message:   String(d.message ?? ''),
    createdAt: toIso(d.createdAt),
    updatedAt: toIsoOrNull(d.updatedAt),
  };
}

export function subscribeGratitudes(coupleId: string, onChange: (list: Gratitude[]) => void): Unsubscribe {
  const q = query(paths.gratitudes(coupleId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map(d => gratitudeFromDoc(d, coupleId)));
  });
}

export async function createGratitude(coupleId: string, payload: Omit<Gratitude, 'id' | 'coupleId' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(paths.gratitudes(coupleId), {
    fromUid:   payload.fromUid,
    toUid:     payload.toUid,
    message:   payload.message,
    createdAt: serverTimestamp(),
    updatedAt: null,
  });
  return ref.id;
}

export async function updateGratitudeMessage(coupleId: string, id: string, message: string): Promise<void> {
  await updateDoc(paths.gratitude(coupleId, id), {
    message,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGratitude(coupleId: string, id: string): Promise<void> {
  await deleteDoc(paths.gratitude(coupleId, id));
}

// ── 초대 코드 / 커플 매칭 ──
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** 새 커플 문서 + 초대 코드 발급 (트랜잭션, 코드 충돌 시 3회 재시도) */
export async function createCoupleWithInvite(inviterUid: string): Promise<{ coupleId: string; inviteCode: string }> {
  const db = getFirebaseDb();
  for (let i = 0; i < 3; i++) {
    const code = generateInviteCode();
    try {
      const result = await runTransaction(db, async (tx) => {
        const codeRef = paths.inviteCode(code);
        const existing = await tx.get(codeRef);
        if (existing.exists()) throw new Error('code_collision');

        const coupleRef = doc(paths.couples());
        tx.set(coupleRef, {
          members:     [inviterUid],
          inviterUid,
          inviteeUid:  null,
          inviteCode:  code,
          status:      'pending' as CoupleStatus,
          createdAt:   serverTimestamp(),
          connectedAt: null,
        });
        tx.set(codeRef, {
          code,
          inviterUid,
          coupleId:    coupleRef.id,
          status:      'pending',
          createdAt:   serverTimestamp(),
          expiresAt:   null,
        });
        // users/{uid} 에 coupleId / coupleStatus / inviteCode 동기화
        // (마이페이지의 InviteCodeCard가 profile.inviteCode·coupleStatus로 노출 여부를 판단)
        tx.set(paths.user(inviterUid), {
          coupleId:     coupleRef.id,
          coupleStatus: 'pending' as CoupleStatus,
          inviteCode:   code,
        }, { merge: true });
        return { coupleId: coupleRef.id, inviteCode: code };
      });
      return result;
    } catch (e) {
      if ((e as Error).message !== 'code_collision') throw e;
      // 충돌이면 재시도
    }
  }
  throw new Error('초대 코드 생성 실패: 3회 충돌');
}

/** 초대 코드 입력 → 커플 연결 */
export async function acceptInvite(code: string, inviteeUid: string): Promise<{
  ok: true;  coupleId: string;
} | {
  ok: false; reason: 'not_found' | 'already_connected' | 'self_invite' | 'unknown';
}> {
  const db = getFirebaseDb();
  try {
    return await runTransaction(db, async (tx) => {
      const codeRef = paths.inviteCode(code.toUpperCase().trim());
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists()) return { ok: false as const, reason: 'not_found' as const };

      const codeDoc = codeSnap.data() as InviteCodeDoc;
      if (codeDoc.status !== 'pending') return { ok: false as const, reason: 'already_connected' as const };
      if (codeDoc.inviterUid === inviteeUid) return { ok: false as const, reason: 'self_invite' as const };

      const coupleRef = paths.couple(codeDoc.coupleId);
      const coupleSnap = await tx.get(coupleRef);
      if (!coupleSnap.exists()) return { ok: false as const, reason: 'not_found' as const };

      tx.update(coupleRef, {
        members:     [codeDoc.inviterUid, inviteeUid],
        inviteeUid,
        status:      'connected' as CoupleStatus,
        connectedAt: serverTimestamp(),
      });
      tx.update(codeRef, { status: 'used' });

      // 양쪽 users 문서에 partnerUid 박아주기
      tx.set(paths.user(codeDoc.inviterUid), {
        partnerUid: inviteeUid,
        coupleId:   codeDoc.coupleId,
        coupleStatus: 'connected',
      }, { merge: true });
      tx.set(paths.user(inviteeUid), {
        partnerUid: codeDoc.inviterUid,
        coupleId:   codeDoc.coupleId,
        coupleStatus: 'connected',
      }, { merge: true });

      return { ok: true as const, coupleId: codeDoc.coupleId };
    });
  } catch (e) {
    console.error('[db.acceptInvite] 트랜잭션 실패:', e);
    return { ok: false as const, reason: 'unknown' as const };
  }
}

// ── 해지 예약 (48시간 유예) ──
/** 유예 기간 (밀리초). 48시간. */
export const COUPLE_DELETION_GRACE_MS = 48 * 60 * 60 * 1000;

/**
 * 커플 해지 예약 — 즉시 삭제하지 않고 pendingDeletion 필드만 세팅.
 * 양쪽 클라이언트는 이 필드를 onSnapshot 으로 보고 카운트다운 배너를 표시.
 *
 * 멱등성: 이미 예약돼 있어도 재예약(executeAt 갱신)을 막지 않는다 — 호출자 UI에서 판단.
 */
export async function scheduleCoupleDeletion(coupleId: string, requestedBy: string): Promise<{ executeAt: string }> {
  const executeAtMs = Date.now() + COUPLE_DELETION_GRACE_MS;
  const executeAt   = new Date(executeAtMs);
  await updateDoc(paths.couple(coupleId), {
    pendingDeletion: {
      requestedBy,
      requestedAt: serverTimestamp(),
      executeAt:   Timestamp.fromDate(executeAt),
    },
  });
  return { executeAt: executeAt.toISOString() };
}

/**
 * 해지 예약 취소 — 단, 예약을 건 본인(requestedBy) 만 취소 가능.
 * 트랜잭션으로 race condition 방지.
 *
 * 반환값: 'ok' = 취소됨, 'not_owner' = 다른 사람이 예약함, 'no_pending' = 예약 없음
 */
export async function cancelCoupleDeletion(coupleId: string, currentUid: string): Promise<'ok' | 'not_owner' | 'no_pending'> {
  const db = getFirebaseDb();
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(paths.couple(coupleId));
    if (!snap.exists()) return 'no_pending' as const;
    const data = snap.data() as DocumentData;
    const pd = data.pendingDeletion as { requestedBy?: string } | null | undefined;
    if (!pd) return 'no_pending' as const;
    if (pd.requestedBy !== currentUid) return 'not_owner' as const;
    tx.update(paths.couple(coupleId), { pendingDeletion: null });
    return 'ok' as const;
  });
}

/**
 * 솔로 leave — 한쪽이 즉시 떠나는 모드 (양쪽 데이터 삭제하는 disconnectCouple과 다름).
 *
 * 동작:
 *  1) couples/{cid}.members 에서 leaverUid 제거 (남은 사람 1명만 유지)
 *  2) couples/{cid}.archivedMember 에 떠난 사람 정보(uid, nickname='상대방', leftAt) 박음
 *  3) leaver users/{uid} 문서 리셋 (coupleId/partnerUid/inviteCode/isOnboarded 모두 클리어)
 *
 * 데이터 보존:
 *  - events / gratitudes 모두 그대로 유지 (남은 사람의 추억)
 *  - 남은 사람의 시점에서 leaver가 만든 일정/감사는 작성자가 archivedMember.uid이지만
 *    UI 표시 시 effectiveProfile.partnerNickname='상대방'으로 derive (UserContext)
 *
 * 보안:
 *  - leaver는 members에서 빠지므로 firestore.rules의 isMemberOfCouple 통과 못 함
 *    → 다시 같은 uid로 토스 로그인하더라도 이전 커플 데이터 접근 불가
 *  - leaver의 user 문서는 isOnboarded=false로 리셋되어 다음 로그인 시 온보딩 화면부터.
 */
export async function leaveCoupleSolo(coupleId: string, leaverUid: string): Promise<void> {
  // 1) 커플 문서 읽기
  const coupleSnap = await getDoc(paths.couple(coupleId));
  if (!coupleSnap.exists()) throw new Error('couple_not_found');
  const c = coupleSnap.data() as DocumentData;
  const members: string[] = Array.isArray(c.members) ? (c.members as string[]) : [];
  const remaining = members.filter(uid => uid !== leaverUid);

  if (remaining.length === 0) {
    // 솔로(혼자)인 상태에서 leave — 그냥 전체 삭제로 처리하는 게 자연스럽다
    await disconnectCouple(coupleId);
    return;
  }

  // 2) couples 문서 업데이트 — members 축소 + archivedMember 기록
  await updateDoc(paths.couple(coupleId), {
    members: remaining,
    archivedMember: {
      uid:       leaverUid,
      nickname:  '상대방',
      leftAt:    Timestamp.now(),
    },
    pendingDeletion: null,   // 혹시 예약 중이었으면 같이 정리
  });

  // 3) leaver user 문서 리셋
  await setDoc(paths.user(leaverUid), {
    coupleId:         null,
    coupleStatus:     'disconnected' as CoupleStatus,
    inviteCode:       null,
    partnerUid:       null,
    partnerNickname:  null,
    partnerCharacter: null,
    isOnboarded:      false,
    updatedAt:        serverTimestamp(),
  }, { merge: true });
}

/**
 * 커플 연결 해지 — 모든 커플 데이터 영구 삭제 + 양쪽 사용자 온보딩 리셋
 *
 * 처리 순서:
 *   1) couples/{cid} 문서 읽어 members + inviteCode 확보
 *   2) events 서브컬렉션 전부 삭제
 *   3) gratitudes 서브컬렉션 전부 삭제
 *   4) inviteCodes/{code} 삭제
 *   5) couples/{cid} 문서 삭제
 *   6) members 양쪽 users/{uid} 문서의 커플 필드 + isOnboarded=false 설정
 *
 * 트랜잭션을 쓰지 않는 이유: 서브컬렉션 일괄 삭제는 단일 트랜잭션 범위 밖.
 * 부분 실패 가능성을 감수하고 best-effort로 진행 (실패 시 호출자에서 재시도 가능).
 */
export async function disconnectCouple(coupleId: string): Promise<void> {
  // 1) 커플 문서 읽기
  const coupleSnap = await getDoc(paths.couple(coupleId));
  if (!coupleSnap.exists()) {
    // 이미 사라진 경우 — 호출자 쪽에서 자기 user 문서만 정리하도록 throw
    throw new Error('couple_not_found');
  }
  const c = coupleSnap.data() as DocumentData;
  const members: string[] = Array.isArray(c.members) ? (c.members as string[]) : [];
  const code: string | undefined = typeof c.inviteCode === 'string' ? c.inviteCode : undefined;

  // 2) events 전부 삭제
  const evSnap = await getDocs(paths.events(coupleId));
  await Promise.all(evSnap.docs.map(d => deleteDoc(d.ref)));

  // 3) gratitudes 전부 삭제
  const grSnap = await getDocs(paths.gratitudes(coupleId));
  await Promise.all(grSnap.docs.map(d => deleteDoc(d.ref)));

  // 4) inviteCode 삭제 (없으면 무시)
  if (code) {
    await deleteDoc(paths.inviteCode(code)).catch(() => {});
  }

  // 5) 커플 문서 삭제
  await deleteDoc(paths.couple(coupleId));

  // 6) 양쪽 user 문서의 커플 필드 클리어 + 온보딩 리셋
  await Promise.all(members.map(uid =>
    setDoc(paths.user(uid), {
      coupleId:         null,
      coupleStatus:     'disconnected' as CoupleStatus,
      inviteCode:       null,
      partnerUid:       null,
      partnerNickname:  null,
      partnerCharacter: null,
      isOnboarded:      false,
      updatedAt:        serverTimestamp(),
    }, { merge: true })
  ));
}

/** 파트너 프로필 (uid로 직접 조회) */
export async function fetchPartnerSummary(partnerUid: string): Promise<{
  nickname:      string;
  characterType: string;
} | null> {
  const snap = await getDoc(paths.user(partnerUid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    nickname:      String(d.nickname ?? '상대방'),
    characterType: String(d.characterType ?? 'dino'),
  };
}

// ── 잡다한 export ──
export { getDoc, setDoc, serverTimestamp };
