import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarItem {
  label: string;
  value: number;
}

@Component({
  selector: 'app-bar-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="bar-list">
      @for (b of bars(); track b.label) {
        <li class="bar-row">
          <header><span>{{ b.label }}</span><strong>{{ b.value }}</strong></header>
          <div class="bar-track"><span [style.width.%]="b.pct"></span></div>
        </li>
      }
    </ul>
  `,
})
export class BarListComponent {
  readonly items = input.required<BarItem[]>();

  readonly bars = computed(() => {
    const max = Math.max(1, ...this.items().map((i) => i.value));
    return this.items().map((i) => ({ ...i, pct: Math.max(4, Math.round((i.value / max) * 100)) }));
  });
}
