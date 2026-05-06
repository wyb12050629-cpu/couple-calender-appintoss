// ──────────────────────────────────────────────────
// 우리 사이 - 날짜 유틸리티
// 프로필 기반 동적 기념일/생일/D-Day 계산
// ──────────────────────────────────────────────────

export const MONTH_NAMES = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
];

/** YYYY-MM-DD → Date (KST 안전) */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 두 날짜 사이 일수 (today - base, 0-indexed) */
export function daysBetween(base: Date, target: Date): number {
  const b = new Date(base); b.setHours(0, 0, 0, 0);
  const t = new Date(target); t.setHours(0, 0, 0, 0);
  return Math.floor((t.getTime() - b.getTime()) / 86400000);
}

// ──────────────────────────────────────────────
// D+N 계산
// ──────────────────────────────────────────────
export function getDDay(anniversaryDate: string): number {
  if (!anniversaryDate) return 0;
  const base = parseDate(anniversaryDate);
  const today = new Date();
  return daysBetween(base, today) + 1;
}

// ──────────────────────────────────────────────
// 기념일 마커 타입
// ──────────────────────────────────────────────
export type DayMarker = {
  type: 'anniversary' | 'milestone' | 'birthday-my' | 'birthday-partner';
  label: string;
  emoji: string;
};

/**
 * 특정 날짜에 해당하는 기념일 마커들을 반환한다.
 * - 100일 단위 마일스톤 (D+100, D+200, ...)
 * - 연 기념일 (1주년, 2주년, ...)
 * - 내/상대방 생일
 */
export function getDayMarkers(
  date: Date,
  anniversaryDate: string,
  myBirthday: string,      // MM-DD
  partnerBirthday: string, // MM-DD
  myNickname: string,
  partnerNickname: string,
): DayMarker[] {
  const markers: DayMarker[] = [];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const mdStr = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // ── 생일 ──
  if (myBirthday && myBirthday === mdStr) {
    markers.push({ type: 'birthday-my', label: `${myNickname} 생일`, emoji: '🎂' });
  }
  if (partnerBirthday && partnerBirthday === mdStr) {
    markers.push({ type: 'birthday-partner', label: `${partnerNickname} 생일`, emoji: '🎂' });
  }

  // ── 기념일 기반 마커 ──
  if (!anniversaryDate) return markers;
  const base = parseDate(anniversaryDate);
  const diff = daysBetween(base, date); // 0 = 당일

  if (diff < 0) return markers;

  // 연 기념일 (정수 년도, 기준일과 동일한 월/일)
  const baseMonth = base.getMonth() + 1;
  const baseDay = base.getDate();
  if (m === baseMonth && d === baseDay && diff > 0) {
    const years = date.getFullYear() - base.getFullYear();
    markers.push({
      type: 'anniversary',
      label: `${years}주년 🥂`,
      emoji: '💜',
    });
  }

  // 당일 (D+1 = 0일 차)
  if (diff === 0) {
    markers.push({ type: 'milestone', label: 'D+1 ✨', emoji: '💕' });
  }

  // 100일 단위 마일스톤 (D+100, D+200, D+300 ...)
  // diff+1 = D+N 값
  const dPlus = diff + 1;
  if (dPlus > 0 && dPlus % 100 === 0) {
    markers.push({
      type: 'milestone',
      label: `D+${dPlus}`,
      emoji: '🎉',
    });
  }

  return markers;
}

// ──────────────────────────────────────────────
// 오늘 마커 (DdayBanner용 — 생일/기념일 뱃지)
// ──────────────────────────────────────────────
export function getTodayMarker(
  anniversaryDate: string,
  myBirthday: string,
  partnerBirthday: string,
  myNickname: string,
  partnerNickname: string,
): DayMarker | null {
  const today = new Date();
  const markers = getDayMarkers(today, anniversaryDate, myBirthday, partnerBirthday, myNickname, partnerNickname);
  return markers[0] ?? null;
}

// ──────────────────────────────────────────────
// 캘린더 유틸리티
// ──────────────────────────────────────────────
export function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

export function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ──────────────────────────────────────────────
// 하위 호환: 기존 코드에서 참조하는 함수들
// (deprecated — 새 코드는 getDayMarkers 사용)
// ──────────────────────────────────────────────
/** @deprecated use getDayMarkers */
export function getDDay_legacy(): number {
  return 0;
}
/** @deprecated use getDayMarkers */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isBirthday(_date: Date): null {
  return null;
}
/** @deprecated use getDayMarkers */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isAnniversaryDate(_date: Date): boolean {
  return false;
}
