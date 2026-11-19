import { TimeBlock } from '../types/schedule';

export const MINUTES_IN_DAY = 1440;

export function clampMinute(m: number): number {
  const mod = ((Math.round(m) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  return mod;
}

/**
 * Convert minutes (0..1440) to SVG angle in degrees where 0° is at 3 o'clock,
 * increasing clockwise.
 */
export function minutesToSvgAngle(
  minutes: number,
  zeroPosition: 'top' | 'bottom'
): number {
  const normalized = minutes / MINUTES_IN_DAY;
  const offset = zeroPosition === 'top' ? -90 : 90;
  return normalized * 360 + offset;
}

/**
 * Convert pointer coordinates around (cx, cy) into snapped minutes (0..1439).
 */
export function pointToMinutes(
  x: number,
  y: number,
  cx: number,
  cy: number,
  zeroPosition: 'top' | 'bottom',
  snapMinutes: number
): number {
  const rad = Math.atan2(y - cy, x - cx);
  let deg = (rad * 180) / Math.PI;
  const offset = zeroPosition === 'top' ? -90 : 90;
  let clockDeg = (deg - offset) % 360;
  if (clockDeg < 0) clockDeg += 360;

  const rawMinutes = (clockDeg / 360) * MINUTES_IN_DAY;
  const snapped = Math.round(rawMinutes / snapMinutes) * snapMinutes;
  return snapped >= MINUTES_IN_DAY ? 0 : snapped;
}

export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

/**
 * Build a clean SVG annular sector path from startAngleDeg to endAngleDeg clockwise.
 */
export function describeAnnularArc(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  let sweep = endAngleDeg - startAngleDeg;
  if (sweep <= 0) sweep += 360;
  // Cap just under 360 to prevent degenerate SVG arc
  if (sweep >= 359.9) sweep = 359.9;

  const endDeg = startAngleDeg + sweep;
  const largeArc = sweep > 180 ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, rOuter, startAngleDeg);
  const outerEnd = polarToCartesian(cx, cy, rOuter, endDeg);
  const innerEnd = polarToCartesian(cx, cy, rInner, endDeg);
  const innerStart = polarToCartesian(cx, cy, rInner, startAngleDeg);

  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export function getDurationMinutes(startMinutes: number, endMinutes: number): number {
  if (endMinutes === startMinutes) return 0;
  if (endMinutes > startMinutes) return endMinutes - startMinutes;
  return MINUTES_IN_DAY - startMinutes + endMinutes;
}

export function formatMinutes(minutes: number, allow24 = false): string {
  if (allow24 && minutes === MINUTES_IN_DAY) return '24:00';
  const m = clampMinute(minutes);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function formatDuration(totalMinutes: number): string {
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function isMinuteInBlock(minute: number, block: TimeBlock): boolean {
  const m = clampMinute(minute);
  const s = clampMinute(block.startMinutes);
  const e = block.endMinutes === MINUTES_IN_DAY ? MINUTES_IN_DAY : clampMinute(block.endMinutes);
  if (e === s) return false;
  if (e > s) {
    return m >= s && m < e;
  }
  // Wraps past 24:00
  return m >= s || m < e;
}

export function getRemainingMinutesInBlock(minute: number, block: TimeBlock): number {
  const m = clampMinute(minute);
  const e = block.endMinutes === MINUTES_IN_DAY ? MINUTES_IN_DAY : clampMinute(block.endMinutes);
  if (e > m) return e - m;
  return MINUTES_IN_DAY - m + e;
}

/**
 * Parse flexible time inputs from Excel / CSV / user input:
 * - Excel fractional day number (0.0 .. 1.0, e.g., 0.375 -> 09:00)
 * - "HH:MM", "H:MM", "HH:MM:SS"
 * - "9:30 AM", "11:15 PM"
 * - "24:00" -> 1440
 * - Decimal hours (e.g., 14.5 -> 14:30)
 */
export function parseFlexibleTime(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;

  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    // Excel time serials can include date integer part (e.g. 45123.375)
    if (raw >= 0 && raw <= 1) {
      const mins = Math.round(raw * MINUTES_IN_DAY);
      return mins >= MINUTES_IN_DAY ? MINUTES_IN_DAY : mins;
    }
    if (raw > 1 && raw <= 24) {
      const mins = Math.round(raw * 60);
      return mins >= MINUTES_IN_DAY ? MINUTES_IN_DAY : mins;
    }
    if (raw > 24) {
      const frac = raw - Math.floor(raw);
      return Math.round(frac * MINUTES_IN_DAY);
    }
  }

  const str = String(raw).trim();
  if (!str) return null;

  if (/^24:00(:00)?$/.test(str)) {
    return MINUTES_IN_DAY;
  }

  // Match 12-hour or 24-hour clock strings
  const match = str.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (match) {
    let hh = parseInt(match[1], 10);
    const mm = parseInt(match[2], 10);
    const meridiem = match[3]?.toLowerCase();

    if (meridiem === 'pm' && hh < 12) hh += 12;
    if (meridiem === 'am' && hh === 12) hh = 0;

    if (hh === 24 && mm === 0) return MINUTES_IN_DAY;
    if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
      return hh * 60 + mm;
    }
  }

  // Match plain hour like "9" or "18"
  const numOnly = Number(str);
  if (!Number.isNaN(numOnly) && numOnly >= 0 && numOnly <= 24) {
    return Math.round(numOnly * 60);
  }

  return null;
}

/**
 * Compute total unique scheduled minutes across the 00-24 dial (accounting for overlaps).
 */
export function computeScheduledCoverage(blocks: TimeBlock[]): {
  totalMinutes: number;
  overlapMinutes: number;
  overlapIds: Set<string>;
} {
  const counts = new Uint16Array(MINUTES_IN_DAY);
  const overlapIds = new Set<string>();

  for (const b of blocks) {
    const dur = getDurationMinutes(b.startMinutes, b.endMinutes);
    for (let i = 0; i < dur; i++) {
      const m = (b.startMinutes + i) % MINUTES_IN_DAY;
      counts[m] += 1;
    }
  }

  let totalMinutes = 0;
  let overlapMinutes = 0;
  for (let m = 0; m < MINUTES_IN_DAY; m++) {
    if (counts[m] > 0) totalMinutes++;
    if (counts[m] > 1) overlapMinutes++;
  }

  for (const b of blocks) {
    const dur = getDurationMinutes(b.startMinutes, b.endMinutes);
    for (let i = 0; i < dur; i++) {
      const m = (b.startMinutes + i) % MINUTES_IN_DAY;
      if (counts[m] > 1) {
        overlapIds.add(b.id);
        break;
      }
    }
  }

  return { totalMinutes, overlapMinutes, overlapIds };
}
