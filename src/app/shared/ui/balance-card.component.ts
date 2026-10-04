import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LeaveBalance } from '../../core/models';
import { LeaveTypeKey, leaveTypeKey, leaveTypeLabel } from '../../core/util/leave';

const ICONS: Record<LeaveTypeKey, string> = {
  Vacation: 'fa-umbrella-beach',
  Sick: 'fa-heart-pulse',
  Casual: 'fa-clock',
  Unpaid: 'fa-wallet',
};

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** حلقة تقدّم: المستخدم / الإجمالي. */
@Component({
  selector: 'app-balance-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article [class]="'balance tone-' + tone()">
      <div
        class="ring"
        role="img"
        [attr.aria-label]="label() + ': مستخدم ' + balance().usedDays + ' من ' + balance().totalDays + ' يوم'"
      >
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle class="ring-bg" cx="40" cy="40" [attr.r]="r" />
          <circle
            class="ring-fg"
            cx="40"
            cy="40"
            [attr.r]="r"
            [attr.stroke-dasharray]="c"
            [attr.stroke-dashoffset]="offset()"
          />
        </svg>
        <span class="ring-text"><strong>{{ balance().usedDays }}</strong><small>/ {{ balance().totalDays }}</small></span>
      </div>
      <div class="balance-meta">
        <h3><i class="fa-solid" [class]="icon()" aria-hidden="true"></i> {{ label() }}</h3>
        <p>المتبقي <strong>{{ remaining() }}</strong> يوم</p>
      </div>
    </article>
  `,
})
export class BalanceCardComponent {
  readonly balance = input.required<LeaveBalance>();

  readonly r = RADIUS;
  readonly c = CIRCUMFERENCE;

  private readonly key = computed(() => leaveTypeKey(this.balance().leaveType));
  readonly tone = computed(() => (this.key() ?? 'Vacation').toLowerCase());
  readonly label = computed(() => leaveTypeLabel(this.balance().leaveType));
  readonly icon = computed(() => ICONS[this.key() ?? 'Vacation']);
  readonly remaining = computed(() => Math.max(0, this.balance().totalDays - this.balance().usedDays));
  readonly offset = computed(() => {
    const total = this.balance().totalDays;
    const ratio = total > 0 ? Math.min(1, this.balance().usedDays / total) : 0;
    return CIRCUMFERENCE * (1 - ratio);
  });
}
