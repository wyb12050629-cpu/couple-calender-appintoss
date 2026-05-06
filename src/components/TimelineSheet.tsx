'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Heart, Plus, Check, Trash2 } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { subscribeEvents, subscribeGratitudes, setEventStatus } from '@/lib/db';
import { getEventTone, toneBg, toneBorder, getEventCreatorLabel } from '@/lib/identity';
import { getDayMarkers } from '@/lib/dates';
import type { Event, Gratitude, Tone } from '@/lib/types';

type Props = {
  date: string;
  onClose: () => void;
  onAddEvent: () => void;
  onAddGratitude: () => void;
  onRefreshKey?: number;
};

// 날짜 포맷: YYYY-MM-DD → M월 D일 (요일)
function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
}

export default function TimelineSheet({ date, onClose, onAddEvent, onAddGratitude }: Props) {
  const { uid, profile } = useUser();
  const [events,     setEvents]     = useState<Event[]>([]);
  const [gratitudes, setGratitudes] = useState<Gratitude[]>([]);
  const [loading,    setLoading]    = useState(true);

  const myNickname      = profile?.nickname        || '나';
  const partnerNickname = profile?.partnerNickname || '상대방';
  const anniversaryDate = profile?.anniversaryDate || '';
  const myBirthday      = profile?.myBirthday      || '';
  const partnerBirthday = profile?.partnerBirthday || '';

  // D-Day 마커
  const parsedDate = new Date(date + 'T00:00:00');
  const dayMarkers = anniversaryDate
    ? getDayMarkers(parsedDate, anniversaryDate, myBirthday, partnerBirthday, myNickname, partnerNickname)
    : [];

  // ── Firestore 실시간 구독 (해당 월) ──
  useEffect(() => {
    if (!profile?.coupleId) {
      setEvents([]); setGratitudes([]); setLoading(false);
      return;
    }
    setLoading(true);
    const month = date.slice(0, 7);

    const unsubEv = subscribeEvents(profile.coupleId, (list) => {
      const onDate = list
        .filter(ev => ev.date === date && ev.status !== 'rejected')
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
      setEvents(onDate);
      setLoading(false);
    }, month);

    const unsubGr = subscribeGratitudes(profile.coupleId, (list) => {
      const onDate = list
        .filter(g => g.createdAt.slice(0, 10) === date)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      setGratitudes(onDate);
    });

    return () => { unsubEv(); unsubGr(); };
  }, [date, profile?.coupleId]);

  // 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  // 일정 수락/거절
  const handleAccept = async (eventId: string) => {
    if (!profile?.coupleId) return;
    try { await setEventStatus(profile.coupleId, eventId, 'accepted'); }
    catch (e) { console.error('[TimelineSheet] accept 실패:', e); }
  };

  const handleReject = async (eventId: string) => {
    if (!profile?.coupleId) return;
    try { await setEventStatus(profile.coupleId, eventId, 'rejected'); }
    catch (e) { console.error('[TimelineSheet] reject 실패:', e); }
  };

  // 타임라인 아이템 합치기 (시간순 정렬)
  type TimelineItem =
    | { kind: 'event';     data: Event;     time: string }
    | { kind: 'gratitude'; data: Gratitude; time: string };

  const timeline: TimelineItem[] = [
    ...events.map(e => ({
      kind: 'event' as const,
      data: e,
      time: e.startTime || '00:00',
    })),
    ...gratitudes.map(g => ({
      kind: 'gratitude' as const,
      data: g,
      time: g.createdAt.slice(11, 16),
    })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="fixed inset-0 bg-ink/40 z-[55] flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-paper w-full max-w-[430px] rounded-t-2xl border-t border-line flex flex-col animate-slide-up"
        style={{ maxHeight: '85dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── 핸들 + 헤더 ── */}
        <div className="flex-shrink-0">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-line/70" />
          </div>

          <div className="flex items-start justify-between px-5 pt-2 pb-3 border-b border-line">
            <div>
              <h3 className="font-bold text-base text-ink">{formatDisplayDate(date)}</h3>
              {dayMarkers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {dayMarkers.map((m, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-0.5 text-[11px] font-medium text-white bg-shared rounded-full px-2 py-0.5"
                    >
                      {m.emoji} {m.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-2 text-ink/40 hover:bg-line/50 rounded-lg ml-2">
              <X size={18} />
            </button>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2 px-5 py-2.5 border-b border-line/50">
            <button
              onClick={onAddEvent}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-me/10 border border-me/30 rounded-lg text-xs font-medium text-me hover:bg-me/20 active:scale-95 transition-all"
            >
              <Plus size={13} /> 일정 추가
            </button>
            <button
              onClick={onAddGratitude}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-accent/10 border border-accent/30 rounded-lg text-xs font-medium text-accent hover:bg-accent/20 active:scale-95 transition-all"
            >
              <Heart size={13} /> 감사 기록
            </button>
          </div>
        </div>

        {/* ── 타임라인 스크롤 영역 ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2].map(i => (
                <div key={i} className="h-16 bg-line/40 rounded-lg" />
              ))}
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-3">📅</p>
              <p className="text-sm text-caption/60 mb-1">아직 아무것도 없어요</p>
              <p className="text-xs text-caption/40">위 버튼으로 기록을 시작해보세요</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[17px] top-3 bottom-3 w-px bg-line/60" />

              <div className="space-y-3">
                {timeline.map((item, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <div className="flex-shrink-0 flex flex-col items-center mt-1">
                      <div className={`w-[10px] h-[10px] rounded-full z-10 ${
                        item.kind === 'event'
                          ? toneBg(getEventTone(item.data, uid))
                          : 'bg-accent'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {item.kind === 'event' ? (
                        <EventTimelineCard
                          event={item.data}
                          tone={getEventTone(item.data, uid)}
                          ownerLabel={getEventCreatorLabel(item.data, profile)}
                          isMine={item.data.creatorUid === uid || item.data.visibility === 'shared'}
                          onAccept={handleAccept}
                          onReject={handleReject}
                        />
                      ) : (
                        <GratitudeTimelineCard
                          gratitude={item.data}
                          isFromMe={item.data.fromUid === uid}
                          myNickname={myNickname}
                          partnerNickname={partnerNickname}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}

// ── 일정 타임라인 카드 ──
function EventTimelineCard({
  event,
  tone,
  ownerLabel,
  isMine,
  onAccept,
  onReject,
}: {
  event: Event;
  tone: Tone;
  ownerLabel: string;
  isMine: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isPending = event.status === 'pending';
  // 파트너가 나에게 보낸(=내 수락 대기 중인) 일정만 수락/거절 버튼을 노출
  const canDecide = isPending && !isMine && tone === 'partner';

  return (
    <div className={`rounded-lg border-l-4 ${toneBorder(tone)} border border-line bg-paper px-3 py-2 ${isPending ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white ${toneBg(tone)}`}>
              {ownerLabel}
            </span>
            {isPending && (
              <span className="text-[10px] font-medium text-caption/60 bg-line/60 px-1.5 py-0.5 rounded-full">
                수락 대기 ⏳
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-ink truncate">{event.title}</p>
          {event.startTime && (
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-caption/60">
              <Clock size={10} />
              <span>{event.startTime.slice(0, 5)}{event.endTime ? ` ~ ${event.endTime.slice(0, 5)}` : ''}</span>
            </div>
          )}
          {event.memo && <p className="text-[11px] text-caption/60 mt-0.5 line-clamp-1">{event.memo}</p>}
        </div>
        {event.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
        )}
      </div>

      {canDecide && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onReject(event.id)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-line/50 rounded-md text-[11px] font-medium text-caption active:scale-95 transition-all"
          >
            <Trash2 size={11} /> 거절
          </button>
          <button
            onClick={() => onAccept(event.id)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-shared text-white rounded-md text-[11px] font-bold active:scale-95 transition-all"
          >
            <Check size={11} /> 수락
          </button>
        </div>
      )}
    </div>
  );
}

// ── 감사 타임라인 카드 ──
function GratitudeTimelineCard({
  gratitude,
  isFromMe,
  myNickname,
  partnerNickname,
}: {
  gratitude: Gratitude;
  isFromMe: boolean;
  myNickname: string;
  partnerNickname: string;
}) {
  const ownerLabel = isFromMe ? myNickname : partnerNickname;
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Heart size={10} className="text-accent flex-shrink-0" />
        <span className="text-[10px] font-medium text-accent">
          {ownerLabel}의 감사 카드 {isFromMe ? '(내가 보냄)' : ''}
        </span>
      </div>
      <p className="text-sm text-ink leading-relaxed line-clamp-3">{gratitude.message}</p>
    </div>
  );
}
