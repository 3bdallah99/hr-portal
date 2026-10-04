import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Slide-over من جهة نهاية السطر (يسار في RTL). */
@Component({
  selector: 'app-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
  template: `
    @if (open()) {
      <div class="drawer-backdrop" (click)="closed.emit()"></div>
      <aside class="drawer-panel" [class.wide]="width() === 'lg'" role="dialog" aria-modal="true" [attr.aria-label]="heading()">
        <header class="drawer-head">
          <div>
            <h2>{{ heading() }}</h2>
            @if (subtitle()) {
              <p>{{ subtitle() }}</p>
            }
          </div>
          <button type="button" class="icon-btn" aria-label="إغلاق" (click)="closed.emit()">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </header>
        <div class="drawer-body"><ng-content /></div>
      </aside>
    }
  `,
})
export class DrawerComponent {
  readonly open = input.required<boolean>();
  readonly heading = input.required<string>();
  readonly subtitle = input('');
  readonly width = input<'md' | 'lg'>('md');
  readonly closed = output<void>();
}
