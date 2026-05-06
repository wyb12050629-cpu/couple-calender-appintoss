'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import BottomNav from '@/components/BottomNav';
import Calendar from '@/components/Calendar';
import EventModal from '@/components/EventModal';
import TimelineSheet from '@/components/TimelineSheet';
import { getCharImage, getCharEmoji } from '@/lib/characters';

export default function MyPage() {
  const { profile } = useUser();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [refreshKey,   setRefreshKey]   = useState(0);

  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const displayName = profile?.nickname    ?? '나';
  const charImage   = getCharImage(profile?.characterType);
  const charEmoji   = getCharEmoji(profile?.characterType);

  const handleDateClick = (date: string) => { setSelectedDate(date); setShowTimeline(true); };
  const handleRefresh   = () => { setRefreshKey(k => k+1); setShowAddModal(false); setShowTimeline(false); };

  return (
    <div className="pb-20">
      {/* 헤더 — 내 시점이므로 항상 me 컬러 */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-me">
          {displayName}의 일정
        </h1>
      </div>

      <Calendar
        key={refreshKey}
        onDateClick={handleDateClick}
        filterTone="me"
        selectedDate={selectedDate}
      />

      {/* 캐릭터 이미지 */}
      <div className="flex justify-center py-4">
        {charImage ? (
          <div style={{ width: 120, height: 120, position: 'relative', transform: 'rotate(2deg)', opacity: 0.85 }}>
            <Image
              src={charImage}
              alt={displayName}
              fill
              className="object-contain drop-shadow-md"
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = 'none';
                const parent = el.parentElement;
                if (parent) {
                  const span = document.createElement('span');
                  span.style.cssText = 'font-size:80px;display:flex;align-items:center;justify-content:center;width:100%;height:100%';
                  span.textContent = charEmoji;
                  parent.appendChild(span);
                }
              }}
            />
          </div>
        ) : (
          <span style={{ fontSize: 80, display: 'block', transform: 'rotate(2deg)', opacity: 0.7 }}>
            {charEmoji}
          </span>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-all z-40 text-white"
        style={{ background: 'var(--me)', boxShadow: '0 4px 14px rgba(184,95,95,.35)' }}
        aria-label="일정 추가"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {showTimeline && selectedDate && (
        <TimelineSheet
          date={selectedDate}
          onClose={() => setShowTimeline(false)}
          onAddEvent={() => { setShowTimeline(false); setShowAddModal(true); }}
          onAddGratitude={() => setShowTimeline(false)}
          onRefreshKey={refreshKey}
        />
      )}

      {showAddModal && (
        <EventModal
          date={selectedDate || todayStr}
          onClose={() => setShowAddModal(false)}
          onSaved={handleRefresh}
        />
      )}

      <BottomNav />
    </div>
  );
}
