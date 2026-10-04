import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Shimmer skeleton بدل الـ spinners. */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'cards') {
      <div class="sk-cards" aria-hidden="true">
        @for (i of items(); track i) {
          <div class="sk sk-card"></div>
        }
      </div>
    } @else {
      <div class="sk-rows" role="status" aria-label="جاري التحميل">
        @for (i of items(); track i) {
          <div class="sk-row">
            <span class="sk sk-dot"></span>
            <span class="sk sk-bar w-35"></span>
            <span class="sk sk-bar w-20"></span>
            <span class="sk sk-bar w-15"></span>
          </div>
        }
      </div>
    }
  `,
})
export class SkeletonComponent {
  readonly variant = input<'rows' | 'cards'>('rows');
  readonly count = input(5);
  readonly items = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
