import type { CharacterType } from './types';

/**
 * 우리 사이 — 캐릭터 정의
 * ─────────────────────────────────────────────────
 * 이미지 파일은 /public/characters/ 에 아래 파일명으로 저장하세요:
 *
 *   poodle_brown.png  → 갈색 푸들
 *   poodle_white.png  → 흰색 푸들
 *   dino.png          → 공룡
 *   bear.png          → 곰돌이
 *   cat_siamese.png   → 샴 고양이
 *   shiba.png         → 시바견
 *   cat_tabby.png     → 고등어 고양이
 *   hamster.png       → 햄스터
 *   quokka.png        → 쿼카
 *   bunny.png         → 토끼
 */

export type CharacterDef = {
  type:   CharacterType;
  label:  string;
  emoji:  string;        // 이미지 없을 때 폴백 이모지
  image:  string;        // /public/characters/ 기준 경로
};

export const CHARACTERS: CharacterDef[] = [
  { type: 'poodle_brown', label: '갈색 푸들', emoji: '🐩', image: '/characters/poodle_brown.png' },
  { type: 'poodle_white', label: '흰색 푸들', emoji: '🐾', image: '/characters/poodle_white.png' },
  { type: 'dino',         label: '공룡',      emoji: '🦕', image: '/characters/dino.png'         },
  { type: 'bear',         label: '곰돌이',    emoji: '🐻', image: '/characters/bear.png'         },
  { type: 'cat_siamese',  label: '샴 고양이', emoji: '🐱', image: '/characters/cat_siamese.png'  },
  { type: 'shiba',        label: '시바견',    emoji: '🐕', image: '/characters/shiba.png'        },
  { type: 'cat_tabby',    label: '줄무늬 고양이', emoji: '🐈', image: '/characters/cat_tabby.png' },
  { type: 'hamster',      label: '햄스터',    emoji: '🐹', image: '/characters/hamster.png'      },
  { type: 'quokka',       label: '쿼카',      emoji: '😊', image: '/characters/quokka.png'       },
  { type: 'bunny',        label: '토끼',      emoji: '🐰', image: '/characters/bunny.png'        },
];

/** CharacterType → CharacterDef 빠른 조회 */
export const CHAR_MAP = Object.fromEntries(
  CHARACTERS.map(c => [c.type, c])
) as Record<CharacterType, CharacterDef>;

/** 이미지 경로 반환 (없으면 null) */
export function getCharImage(type: CharacterType | string | null | undefined): string | null {
  if (!type) return null;
  return CHAR_MAP[type as CharacterType]?.image ?? null;
}

/** 이모지 폴백 반환 */
export function getCharEmoji(type: CharacterType | string | null | undefined): string {
  if (!type) return '💕';
  return CHAR_MAP[type as CharacterType]?.emoji ?? '💕';
}

/** 레이블 반환 */
export function getCharLabel(type: CharacterType | string | null | undefined): string {
  if (!type) return '캐릭터';
  return CHAR_MAP[type as CharacterType]?.label ?? '캐릭터';
}
