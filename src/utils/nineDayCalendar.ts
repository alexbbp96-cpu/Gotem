export interface NineDayInfo {
  /** 1-based index in the 9-day week (1..9) */
  dayOfWeekIndex: number;
  /** Name of the day in the 9-day week */
  weekdayName: string;
  /** Short 3-letter label */
  shortName: string;
  /** Day of month number (1..31) */
  dayOfMonth: number;
  /** Short month name (e.g. Nov) */
  monthShort: string;
  /** 4-digit year */
  year: number;
}

export const NINE_DAY_WEEK: ReadonlyArray<{
  index: number;
  name: string;
  short: string;
}> = [
  { index: 1, name: 'Monday', short: 'Mon' },
  { index: 2, name: 'Tuesday', short: 'Tue' },
  { index: 3, name: 'Wednesday', short: 'Wed' },
  { index: 4, name: 'Thursday', short: 'Thu' },
  { index: 5, name: 'Friday', short: 'Fri' },
  { index: 6, name: 'Saturday', short: 'Sat' },
  { index: 7, name: 'Sunday', short: 'Sun' },
  { index: 8, name: 'Treesday', short: 'Tre' },
  { index: 9, name: 'Sarsday', short: 'Sar' },
];

/**
 * Default anchor offset so 2026-11-16 (Monday) is Day 1 (Monday),
 * 2026-11-18 is Day 3 (Wednesday), 2026-11-23 is Day 8 (Treesday),
 * and 2026-11-24 is Day 9 (Sarsday).
 */
export const DEFAULT_ANCHOR_DATE_ISO = '2026-11-16';

function toUtcDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
  );
}

function parseIsoDateLocal(iso: string): Date {
  const parts = iso.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(2026, 10, 16);
}

export function getNineDayInfo(
  date: Date,
  anchorIso: string = DEFAULT_ANCHOR_DATE_ISO
): NineDayInfo {
  const anchorDate = parseIsoDateLocal(anchorIso);
  const diffDays = toUtcDayNumber(date) - toUtcDayNumber(anchorDate);
  const zeroBasedIdx = ((diffDays % 9) + 9) % 9;
  const entry = NINE_DAY_WEEK[zeroBasedIdx];

  return {
    dayOfWeekIndex: entry.index,
    weekdayName: entry.name,
    shortName: entry.short,
    dayOfMonth: date.getDate(),
    monthShort: date.toLocaleDateString('en-US', { month: 'short' }),
    year: date.getFullYear(),
  };
}

/**
 * Given a desired 1..9 weekday index for `referenceDate`,
 * compute the corresponding Day-1 (Monday) anchor ISO date.
 */
export function computeAnchorIsoForTodayWeekday(
  referenceDate: Date,
  targetDayIndex: number
): string {
  const clamped = Math.max(1, Math.min(9, targetDayIndex));
  const anchor = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - (clamped - 1)
  );
  const y = anchor.getFullYear();
  const m = String(anchor.getMonth() + 1).padStart(2, '0');
  const d = String(anchor.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatNineDayDateLine(info: NineDayInfo): string {
  return `${info.weekdayName} · ${info.dayOfMonth} ${info.monthShort} · ${info.year}`;
}
