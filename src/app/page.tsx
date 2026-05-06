'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import Onboarding from '@/components/Onboarding';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import BottomNav from '@/components/BottomNav';
import DdayBanner from '@/components/DdayBanner';
import Calendar from '@/components/Calendar';
import EventModal from '@/components/EventModal';
import GratitudeModal from '@/components/GratitudeModal';
import TimelineSheet from '@/components/TimelineSheet';
import EventAcceptToast from '@/components/EventAcceptToast';

export default function Home() {
  const { authState } = useUser();
  const [selectedDate,  setSelectedDate]  = useState<string | null>(null);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [showGratitude, setShowGratitude] = useState(false);
  const [showTimeline,  setShowTimeline]  = useState(false);
  const [refreshKey,    setRefreshKey]    = useState(0);

  if (authState === 'loading') return <LoadingSkeleton />;
  if (authState === 'new')     return <Onboarding />;

  // authState === 'ready' → 메인 캘린더
  const today   = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const handleDateClick = (date: string) => { setSelectedDate(date); setShowTimeline(true); };
  const handleRefresh   = () => { setRefreshKey(k => k+1); setShowTimeline(false); setShowAddModal(false); setShowGratitude(false); };

  return (
    <div className="pb-20">
      <EventAcceptToast />
      <DdayBanner />

      <Calendar
        key={refreshKey}
        onDateClick={handleDateClick}
        selectedDate={selectedDate}
      />

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-all z-40 text-white"
        style={{ background: 'var(--me)', boxShadow: '0 4px 14px rgba(184,95,95,.35)' }}
        aria-label="일정 추가"
      >
        <Plus size={24} strokeWidth={2.5}/>
      </button>

      {showTimeline && selectedDate && (
        <TimelineSheet
          date={selectedDate}
          onClose={() => setShowTimeline(false)}
          onAddEvent={() => { setShowTimeline(false); setShowAddModal(true); }}
          onAddGratitude={() => { setShowTimeline(false); setShowGratitude(true); }}
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

      {showGratitude && (
        <GratitudeModal
          onClose={() => setShowGratitude(false)}
          onSaved={handleRefresh}
        />
      )}

      <BottomNav />
    </div>
  );
}
