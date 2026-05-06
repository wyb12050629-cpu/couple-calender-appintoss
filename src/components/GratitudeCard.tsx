'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { updateGratitudeMessage, deleteGratitude } from '@/lib/db';
import { getCharEmoji } from '@/lib/characters';
import type { Gratitude, Tone } from '@/lib/types';
import ConfirmModal from './ConfirmModal';

// Tone-perspective 컬러 (relative coloring): 내 시점 기준 me=핑크, partner=블루
const cardBgByTone: Record<Tone, string> = {
  me:      '#FCE8EC',
  partner: '#E5EDF5',
  shared:  '#FAF6EE',
};
const tapeByTone: Record<Tone, string> = {
  me:      '#D4A574',
  partner: '#A8C4D4',
  shared:  '#D4A574',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

type Props = {
  gratitude: Gratitude;
  index:     number;
  onDeleted: (id: string) => void;
  onUpdated: (id: string, message: string) => void;
  onError:   (msg: string) => void;
};

export default function GratitudeCard({ gratitude, index, onDeleted, onUpdated, onError }: Props) {
  const { uid, profile } = useUser();
  const [showMenu,    setShowMenu]    = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [editText,    setEditText]    = useState(gratitude.message);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fadingOut,   setFadingOut]   = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef     = useRef<HTMLDivElement>(null);

  const isFromMe: boolean = gratitude.fromUid === uid;
  const tone: Tone        = isFromMe ? 'me' : 'partner';
  const rotation = index % 2 === 0 ? 'rotate-[-1deg]' : 'rotate-[1deg]';

  // 동적 이름 / 이모지
  const fromName = isFromMe
    ? (profile?.nickname        ?? '나')
    : (profile?.partnerNickname ?? '상대방');
  const charType = isFromMe
    ? profile?.characterType
    : profile?.partnerCharacter;
  const charEmoji = getCharEmoji(charType ?? null);

  // 메뉴 외부 클릭 닫기
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  const handleSaveEdit = useCallback(async () => {
    if (!editText.trim() || editText.trim() === gratitude.message) {
      setEditing(false);
      return;
    }
    if (!profile?.coupleId) return;

    onUpdated(gratitude.id, editText.trim());
    setEditing(false);

    try {
      await updateGratitudeMessage(profile.coupleId, gratitude.id, editText.trim());
    } catch {
      onUpdated(gratitude.id, gratitude.message);
      onError('수정에 실패했어요. 다시 시도해주세요.');
    }
  }, [editText, gratitude.id, gratitude.message, onUpdated, onError, profile?.coupleId]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setEditing(false); setEditText(gratitude.message); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void handleSaveEdit();
  }, [gratitude.message, handleSaveEdit]);

  const handleDelete = async () => {
    setShowConfirm(false);
    setFadingOut(true);
    setTimeout(async () => {
      onDeleted(gratitude.id);
      if (!profile?.coupleId) return;
      try {
        await deleteGratitude(profile.coupleId, gratitude.id);
      } catch {
        onError('삭제에 실패했어요. 다시 시도해주세요.');
      }
    }, 300);
  };

  return (
    <>
      <div
        className={`relative rounded-md p-4 transition-all duration-300 ${rotation} ${
          fadingOut ? 'opacity-0 scale-95' : 'opacity-100'
        }`}
        style={{
          backgroundColor: cardBgByTone[tone],
          boxShadow: '0 8px 24px -8px rgba(58, 47, 37, 0.15)',
        }}
      >
        {/* 테이프 장식 */}
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-[30%] h-3.5 rounded-sm opacity-40"
          style={{ backgroundColor: tapeByTone[tone] }}
        />

        {/* 상단: 이름 + 메뉴 */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold ${
            tone === 'me' ? 'text-me' : 'text-partner'
          }`}>
            {fromName}
            {gratitude.updatedAt && (
              <span className="ml-1.5 text-[10px] font-normal text-caption/50">수정됨</span>
            )}
          </span>
          {isFromMe && !editing && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-caption/40 hover:text-caption/70 transition-colors rounded"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-7 bg-paper border border-line rounded-lg shadow-lg overflow-hidden z-10 min-w-[100px]">
                  <button
                    onClick={() => { setShowMenu(false); setEditing(true); setEditText(gratitude.message); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-ink hover:bg-line/30 transition-colors"
                  >
                    <Pencil size={12} /> 수정
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); setShowConfirm(true); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-me hover:bg-me/10 transition-colors"
                  >
                    <Trash2 size={12} /> 삭제
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 본문 */}
        {editing ? (
          <div>
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value.slice(0, 200))}
              onKeyDown={handleEditKeyDown}
              rows={3}
              className="w-full px-3 py-2 bg-white/60 border border-line rounded-md text-sm outline-none resize-none focus:ring-2 focus:ring-shared/30 text-ink"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-caption/50">{editText.length}/200 · Esc 취소 · ⌘+Enter 저장</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(false); setEditText(gratitude.message); }}
                  className="px-3 py-1 text-xs font-medium text-caption border border-line rounded-md hover:bg-line/30 transition-colors"
                >취소</button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editText.trim()}
                  className="px-3 py-1 text-xs font-medium text-white bg-shared rounded-md disabled:opacity-50 hover:bg-shared/90 transition-colors"
                >저장</button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink leading-relaxed font-medium whitespace-pre-wrap">{gratitude.message}</p>
        )}

        {/* 하단: 시간 + 캐릭터 */}
        {!editing && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-[10px] font-normal text-caption/60">{timeAgo(gratitude.createdAt)}</span>
            <span className="text-xl leading-none">{charEmoji}</span>
          </div>
        )}
      </div>

      {showConfirm && (
        <ConfirmModal
          title="소중한 추억을 정말 지울까요?"
          message="삭제하면 다시 되돌릴 수 없어요."
          confirmLabel="삭제하기"
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
