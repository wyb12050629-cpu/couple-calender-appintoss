'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { createEvent, updateEvent, deleteEvent } from '@/lib/db';
import { getEventTone } from '@/lib/identity';
import type { Event, Tone } from '@/lib/types';

type Props = {
  date: string;
  event?: Event | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EventModal({ date, event, onClose, onSaved }: Props) {
  const { uid, profile } = useUser();

  // ── 폼 상태 ──
  const [title,     setTitle]     = useState(event?.title     || '');
  const [startDate, setStartDate] = useState(event?.date      || date);
  const [endDate,   setEndDate]   = useState(event?.endDate   || event?.date || date);
  const [allDay,    setAllDay]    = useState(event?.allDay    ?? false);
  const [startTime, setStartTime] = useState(event?.startTime || '');
  const [endTime,   setEndTime]   = useState(event?.endTime   || '');
  const [memo,      setMemo]      = useState(event?.memo      || '');

  // ── Tone 상태 (me / partner / shared) ──
  const initialTone: Tone = event ? getEventTone(event, uid) : 'me';
  const [tone, setTone] = useState<Tone>(initialTone);

  const [saving, setSaving] = useState(false);

  // 동적 이름 레이블
  const myLabel      = profile?.nickname        || '나';
  const partnerLabel = profile?.partnerNickname || '상대방';
  const partnerUid   = profile?.partnerUid      || null;

  const toneOptions: { value: Tone; label: string; colorClass: string }[] = [
    { value: 'me',      label: myLabel,      colorClass: 'bg-me' },
    { value: 'partner', label: partnerLabel, colorClass: 'bg-partner' },
    { value: 'shared',  label: '공동',       colorClass: 'bg-shared' },
  ];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSave = async () => {
    if (!title.trim())                  return;
    if (!profile?.coupleId || !uid)     { alert('커플 연결이 필요합니다.'); return; }
    if (endDate < startDate)            { alert('종료 날짜가 시작 날짜보다 빠를 수 없어요.'); return; }
    if (!allDay && startDate === endDate && startTime && endTime && endTime < startTime) {
      alert('종료 시간이 시작 시간보다 빠를 수 없어요.'); return;
    }
    if (tone === 'partner' && !partnerUid) {
      alert('파트너가 연결돼 있지 않아요.'); return;
    }

    setSaving(true);

    // ── Tone → (creatorUid, visibility, status) 매핑 ──
    //  me      : 내 일정 (creatorUid = 나)
    //  partner : 파트너 일정 — 파트너 UID로 등록되며, 파트너가 수락해야 활성화 (pending)
    //  shared  : 공동 일정 — 어느 쪽이든 즉시 표시 (accepted)
    const creatorUid =
      tone === 'partner' ? (partnerUid as string) : uid;
    const visibility: 'private' | 'shared' =
      tone === 'shared' ? 'shared' : 'private';
    const newStatus: 'pending' | 'accepted' =
      tone === 'partner' ? 'pending' : 'accepted';

    const payload = {
      title:      title.trim(),
      date:       startDate,
      endDate:    endDate !== startDate ? endDate : null,
      allDay,
      startTime:  allDay ? null : (startTime || null),
      endTime:    allDay ? null : (endTime   || null),
      memo:       memo.trim() || null,
      imageUrl:   event?.imageUrl ?? null,    // v1: 사진 기능 없음 — 기존 값 유지(없으면 null)
      creatorUid,
      visibility,
      status:     event?.status || newStatus, // 수정 시엔 기존 status 유지
    };

    try {
      if (event) {
        await updateEvent(profile.coupleId, event.id, payload);
      } else {
        await createEvent(profile.coupleId, payload);
      }
      onSaved();
    } catch (e) {
      console.error('[EventModal] 저장 실패:', e);
      alert('저장에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !profile?.coupleId) return;
    try {
      await deleteEvent(profile.coupleId, event.id);
      onSaved();
    } catch (e) {
      console.error('[EventModal] 삭제 실패:', e);
      alert('삭제에 실패했어요.');
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 z-[55] flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-paper w-full max-w-[430px] rounded-t-2xl animate-slide-up border-t border-line flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 40px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0 border-b border-line">
          <button onClick={onClose} className="p-2 text-ink/50 hover:bg-line/50 rounded-lg">
            <X size={20} />
          </button>
          <h3 className="font-bold text-base text-ink">{event ? '일정 수정' : '새 일정'}</h3>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="px-4 py-1.5 bg-shared text-white rounded-lg text-sm font-semibold disabled:opacity-40 active:scale-[0.97] transition-all"
          >
            {saving ? '저장 중' : event ? '수정' : '저장'}
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Tone 선택 */}
          <div className="flex gap-2 mb-4">
            {toneOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTone(opt.value)}
                disabled={opt.value === 'partner' && !partnerUid}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  tone === opt.value
                    ? `${opt.colorClass} text-white shadow-sm border-transparent`
                    : 'bg-paper text-ink/50 border-line hover:border-ink/20'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 파트너 일정 안내 */}
          {tone === 'partner' && (
            <div className="mb-3 px-3 py-2 bg-shared/5 border border-shared/20 rounded-lg">
              <p className="text-[11px] text-shared/80 font-medium">
                ⏳ {partnerLabel}의 일정으로 등록돼요. {partnerLabel}이(가) 수락해야 활성화됩니다.
              </p>
            </div>
          )}

          {/* 제목 */}
          <input
            type="text"
            placeholder="일정 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-sm mb-3 outline-none focus:ring-2 focus:ring-shared/30 text-ink placeholder:text-ink/30"
          />

          {/* 날짜 */}
          <div className="flex gap-2 mb-3 items-end">
            <div className="flex-1 min-w-0">
              <label className="text-[11px] text-ink/40 mb-1 block">시작 날짜</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }}
                className="w-full px-2 py-2.5 bg-paper border border-line rounded-lg text-xs outline-none focus:ring-2 focus:ring-shared/30 text-ink"
              />
            </div>
            <span className="pb-2.5 text-ink/30 text-xs">~</span>
            <div className="flex-1 min-w-0">
              <label className="text-[11px] text-ink/40 mb-1 block">종료 날짜</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2 py-2.5 bg-paper border border-line rounded-lg text-xs outline-none focus:ring-2 focus:ring-shared/30 text-ink"
              />
            </div>
          </div>

          {/* 하루 종일 토글 */}
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="w-4 h-4 rounded border-line accent-shared" />
            <span className="text-sm text-ink/60">하루 종일</span>
          </label>

          {/* 시간 */}
          {!allDay && (
            <div className="flex gap-2 mb-3 items-end">
              <div className="flex-1 min-w-0">
                <label className="text-[11px] text-ink/40 mb-1 block">시작 시간</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-2 py-2.5 bg-paper border border-line rounded-lg text-xs outline-none focus:ring-2 focus:ring-shared/30 text-ink" />
              </div>
              <span className="pb-2.5 text-ink/30 text-xs">~</span>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] text-ink/40 mb-1 block">종료 시간</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-2 py-2.5 bg-paper border border-line rounded-lg text-xs outline-none focus:ring-2 focus:ring-shared/30 text-ink" />
              </div>
            </div>
          )}

          {/* 메모 */}
          <textarea
            placeholder="메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-sm mb-3 outline-none resize-none focus:ring-2 focus:ring-shared/30 text-ink placeholder:text-ink/30"
          />

          {/* 삭제 */}
          {event && (
            <button
              onClick={handleDelete}
              className="w-full py-2.5 text-sm font-medium text-me hover:bg-me/10 rounded-lg transition-colors mb-2"
            >
              이 일정 삭제하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
