'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, User, Heart, HandHeart } from 'lucide-react';

const tabs = [
  { href: '/', label: '캘린더', icon: CalendarDays },
  { href: '/my', label: '내 일정', icon: User },
  { href: '/shared', label: '공동', icon: Heart },
  { href: '/gratitude', label: '감사', icon: HandHeart },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-paper border-t border-line z-50">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                isActive ? 'text-ink' : 'text-[#A89B8C]'
              }`}
            >
              {/* 활성 점 표시 */}
              <span className={`w-1 h-1 rounded-full mb-0.5 transition-colors ${
                isActive ? 'bg-yubin' : 'bg-transparent'
              }`} />
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-normal'}`}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-safe-area-inset-bottom" />
    </nav>
  );
}
