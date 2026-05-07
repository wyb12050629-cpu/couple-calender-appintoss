'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { subscribeEvents, setEventStatus } from '@/lib/db';
import type { Event } from '@/lib/types';

/**
 * 우리사이 — 일정 알림 토스트
 * ─────────────────────────────────────────────
 * 파트너가 등록한 일정에 대한 두 종류 토스트를 처리:
 *
 *  A) 'partner' 톤 (= 나에게 보낸 일정)
 *     creatorUid === myUid && visibility === 'private' && status === 'pending'
 *     → 수락/거절 버튼 토스트. 큐에 쌓이며 한 번에 하나씩 노출.
 *
 *  B) 'me' / 'shared' 톤 (= 파트너 자기 일정 또는 공동 일정)
 *     creatorUid === partnerUid && status === 'accepted'
 *     → 단순 인포 토스트. 3.5초 후 자동 사라짐. 마운트 이후 새로 생긴 것만.
 *
 * 마운트 시점에 이미 존재하던 이벤트는 알리지 않음 (seen ref로 가드).
 *
 * 주의: visibility==='private' && creatorUid===myUid 인 'partner-tone' 이벤트는
 *       EventModal에서 creatorUid를 partnerUid로 박아 만든다(파트너가 수락해야 함).
 *       즉 "나에게 들어온 수락 요청"은 creatorUid=내uid 가 아닌, creatorUid=내uid && 만든사람=파트너 인 구조.
 *       실제로 코드상 'partner' 톤은 creatorUid를 partner로 박는다. (EventModal 참고)
 *       → 내 시점에서 수락 대기는 creatorUid===myUid && status==='pending' 인 것들이다.
 */

type InfoToast = {
  kind:    'info';
  id:      string;
  title:   string;
  date:    string;
  time:    string | null;
  variant: 'me' | 'shared';
};

