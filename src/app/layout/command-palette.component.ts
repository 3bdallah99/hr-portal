import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AutofocusDirective } from '../shared/ui/autofocus.directive';

export interface PaletteItem {
  label: string;
  path: string;
  icon: string;
  group: string;
}

/** Ctrl/⌘ + K — تنقّل سريع بين الصفحات مع تنقّل بالأسهم. */
@Component({
  selector: 'app-command-palette',
  imports: [AutofocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
  template: `
    @if (open()) {
      <div class="cmdk-backdrop" (click)="closed.emit()"></div>
      <div class="cmdk" role="dialog" aria-modal="true" aria-label="بحث سريع">
        <div class="cmdk-input">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input
            appAutofocus
            type="text"
            placeholder="اذهب إلى… (مثال: رواتب، حضور، موظفون)"
            aria-label="بحث سريع"
            [value]="query()"
            (input)="onQuery($any($event.target).value)"
            (keydown.arrowdown)="move(1, $event)"
            (keydown.arrowup)="move(-1, $event)"
            (keydown.enter)="choose()"
          />
          <kbd>Esc</kbd>
        </div>
        <ul class="cmdk-list" role="listbox">
          @for (item of filtered(); track item.path; let i = $index) {
            @if (i === 0 || filtered()[i - 1].group !== item.group) {
              <li class="cmdk-group" role="presentation">{{ item.group }}</li>
            }
            <li role="presentation">
              <button type="button" role="option" class="cmdk-item" [class.active]="i === active()"
                      [attr.aria-selected]="i === active()" (mouseenter)="active.set(i)" (click)="go(item)">
                <i class="fa-solid" [class]="item.icon" aria-hidden="true"></i>
                <span>{{ item.label }}</span>
                <span class="go"><i class="fa-solid fa-arrow-turn-down fa-rotate-90" aria-hidden="true"></i></span>
              </button>
            </li>
          } @empty {
            <li class="cmdk-empty">لا توجد نتائج لـ «{{ query() }}»</li>
          }
        </ul>
        <div class="cmdk-foot">
          <span><kbd>↑</kbd> <kbd>↓</kbd> للتنقل</span>
          <span><kbd>Enter</kbd> للفتح</span>
          <span><kbd>Esc</kbd> للإغلاق</span>
        </div>
      </div>
    }
  `,
})
export class CommandPaletteComponent {
  private readonly router = inject(Router);

  readonly open = input.required<boolean>();
  readonly items = input.required<PaletteItem[]>();
  readonly closed = output<void>();

  readonly query = signal('');
  readonly active = signal(0);

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.items().filter((i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)) : this.items();
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.query.set('');
        this.active.set(0);
      }
    });
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.active.set(0);
  }

  move(delta: number, event: Event): void {
    event.preventDefault();
    const n = this.filtered().length;
    if (n) this.active.update((i) => (i + delta + n) % n);
  }

  choose(): void {
    const item = this.filtered()[this.active()];
    if (item) this.go(item);
  }

  go(item: PaletteItem): void {
    this.closed.emit();
    void this.router.navigateByUrl(item.path);
  }
}
