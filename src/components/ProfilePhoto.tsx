'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useUser } from '@/context/UserContext';
import { getCharImage, getCharEmoji } from '@/lib/characters';

type Props = {
  size?: number;
};

/**
 * 우리 사이 — 프로필 사진 표시 컴포넌트
 * v1: 사진 업로드 기능 제거. 온보딩에서 고른 캐릭터 이미지/이모지만 표시.
 */
export default function ProfilePhoto({ size = 44 }: Props) {
  const { profile } = useUser();
  const [imgError, setImgError] = useState(false);

  const charImage = getCharImage(profile?.characterType);
  const charEmoji = getCharEmoji(profile?.characterType);
  const showImage = charImage && !imgError;

  return (
    <div
      className="relative rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
      style={{ width: size, height: size, background: 'var(--paper)' }}
      aria-label="프로필"
    >
      {showImage ? (
        <Image
          src={charImage}
          alt={profile?.nickname || '프로필'}
          fill
          className="object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="flex items-center justify-center w-full h-full"
          style={{ fontSize: size * 0.5 }}
        >
          {charEmoji}
        </span>
      )}
    </div>
  );
}
