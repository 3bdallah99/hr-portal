import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ATTENDANCE_LABELS, AttendanceKey } from '../../core/util/attendance';
import { LEAVE_STATUS_LABELS, leaveStatusKey } from '../../core/util/leave';

/** شارة حالة موحّدة: leave (Pending/Approved/Rejected/Cancelled) و attendance (Present/Late/Absent). */
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="'status status-' + key()" [attr.title]="note() || null" [attr.tabindex]="note() ? 0 : null">
    {{ label() }}
    @if (note()) {
      <i class="fa-solid fa-circle-info ms-1" aria-hidden="true"></i>
    }
  </span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<string | number>();
  readonly kind = input<'leave' | 'attendance'>('leave');
  /** نص يظهر عند المرور بالماوس (مثلًا ملاحظة الرفض). */
  readonly note = input<string | null | undefined>(null);

  readonly key = computed(() => (this.kind() === 'leave' ? leaveStatusKey(this.status()) : String(this.status())));
  readonly label = computed(() =>
    this.kind() === 'leave'
      ? LEAVE_STATUS_LABELS[leaveStatusKey(this.status())]
      : (ATTENDANCE_LABELS[this.status() as AttendanceKey] ?? String(this.status())),
  );
}
