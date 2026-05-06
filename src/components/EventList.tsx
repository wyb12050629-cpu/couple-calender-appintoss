'use client';

import { useState, useEffect } from 'react';
import { Clock, Plus } from 'lucide-react';
import { subscribeEvents, subscribeGratitudes } from '@/lib/db';
import { useUser } from '@/context/UserContext';
import { getEventTone, getEventCreatorLabel, toneBorder } from '@/lib/identity';
import type { Event, Gratitude, Tone } from '@/lib/types';
import EventModal from './EventModal';

type Props = {
  date: string;
  /** Tone 기반 필터 */
  filterTone?: Tone;
  onAddClick?: () => void;
};

export default function EventList({ date, filterTone, onAddClick }: Props) {
  const { uid, profile } = useUser();
  const [events, setEvents] = useState<Event[]>([]);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [todayGratitude, setTodayGratitude] = useState<Gratitude | null>(null);

  // ── 일정 구독 (해당 날짜만 클라이언트 필터) ──
  useEffect(() => {
    if (!profile?.coupleId) { setEvents([]); return; }
    const month = date.slice(0, 7);   // YYYY-MM
    const unsub = subscribeEvents(profile.coupleId, (list) => {
      const onDate = list.filter(ev => ev.date === date);
      const filtered = filterTone
        ? onDate.filter(ev => {
            if (filterTone === 'shared') return ev.visibility === 'shared';
            if (filterTone === 'me')      return ev.visibility !== 'shared' && ev.creatorUid === uid;
            if (filterTone === 'partner') return ev.visibility !== 'shared' && ev.creatorUid !== uid;
            return true;
          })
        : onDate;
      // start_time(=startTime) 우선 정렬
      filtered.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
      setEvents(filtered);
    }, month);
    return unsub;
  }, [date, filterTone, profile?.coupleId, uid]);

  // ── 그날의 감사 카드(가장 최근) ──
  useEffect(() => {
    if (!profile?.coupleId) { setTodayGratitude(null); return; }
    const unsub = subscribeGratitudes(profile.coupleId, (list) => {
      const onDate = list.filter(g => g.createdAt.slice(0, 10) === date);
      setTodayGratitude(onDate[0] ?? null);
    });
    return unsub;
  }, [date, profile?.coupleId]);

  return (
    <>
      <div className="px-4 pb-2">
        {todayGratitude && (
          <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 mb-2">
            <p className="text-[10px] font-medium text-accent mb-0.5">오늘의 감사</p>
            <p className="text-xs text-ink/70 line-clamp-1">{todayGratitude.message}</p>
          </div>
        )}

        {events.length === 0 ? (
          <div className="py-3 text-center">
            <p className="text-sm text-caption/60 mb-2">일정이 없어요</p>
            {onAddClick && (
              <button
                onClick={onAddClick}
                className="inline-flex items-center gap-1 text-xs font-medium text-shared hover:text-shared/80 transition-colors"
              >
                <Plus size={14} />
                일정 추가하기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => {
              const tone  = getEventTone(ev, uid);
              const label = getEventCreatorLabel(ev, profile);
              return (
                <button
                  key={ev.id}
                  onClick={() => setEditEvent(ev)}
                  className={`w-full text-left bg-paper rounded-lg p-3 border-l-4 ${toneBorder(tone)} border border-line shadow-sm hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-line/50 text-caption">
                        {label}
                      </span>
                      <h4 className="font-medium text-sm mt-1 text-ink">{ev.title}</h4>
                      {ev.allDay ? (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-caption/70">
                          <Clock size={11} />
                          <span>하루 종일{ev.endDate ? ` (${ev.date} ~ ${ev.endDate})` : ''}</span>
                        </div>
                      ) : ev.startTime ? (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-caption/70">
                          <Clock size={11} />
                          <span>
                            {ev.startTime.slice(0, 5)}
                            {ev.endTime ? ` ~ ${ev.endTime.slice(0, 5)}` : ''}
                          </span>
                        </div>
                      ) : null}
                      {ev.memo && (
                        <p className="text-xs text-caption/60 mt-0.5 line-clamp-2">{ev.memo}</p>
                      )}
                    </div>
                    {ev.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ev.imageUrl} alt="" className="w-11 h-11 rounded-lg object-cover ml-2" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {editEvent && (
        <EventModal
          date={date}
          event={editEvent}
          onClose={() => setEditEvent(null)}
          onSaved={() => setEditEvent(null)}
        />
      )}
    </>
  );
}
