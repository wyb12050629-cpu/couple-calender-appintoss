'use client';

import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { subscribeEvents, setEventStatus } from '@/lib/db';
import type { Event } from '@/lib/types';

/**
 * 파트너가 새 일정을 등록했을 때 나타나는 수락/거절 토스트
 * - Firestore onSnapshot 구독으로 pending 이벤트를 감지합니다.
 * - 대상: visibility='private' && creatorUid===partnerUid && status==='pending'
 * - 수락 → status = 'accepted' (캘린더에 컬러로 활성화)
 * - 거절 → status = 'rejected' (캘린더에서 숨김)
 */
export default function EventAcceptToast() {
  const { uid, profile } = useUser();
  const [queue,   setQueue]   = useState<Event[]>([]);
  const [current, setCurrent] = useState<Event | null>(null);

  const partnerNickname = profile?.partnerNickname || '상대방';
  const partnerUid      = profile?.partnerUid       || null;

  // ── 실시간 구독: 파트너가 만든 pending 이벤트 ──
  useEffect(() => {
    if (!profile?.coupleId || !uid || !partnerUid) {
      setQueue([]);
      return;
    }

    const unsub = subscribeEvents(profile.coupleId, (list) => {
      const pending = list
        .filter(ev =>
          ev.visibility === 'private' &&
          ev.creatorUid === partnerUid &&
          ev.status === 'pending'
        )
        .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
      setQueue(pending);
    });

    return unsub;
  }, [profile?.coupleId, uid, partnerUid]);

  // ── 큐에서 하나씩 꺼내기 (현재 표시 중이 아닐 때만) ──
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
    }
  }, [current, queue]);

  const handleAccept = async () => {
    if (!current || !profile?.coupleId) return;
    try {
      await setEventStatus(profile.coupleId, current.id, 'accepted');
    } catch (e) {
      console.error('[EventAcceptToast] accept 실패:', e);
    } finally {
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
      setCurrent(null);
    }
  };

  if (!current) return null;

  const remaining = Math.max(0, queue.length - 1);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-32px)] max-w-[398px] animate-slide-down">
      <div className="bg-paper border border-line rounded-xl shadow-lg px-4 py-3">
        {/* 헤더 */}
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

        {/* 수락/거절 버튼 */}
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

        {/* 대기 중인 일정 수 뱃지 */}
        {remaining > 0 && (
          <p className="text-[10px] text-center text-caption/40 mt-2">
            +{remaining}개 더 있어요
          </p>
        )}
      </div>
    </div>
  );
}
