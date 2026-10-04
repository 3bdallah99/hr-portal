export type LeaveTypeKey = 'Sick' | 'Vacation' | 'Unpaid' | 'Casual';
export type LeaveStatusKey = 'pending' | 'approved' | 'rejected' | 'cancelled';

export const LEAVE_TYPES: ReadonlyArray<{ value: number; key: LeaveTypeKey; label: string }> = [
  { value: 1, key: 'Vacation', label: 'اعتيادي' },
  { value: 0, key: 'Sick', label: 'مرضي' },
  { value: 3, key: 'Casual', label: 'عارضة' },
  { value: 2, key: 'Unpaid', label: 'بدون مرتب' },
];

/** الـ API قد يرجع القيمة رقمًا أو اسمًا — نوحّدها هنا. */
export function leaveTypeKey(value: string | number | null | undefined): LeaveTypeKey | null {
  if (value === null || value === undefined || value === '') return null;
  const asNumber = Number(value);
  if (!Number.isNaN(asNumber)) return LEAVE_TYPES.find((t) => t.value === asNumber)?.key ?? null;
  const name = String(value).toLowerCase();
  return LEAVE_TYPES.find((t) => t.key.toLowerCase() === name)?.key ?? null;
}

export function leaveTypeLabel(value: string | number | null | undefined): string {
  const key = leaveTypeKey(value);
  return LEAVE_TYPES.find((t) => t.key === key)?.label ?? String(value ?? '-');
}

const STATUS_BY_NUMBER: LeaveStatusKey[] = ['pending', 'approved', 'rejected', 'cancelled'];

export function leaveStatusKey(value: string | number | null | undefined): LeaveStatusKey {
  const asNumber = Number(value);
  if (value !== null && value !== undefined && value !== '' && !Number.isNaN(asNumber)) {
    return STATUS_BY_NUMBER[asNumber] ?? 'pending';
  }
  const name = String(value ?? '').toLowerCase();
  return STATUS_BY_NUMBER.find((s) => s === name) ?? 'pending';
}

export const LEAVE_STATUS_LABELS: Record<LeaveStatusKey, string> = {
  pending: 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
};

/** عدد الأيام شاملًا يوم البداية والنهاية. */
export function inclusiveDays(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0;
  const a = Date.parse(start.slice(0, 10));
  const b = Date.parse(end.slice(0, 10));
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}
