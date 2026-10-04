import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface ChartSegment {
  label: string;
  value: number;
  color: string;
}

const R = 66;
const C = 2 * Math.PI * R;
const GAP = 3;

/** Donut بـ SVG خالص (بدون مكتبات). */
@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut-wrap">
      <div class="donut" role="img" [attr.aria-label]="ariaLabel()">
        <svg viewBox="0 0 160 160" aria-hidden="true">
          <circle class="track" cx="80" cy="80" [attr.r]="r" />
          @for (a of arcs(); track a.label) {
            <circle class="seg" cx="80" cy="80" [attr.r]="r" [attr.stroke]="a.color"
                    [attr.stroke-dasharray]="a.dash" [attr.stroke-dashoffset]="a.offset" />
          }
        </svg>
        <div class="donut-center">
          <strong>{{ total() }}</strong>
          <small>{{ centerLabel() }}</small>
        </div>
      </div>
      <ul class="legend">
        @for (s of segments(); track s.label) {
          <li><i [style.background]="s.color"></i><span>{{ s.label }}</span><strong>{{ s.value }}</strong></li>
        }
      </ul>
    </div>
  `,
})
export class DonutChartComponent {
  readonly segments = input.required<ChartSegment[]>();
  readonly centerLabel = input('الإجمالي');

  readonly r = R;
  readonly total = computed(() => this.segments().reduce((s, x) => s + x.value, 0));

  readonly arcs = computed(() => {
    const total = this.total();
    if (total === 0) return [];
    let acc = 0;
    return this.segments()
      .filter((s) => s.value > 0)
      .map((s) => {
        const len = (s.value / total) * C;
        const visible = Math.max(0, len - (this.segments().filter((x) => x.value > 0).length > 1 ? GAP : 0));
        const arc = { label: s.label, color: s.color, dash: `${visible} ${C - visible}`, offset: -acc };
        acc += len;
        return arc;
      });
  });

  readonly ariaLabel = computed(() => this.segments().map((s) => `${s.label}: ${s.value}`).join('، '));
}
