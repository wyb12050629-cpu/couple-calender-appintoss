'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { subscribeGratitudes } from '@/lib/db';
import type { Gratitude } from '@/lib/types';

type Props = {
  onClose: () => void;
};

export default function ReconcileMode({ onClose }: Props) {
  const { uid, profile } = useUser();
  const [messages,   setMessages]   = useState<Gratitude[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visible,    setVisible]    = useState(false);
  const [closing,    setClosing]    = useState(false);

  const myNickname      = profile?.nickname        ?? '나';
  const partnerNickname = profile?.partnerNickname ?? '상대방';

  // ── 감사 메시지 5개 랜덤 추출 (한 번만 구독해서 받아온 후 셔플) ──
  useEffect(() => {
    if (!profile?.coupleId) return;
    let done = false;
    const unsub = subscribeGratitudes(profile.coupleId, (list) => {
      if (done) return;
      if (list.length === 0) {
        setMessages([]);
        done = true;
        return;
      }
      const top50  = list.slice(0, 50);
      const picked = [...top50].sort(() => Math.random() - 0.5).slice(0, 5);
      setMessages(picked);
      done = true;
    });
    return unsub;
  }, [profile?.coupleId]);

  useEffect(() => {
    if (messages.length > 0) {
      setVisible(false);
      const t = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(t);
    }
  }, [currentIdx, messages.length]);

  const nameOf = (someUid: string) =>
    someUid === uid ? myNickname : partnerNickname;

  const handleNext = () => {
    if (currentIdx < messages.length - 1) {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 1500);
  };

  const current = messages[currentIdx];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{
        backgroundColor: '#F5EFE6',
        backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(232, 221, 201, 0.5) 31px, rgba(232, 221, 201, 0.5) 32px)',
      }}
    >
      {/* 배경 파티클 */}
      {Array.from({ length: 15 }).map((_, i) => (
        <span
          key={i}
          className="particle text-xl"
          style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${4 + Math.random() * 6}s`,
            animationDelay: `${Math.random() * 5}s`,
            fontSize: `${14 + Math.random() * 18}px`,
          }}
        >
          {['♥', '✦', '🌸', '💕', '⭐'][Math.floor(Math.random() * 5)]}
        </span>
      ))}

      {/* 닫기 */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 p-2 bg-paper/80 border border-line rounded-lg text-ink/60 hover:bg-paper transition-colors z-10"
      >
        <X size={20} />
      </button>

      {/* 종료 메시지 */}
      {closing && (
        <div className="absolute inset-0 flex items-center justify-center bg-paper/80 z-20">
          <p className="text-3xl font-bold text-shared animate-fade-in">
            오늘도 사랑해요 💕
          </p>
        </div>
      )}

      {/* 메시지 카드 */}
      {current && !closing && (
        <div className="px-6 w-full max-w-[400px]">
          <div
            className={`bg-paper border border-line rounded-lg p-8 shadow-md transition-all duration-700 ease-in-out rotate-[-0.5deg] ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <p className="text-sm font-normal text-caption/70 mb-1">
              {nameOf(current.fromUid)} → {nameOf(current.toUid)}
            </p>
            <p className="text-[10px] font-normal text-caption/50 mb-4">
              {new Date(current.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <p className="text-lg leading-relaxed text-ink font-medium">
              {current.message}
            </p>
          </div>

          {/* 페이지 인디케이터 */}
          <div className="flex justify-center gap-2 mt-6">
            {messages.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIdx ? 'bg-shared w-6' : 'bg-line'
                }`}
              />
            ))}
          </div>

          {/* 다음 버튼 */}
          {currentIdx < messages.length - 1 && (
            <button
              onClick={handleNext}
              className="flex items-center gap-1 mx-auto mt-4 text-sm font-medium text-caption hover:text-shared transition-colors"
            >
              다음 메시지 보기 <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      {messages.length === 0 && !closing && (
        <div className="text-center text-caption px-6">
          <p className="text-lg font-medium mb-2">아직 감사 메시지가 없어요</p>
          <p className="text-sm font-normal">먼저 감사한 순간을 기록해보세요! 💕</p>
        </div>
      )}
    </div>
  );
}
