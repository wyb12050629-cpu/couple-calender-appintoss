'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { createGratitude } from '@/lib/db';

type Props = { onClose: () => void; onSaved: () => void; };

export default function GratitudeModal({ onClose, onSaved }: Props) {
  const { uid, profile } = useUser();
  const [message, setMessage] = useState('');
  const [saving, setSaving]   = useState(false);
  const [showHearts, setShowHearts] = useState(false);

  // 동적 이름
  const toName   = profile?.partnerNickname ?? '상대방';
  const fromName = profile?.nickname        ?? '나';

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
    if (!message.trim() || !uid)            return;
    if (!profile?.coupleId || !profile.partnerUid) {
      alert('커플 연결이 필요합니다.');
      return;
    }
    setSaving(true);

    try {
      await createGratitude(profile.coupleId, {
        fromUid: uid,
        toUid:   profile.partnerUid,
        message: message.trim(),
      });
      setShowHearts(true);
      setTimeout(() => { setSaving(false); onSaved(); }, 1200);
    } catch (e) {
      console.error('[GratitudeModal] 저장 실패:', e);
      alert('저장에 실패했어요.');
      setSaving(false);
    }
  };

  // fromName은 향후 v1.x에서 토스 푸시 알림용으로 다시 사용 예정
  void fromName;

  return (
    <div className="fixed inset-0 bg-black/40 z-[55] flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-[430px] rounded-t-2xl animate-slide-up border-t border-[var(--line)] flex flex-col"
        style={{ maxHeight: '90dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 하트 파티클 */}
        {showHearts && (
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-t-2xl">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="heart-particle absolute text-lg"
                style={{ left: `${10 + Math.random() * 80}%`, top: `${40 + Math.random() * 40}%`, animationDelay: `${Math.random() * 0.5}s` }}>
                {['💕','💗','💖','✨','🌸'][Math.floor(Math.random() * 5)]}
              </span>
            ))}
          </div>
        )}

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0 border-b border-[var(--line)]">
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg active:scale-90 transition-all">
            <X size={20} />
          </button>
          <h3 className="tds-body1 font-bold text-gray-900">감사한 순간</h3>
          <button
            onClick={handleSave}
            disabled={!message.trim() || saving}
            className="px-4 py-1.5 bg-[var(--shared)] text-white rounded-xl text-sm font-bold disabled:opacity-40 active:scale-[0.97] transition-all"
          >
            {saving ? '저장 중' : '기록하기'}
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <p className="tds-body2 text-gray-500 text-center mb-4">{toName}에게 전하는 마음 💌</p>
          <div className="relative">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 200))}
              placeholder="오늘 하루도 함께해줘서 고마워 💕"
              rows={7}
              autoFocus
              className="w-full px-4 py-3 bg-white border border-[var(--line)] rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-[var(--shared)]/30 text-gray-900 placeholder:text-gray-200 leading-relaxed"
            />
            <span className="absolute bottom-3 right-3 text-[10px] text-gray-300">{message.length}/200</span>
          </div>
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}
