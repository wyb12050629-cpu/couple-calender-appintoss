/**
 * 우리 사이 — 신원/표시 헬퍼
 * ─────────────────────────────────────────────────────
 * Tone('me' | 'partner' | 'shared')은 컴포넌트에서 색·라벨을 분기할 때 쓰는
 * derived 값. 데이터에는 절대 저장하지 말 것 (creatorUid/visibility로 결정).
 *
 * Tailwind 클래스 매핑:
 *   me     → bg-me      / border-l-me      / text-me
 *   partner → bg-partner / border-l-partner / text-partner
 *   shared → bg-shared  / border-l-shared  / text-shared
 * ─────────────────────────────────────────────────────
 */

import type { Event, Gratitude, Tone, UserProfile } from './types';

// ── Event Tone ──
export function getEventTone(ev: Event, myUid: string | null | undefined): Tone {
  if (ev.visibility === 'shared') return 'shared';
  return ev.creatorUid === myUid ? 'me' : 'partner';
}

/** 일정 카드에 노출할 작성자 라벨 */
export function getEventCreatorLabel(ev: Event, profile: UserProfile | null): string {
  if (!profile) return '';
  if (ev.visibility === 'shared') return '함께';
  return ev.creatorUid === profile.uid
    ? (profile.nickname || '나')
    : (profile.partnerNickname || '상대방');
}

// ── Gratitude Tone ──
export function getGratitudeTone(g: Gratitude, myUid: string | null | undefined): Tone {
  // gratitude는 항상 1:1 (shared 없음). 내가 보낸 거면 me, 받은 거면 partner.
  return g.fromUid === myUid ? 'me' : 'partner';
}

export function getGratitudeFromLabel(g: Gratitude, profile: UserProfile | null): string {
  if (!profile) return '';
  return g.fromUid === profile.uid
    ? (profile.nickname || '나')
    : (profile.partnerNickname || '상대방');
}

export function getGratitudeToLabel(g: Gratitude, profile: UserProfile | null): string {
  if (!profile) return '';
  return g.toUid === profile.uid
    ? (profile.nickname || '나')
    : (profile.partnerNickname || '상대방');
}

// ── Tailwind 클래스 헬퍼 ──
const BG: Record<Tone, string>     = { me: 'bg-me',         partner: 'bg-partner',         shared: 'bg-shared' };
const BORDER: Record<Tone, string> = { me: 'border-l-me',   partner: 'border-l-partner',   shared: 'border-l-shared' };
const TEXT: Record<Tone, string>   = { me: 'text-me',       partner: 'text-partner',       shared: 'text-shared' };

export const toneBg     = (t: Tone) => BG[t];
export const toneBorder = (t: Tone) => BORDER[t];
export const toneText   = (t: Tone) => TEXT[t];
