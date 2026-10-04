import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type KpiTone = 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';

@Component({
  selector: 'app-kpi-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="kpi">
      <span [class]="'kpi-icon tone-' + tone()" aria-hidden="true"><i class="fa-solid" [class]="icon()"></i></span>
      <div class="kpi-body">
        <span class="kpi-label">{{ label() }}</span>
        <strong class="kpi-value">{{ value() }}</strong>
        @if (hint()) {
          <span class="kpi-hint">{{ hint() }}</span>
        }
      </div>
      @if (trend() !== null) {
        <span class="kpi-trend" [class.up]="trendUp()" [class.down]="!trendUp()">
          <i class="fa-solid" [class]="trendUp() ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'" aria-hidden="true"></i>
          {{ trendAbs() }}%
        </span>
      }
    </article>
  `,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input('fa-chart-simple');
  readonly tone = input<KpiTone>('indigo');
  readonly hint = input('');
  /** نسبة التغيّر (اختياري): موجبة = ارتفاع. */
  readonly trend = input<number | null>(null);

  readonly trendUp = computed(() => (this.trend() ?? 0) >= 0);
  readonly trendAbs = computed(() => Math.abs(this.trend() ?? 0));
}
