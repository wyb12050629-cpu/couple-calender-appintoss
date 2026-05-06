'use client';

import { useState, useEffect } from 'react';
import { Bird, Plus } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { subscribeGratitudes } from '@/lib/db';
import type { Gratitude } from '@/lib/types';
import BottomNav from '@/components/BottomNav';
import GratitudeCard from '@/components/GratitudeCard';
import GratitudeModal from '@/components/GratitudeModal';
import GratitudeSkeleton from '@/components/GratitudeSkeleton';
import ReconcileMode from '@/components/ReconcileMode';
import Toast from '@/components/Toast';

type Tab = 'my-to-partner' | 'partner-to-my';

export default function GratitudePage() {
  const { uid, profile } = useUser();
  const [tab,            setTab]            = useState<Tab>('my-to-partner');
  const [messages,       setMessages]       = useState<Gratitude[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [toast,          setToast]          = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showWrite,      setShowWrite]      = useState(false);
  const [showReconcile,  setShowReconcile]  = useState(false);

  const myNickname      = profile?.nickname        || '나';
  const partnerNickname = profile?.partnerNickname || '상대방';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'my-to-partner', label: `${myNickname} → ${partnerNickname}` },
    { key: 'partner-to-my', label: `${partnerNickname} → ${myNickname}` },
  ];

  // ── Firestore 실시간 구독 (전체) → 클라이언트에서 탭별 필터 ──
  useEffect(() => {
    if (!profile?.coupleId || !uid) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const unsub = subscribeGratitudes(profile.coupleId, (list) => {
      // 전체 리스트를 그대로 보관하고 탭 필터는 derive
      setMessages(list);
      setLoading(false);
    });
    return unsub;
  }, [profile?.coupleId, uid]);

  // ── 탭 필터 ──
  const filteredMessages = (() => {
    if (!uid || !profile?.partnerUid) return [];
    const [from, to] = tab === 'my-to-partner'
      ? [uid, profile.partnerUid]
      : [profile.partnerUid, uid];
    return messages.filter(m => m.fromUid === from && m.toUid === to);
  })();

  // 낙관적 업데이트 후 Firestore 구독이 곧 갱신해 줌 — 별도 핸들러는 토스트만 처리
  const handleDeleted = () => {
    setToast({ message: '삭제되었어요', type: 'success' });
  };
  const handleUpdated = () => { /* onSnapshot이 반영 */ };
  const handleError   = (msg: string) => { setToast({ message: msg, type: 'error' }); };

  return (
    <div className="pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* 헤더 */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-shared mb-1">우리가 쌓은 따뜻한 순간들 🫶</h1>
        <p className="text-xs text-caption/60">{myNickname} &amp; {partnerNickname}의 감사 기록</p>
      </div>

      {/* 화해 모드 */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setShowReconcile(true)}
          className="w-full py-2.5 bg-paper border border-line rounded-lg text-sm font-medium text-shared flex items-center justify-center gap-2 hover:bg-line/30 transition-all active:scale-[0.98]"
        >
          <Bird size={16} />
          화해 모드 켜기 🕊️
        </button>
      </div>

      {/* 탭 */}
      <div className="flex px-4 gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border truncate px-2 ${
              tab === t.key
                ? 'bg-shared text-white border-shared shadow-sm'
                : 'bg-paper text-caption border-line hover:border-ink/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 메시지 리스트 */}
      <div className="px-4 pb-4 animate-fade-switch" key={tab}>
        {loading ? (
          <GratitudeSkeleton />
        ) : filteredMessages.length === 0 ? (
          <div className="text-center text-caption/60 py-8">
            <p className="text-3xl mb-3">💌</p>
            <p className="text-sm mb-1">첫 감사 메시지를 적어볼까요?</p>
            <button
              onClick={() => setShowWrite(true)}
              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-shared hover:text-shared/80 transition-colors"
            >
              <Plus size={14} /> 새로운 감사 적기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMessages.map((m, i) => (
              <GratitudeCard
                key={m.id}
                gratitude={m}
                index={i}
                onDeleted={handleDeleted}
                onUpdated={handleUpdated}
                onError={handleError}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowWrite(true)}
        className="fixed bottom-24 right-4 md:right-auto md:left-1/2 md:translate-x-[170px] h-14 px-5 bg-me text-white rounded-full shadow-lg flex items-center justify-center gap-2 active:scale-90 transition-all z-40 text-sm font-medium"
        style={{ boxShadow: '0 4px 14px rgba(184, 95, 95, 0.35)' }}
      >
        <Plus size={18} />
        감사한 순간 기록하기
      </button>

      {showWrite && (
        <GratitudeModal
          onClose={() => setShowWrite(false)}
          onSaved={() => setShowWrite(false)}
        />
      )}

      {showReconcile && <ReconcileMode onClose={() => setShowReconcile(false)} />}

      <BottomNav />
    </div>
  );
}
