'use client';

import { useEffect, useCallback } from 'react';

type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({ title, message, confirmLabel = '삭제하기', onConfirm, onCancel }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  }, [onCancel]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 bg-ink/40 z-[60] flex items-center justify-center px-6" onClick={onCancel}>
      <div
        className="bg-paper w-full max-w-[320px] rounded-lg border border-line shadow-lg p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-ink mb-2">{title}</h3>
        <p className="text-sm font-normal text-caption mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-paper border border-line rounded-lg text-sm font-medium text-caption hover:bg-line/30 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-yubin text-white rounded-lg text-sm font-medium hover:bg-yubin/90 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
