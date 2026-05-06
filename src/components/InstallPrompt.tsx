'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-[398px] mx-auto bg-paper rounded-lg shadow-md p-4 z-50 animate-slide-up border border-line">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-shared/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Download size={18} className="text-shared" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm mb-1 text-ink">홈 화면에 추가하기</p>
          <p className="text-xs text-ink/40">앱처럼 바로 열 수 있어요!</p>
        </div>
        <button onClick={handleDismiss} className="text-ink/30 p-1">
          <X size={16} />
        </button>
      </div>
      <button
        onClick={handleInstall}
        className="w-full mt-3 py-2.5 bg-paper border-2 border-shared text-shared rounded-lg text-sm font-bold active:scale-[0.98] transition-all hover:bg-shared hover:text-white"
      >
        설치하기 💕
      </button>
    </div>
  );
}
