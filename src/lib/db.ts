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
