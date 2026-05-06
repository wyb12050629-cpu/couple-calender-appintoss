'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

type Props = {
  message: string;
  type?: 'success' | 'error';
  onDismiss: () => void;
};

export default function Toast({ message, type = 'success', onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-32px)] max-w-[398px] animate-slide-down">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
        type === 'error'
          ? 'bg-yubin/10 border-yubin/30 text-yubin'
          : 'bg-paper border-line text-ink'
      }`}>
        <span className="text-sm font-medium flex-1">{message}</span>
        <button onClick={onDismiss} className="text-ink/40 hover:text-ink/60 flex-shrink-0">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