export default function EventAcceptToast() {
  const { uid, profile } = useUser();
  const [acceptQueue, setAcceptQueue] = useState<Event[]>([]);
  const [current,     setCurrent]     = useState<Event | null>(null);
  const [info,        setInfo]        = useState<InfoToast | null>(null);

  const partnerNickname = profile?.partnerNickname || '상대방';
  const partnerUid      = profile?.partnerUid       || null;

  // 마운트 직후 첫 스냅샷에 들어있던 이벤트 ID — 이건 알림 대상 X
  const seenIdsRef    = useRef<Set<string>>(new Set());
  const initializedRef = useRef<boolean>(false);

  // ── Firestore 구독 ──
  useEffect(() => {
    if (!profile?.coupleId || !uid) return;

    const unsub = subscribeEvents(profile.coupleId, (list) => {
      // 첫 스냅샷 → seen에 모두 등록하고 알림 안 띄움
      if (!initializedRef.current) {
        seenIdsRef.current = new Set(list.map(e => e.id));
        initializedRef.current = true;

        // 초기 수락 큐는 채워둠 (앱 켰을 때 이미 있던 pending도 보여줘야 함)
        if (partnerUid) {
          const pending = list.filter(ev =>
            ev.creatorUid === uid &&        // 내가 받는 사람
            ev.visibility === 'private' &&
            ev.status === 'pending'
          );
          setAcceptQueue(pending);
        }
        return;
      }

      // 이후 변경: 새로 추가된 이벤트만 추출
      const fresh = list.filter(ev => !seenIdsRef.current.has(ev.id));
      fresh.forEach(ev => seenIdsRef.current.add(ev.id));

      if (fresh.length === 0) return;

      // (A) 수락 대기 토스트 — 내가 받는 사람인 pending 일정
      const newPending = fresh.filter(ev =>
        ev.creatorUid === uid &&
        ev.visibility === 'private' &&
        ev.status === 'pending'
      );
      if (newPending.length > 0) {
        setAcceptQueue(prev => [...prev, ...newPending]);
      }

      // (B) 인포 토스트 — 파트너가 만든 me/shared 일정 (자동 활성화 상태)
      if (partnerUid) {
        const newInfo = fresh
          .filter(ev =>
            ev.creatorUid === partnerUid &&
            ev.status === 'accepted'
          )
          .pop();   // 여러 개면 마지막 것만 — 인포는 큐 안 만든다
        if (newInfo) {
          setInfo({
            kind:    'info',
            id:      newInfo.id,
            title:   newInfo.title,
            date:    newInfo.date,
            time:    newInfo.startTime,
            variant: newInfo.visibility === 'shared' ? 'shared' : 'me',
          });
        }
      }
    });

    return () => {
      unsub();
      initializedRef.current = false;
      seenIdsRef.current = new Set();
    };
  }, [profile?.coupleId, uid, partnerUid]);

  // ── 수락 큐 → 현재 노출 ──
  useEffect(() => {
    if (!current && acceptQueue.length > 0) {
      setCurrent(acceptQueue[0]);
    }
  }, [current, acceptQueue]);

  // ── 인포 토스트 자동 닫기 ──
  useEffect(() => {
    if (!info) return;
    const t = setTimeout(() => setInfo(null), 3500);
    return () => clearTimeout(t);
  }, [info]);

  const handleAccept = async () => {
    if (!current || !profile?.coupleId) return;
    try {
      await setEventStatus(profile.coupleId, current.id, 'accepted');
    } catch (e) {
      console.error('[EventAcceptToast] accept 실패:', e);
    } finally {
      setAcceptQueue(prev => prev.filter(ev => ev.id !== current.id));
      setCurrent(null);
    }
  };

  const handleReject = async () => {
    if (!current || !profile?.coupleId) return;
    try {
      await setEventStatus(profile.coupleId, current.id, 'rejected');
    } catch (e) {
      console.error('[EventAcceptToast] reject 실패:', e);
    } finally {
      setAcceptQueue(prev => prev.filter(ev => ev.id !== current.id));
      setCurrent(null);
    }
  };

  return (
    <>
      {/* (A) 수락 토스트 — partner 톤 */}
      {current && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-32px)] max-w-[398px] animate-slide-down">
          <div className="bg-paper border border-line rounded-xl shadow-lg px-4 py-3">
            <div className="flex items-start gap-2 mb-3">
              <span className="text-lg leading-none">📅</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-shared mb-0.5">
                  {partnerNickname}이(가) 일정을 등록했어요
                </p>
                <p className="text-sm font-bold text-ink truncate">{current.title}</p>
                <p className="text-[11px] text-caption/60 mt-0.5">
                  {current.date}
                  {current.startTime ? ` · ${current.startTime.slice(0, 5)}` : ''}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReject}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-line/50 border border-line rounded-lg text-xs font-medium text-caption hover:bg-line/80 active:scale-95 transition-all"
              >
                <X size={13} /> 거절
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-shared text-white rounded-lg text-xs font-bold hover:bg-shared/90 active:scale-95 transition-all"
              >
                <Check size={13} /> 수락
              </button>
            </div>

            {acceptQueue.length > 1 && (
              <p className="text-[10px] text-center text-caption/40 mt-2">
                +{acceptQueue.length - 1}개 더 있어요
              </p>
            )}
          </div>
        </div>
      )}

      {/* (B) 단순 인포 토스트 — me / shared 톤 */}
      {info && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-32px)] max-w-[398px] animate-slide-down">
          <div
            className="rounded-xl shadow-lg px-4 py-3 flex items-start gap-2"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
            }}
          >
            <span className="text-lg leading-none">
              {info.variant === 'shared' ? '💜' : '🗓'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium mb-0.5" style={{ color: info.variant === 'shared' ? 'var(--shared, #6B5B95)' : 'var(--caption)' }}>
                {info.variant === 'shared'
                  ? `${partnerNickname}이(가) 공동 일정을 등록했어요`
                  : `${partnerNickname}이(가) 일정을 등록했어요`}
              </p>
              <p className="text-sm font-bold text-ink truncate">{info.title}</p>
              <p className="text-[11px] text-caption/60 mt-0.5">
                {info.date}
                {info.time ? ` · ${info.time.slice(0, 5)}` : ''}
              </p>
            </div>
            <button
              onClick={() => setInfo(null)}
              className="p-1 -m-1 text-caption/60 hover:text-caption"
              aria-label="닫기"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
