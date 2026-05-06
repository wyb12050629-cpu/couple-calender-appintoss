'use client';

import Image from 'next/image';
import { useUser } from '@/context/UserContext';
import { getDDay, getTodayMarker } from '@/lib/dates';
import { getCharImage, getCharEmoji } from '@/lib/characters';

export default function DdayBanner() {
  const { profile } = useUser();

  const myNickname      = profile?.nickname        || '나';
  const partnerNickname = profile?.partnerNickname || '상대방';
  const anniversaryDate = profile?.anniversaryDate || '';
  const myBirthday      = profile?.myBirthday      || '';
  const partnerBirthday = profile?.partnerBirthday || '';

  const dday = anniversaryDate ? getDDay(anniversaryDate) : null;
  const todayMarker = anniversaryDate
    ? getTodayMarker(anniversaryDate, myBirthday, partnerBirthday, myNickname, partnerNickname)
    : null;

  // 내 캐릭터 이미지 (ProfilePhoto 대신 캐릭터 이미지 직접 렌더)
  const charImage = getCharImage(profile?.characterType);
  const charEmoji = getCharEmoji(profile?.characterType);

  return (
    <div className="px-4 pt-3 space-y-2">
      <div className="bg-white border border-[var(--line)] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">

        {/* 캐릭터 이미지 (카메라 아이콘 없음) */}
        <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 bg-gray-50 flex items-center justify-center">
          {charImage ? (
            <Image
              src={charImage}
              alt="내 캐릭터"
              width={44}
              height={44}
              className="object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span style={{ fontSize: 26 }}>{charEmoji}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 truncate">
            {myNickname} &amp; {partnerNickname}
          </p>
          {dday !== null ? (
            <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--me)' }}>
              D+{dday} <span className="text-sm font-normal text-gray-300">💕</span>
            </p>
          ) : (
            <p className="text-sm font-medium text-gray-400">기념일을 설정해보세요 💕</p>
          )}
        </div>
        {/* 우측 이모지 제거됨 */}
      </div>

      {/* 오늘 특별한 날 배너 */}
      {todayMarker && (
        <div className="bg-white border border-[var(--line)] rounded-xl px-4 py-2.5 text-center animate-fade-in shadow-sm">
          <p className="text-base font-bold text-gray-900">
            {todayMarker.emoji} {todayMarker.label} {todayMarker.emoji}
          </p>
        </div>
      )}
    </div>
  );
}
