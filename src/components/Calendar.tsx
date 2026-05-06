'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getCalendarDays, formatDate, MONTH_NAMES, getDayMarkers } from '@/lib/dates';
import { subscribeEvents, subscribeGratitudes } from '@/lib/db';
import { useUser } from '@/context/UserContext';
import type { Event, Gratitude, Tone } from '@/lib/types';

type Props = {
  onDateClick: (date: string) => void;
  /** 'me' | 'partner' | 'shared' — 색상/Tone 기준 필터 */
  filterTone?: Tone;
  selectedDate?: string | null;
};

export default function Calendar({ onDateClick, filterTone, selectedDate }: Props) {
  const { profile, uid } = useUser();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<Event[]>([]);
  const [gratitudeDates, setGratitudeDates] = useState<Set<string>>(new Set());

  // ── Firestore 실시간 구독 (월 + 커플 기준) ──
  useEffect(() => {
    if (!profile?.coupleId) { setEvents([]); return; }
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const unsub = subscribeEvents(profile.coupleId, setEvents, monthStr);
    return unsub;
  }, [year, month, profile?.coupleId]);

  useEffect(() => {
    if (!profile?.coupleId) { setGratitudeDates(new Set()); return; }
    const unsub = subscribeGratitudes(profile.coupleId, (list: Gratitude[]) => {
      const dates = new Set(list.map(g => g.createdAt.slice(0, 10)));
      setGratitudeDates(dates);
    });
    return unsub;
  }, [profile?.coupleId]);

  // ── Tone 필터 (클라이언트 사이드) ──
  const visibleEvents = events.filter(ev => {
    if (!filterTone) return true;
    if (filterTone === 'shared') return ev.visibility === 'shared';
    if (filterTone === 'me')      return ev.visibility !== 'shared' && ev.creatorUid === uid;
    if (filterTone === 'partner') return ev.visibility !== 'shared' && ev.creatorUid !== uid;
    return true;
  });

  const days = getCalendarDays(year, month);
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const getEventsForDay = (day: number) => {
    const dateStr = formatDate(year, month, day);
    return visibleEvents.filter(e => e.date === dateStr);
  };

  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const anniversaryDate = profile?.anniversaryDate || '';
  const myBirthday      = profile?.myBirthday || '';
  const partnerBirthday = profile?.partnerBirthday || '';
  const myNickname      = profile?.nickname || '나';
  const partnerNickname = profile?.partnerNickname || '상대방';

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-line/50 active:bg-line transition-colors"
        >
          <ChevronLeft size={20} className="text-ink" />
        </button>
        <h2 className="text-xl font-semibold text-ink">
          {year}년 {MONTH_NAMES[month]}
        </h2>
        <button
          onClick={nextMonth}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-line/50 active:bg-line transition-colors"
        >
          <ChevronRight size={20} className="text-ink" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2 border-b border-dashed border-line pb-2">
        {weekDays.map((d, i) => (
          <div key={d} className={`text-center text-xs font-medium py-1 ${
            i === 0 ? 'text-[#A04848]' : i === 6 ? 'text-[#4A6B85]' : 'text-ink'
          }`}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />;

          const dateStr = formatDate(year, month, day);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const dayEvents = getEventsForDay(day);
          const hasGratitude = gratitudeDates.has(dateStr);
          const dayOfWeek = (idx % 7);

          const hasPending = dayEvents.some(e => e.status === 'pending');
          const hasAccepted = dayEvents.some(e => !e.status || e.status === 'accepted');

          const date = new Date(year, month, day);
          const dayMarkers = anniversaryDate
            ? getDayMarkers(date, anniversaryDate, myBirthday, partnerBirthday, myNickname, partnerNickname)
            : [];
          const hasMilestone = dayMarkers.some(m => m.type === 'milestone');
          const hasAnniversary = dayMarkers.some(m => m.type === 'anniversary');
          const hasBirthday = dayMarkers.some(m => m.type === 'birthday-my' || m.type === 'birthday-partner');
          const primaryMarker = dayMarkers[0];

          return (
            <button
              key={dateStr}
              onClick={() => onDateClick(dateStr)}
              className="relative flex flex-col items-center py-1 rounded-lg transition-all active:scale-90"
            >
              <div className="absolute top-0.5 left-0 right-0 flex justify-between px-0.5">
                <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  hasAccepted ? 'bg-me' : 'bg-transparent'
                }`} />
                <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  hasGratitude ? 'bg-accent' : 'bg-transparent'
                }`} />
              </div>

              <span className={`text-base font-medium w-8 h-8 flex items-center justify-center transition-all ${
                isSelected && isToday
                  ? 'bg-shared text-white rounded-full ring-2 ring-accent ring-offset-1'
                  : isSelected
                  ? 'bg-shared text-white rounded-full'
                  : isToday
                  ? 'border-2 border-accent rounded-full text-ink font-bold'
                  : hasMilestone || hasAnniversary
                  ? 'text-shared font-bold'
                  : dayOfWeek === 0 ? 'text-[#A04848]'
                  : dayOfWeek === 6 ? 'text-[#4A6B85]'
                  : 'text-ink'
              }`}>
                {day}
              </span>

              <span className="text-[10px] leading-none min-h-[14px]">
                {hasBirthday ? '🎂'
                  : hasAnniversary ? '💜'
                  : hasMilestone ? '🎉'
                  : hasPending ? '⏳'
                  : primaryMarker ? primaryMarker.emoji
                  : ''}
              </span>
            </button>
          );
        })}
      </div>

      {anniversaryDate && (
        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-dashed border-line/50 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] text-caption/50">
            <span className="w-1.5 h-1.5 rounded-full bg-me inline-block" /> 일정
          </span>
          <span className="flex items-center gap-1 text-[10px] text-caption/50">
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" /> 감사
          </span>
          <span className="text-[10px] text-caption/50">🎉 100일 · 💜 기념일 · 🎂 생일 · ⏳ 수락대기</span>
        </div>
      )}
    </div>
  );
}
