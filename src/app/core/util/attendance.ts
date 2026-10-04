import { AttendanceRecord } from '../models';

export type AttendanceKey = 'present' | 'late' | 'absent';

const BY_NUMBER: AttendanceKey[] = ['present', 'late', 'absent'];

export const ATTENDANCE_LABELS: Record<AttendanceKey, string> = {
  present: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
};

/** يوحّد الحالة سواء رجعت رقمًا أو اسمًا أو لم ترجع (نستنتجها من البصمة والتأخير). */
export function attendanceKey(r: Pick<AttendanceRecord, 'status' | 'lateMinutes' | 'clockIn'>): AttendanceKey {
  const s = r.status;
  if (s !== null && s !== undefined && s !== '') {
    const n = Number(s);
    if (!Number.isNaN(n)) return BY_NUMBER[n] ?? 'present';
    const name = String(s).toLowerCase();
    if (name === 'present' || name === 'late' || name === 'absent') return name;
  }
  if (!r.clockIn) return 'absent';
  return r.lateMinutes > 0 ? 'late' : 'present';
}

/** يعرض HH:mm من "09:05:00" أو "2026-10-01T09:05:00" بدون تحويل توقيت. */
export function clockText(value: string | null | undefined): string {
  if (!value) return '—';
  const iso = value.indexOf('T');
  const t = iso >= 0 ? value.slice(iso + 1) : value;
  return /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : '—';
}

/** للحقل type=time (يرجع '' لو فاضي). */
export function clockInput(value: string | null | undefined): string {
  const t = clockText(value);
  return t === '—' ? '' : t;
}

/**
 * يبني قيمة الإرسال بنفس شكل القيمة الأصلية:
 * DateTime (فيه T) → "yyyy-MM-ddTHH:mm:00"، وإلا TimeSpan → "HH:mm:00".
 */
export function toClockPayload(original: string | null | undefined, date: string, hhmm: string): string | null {
  if (!hhmm) return null;
  if (original && original.includes('T')) return `${original.slice(0, 10)}T${hhmm}:00`;
  return `${hhmm}:00`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** من "2026-10" (حقل type=month) إلى {year, month}. */
export function parseMonthInput(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

export function currentMonthInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
