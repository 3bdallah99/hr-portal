import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output } from '@angular/core';

/** Modal خفيف بدون Bootstrap JS: يقفل بالـ Esc أو بالضغط على الخلفية. */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
  template: `
    @if (open()) {
      <div class="modal-backdrop fade show"></div>
      <div
        class="modal fade show d-block"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        (mousedown)="onBackdrop($event)"
      >
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable" [class.modal-lg]="size() === 'lg'">
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title">{{ title() }}</h2>
              <button type="button" class="btn-close ms-0" aria-label="إغلاق" (click)="closed.emit()"></button>
            </div>
            <div class="modal-body">
              <ng-content />
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly size = input<'md' | 'lg'>('md');
  readonly closed = output<void>();

  private readonly body = inject(DOCUMENT).body;

  constructor() {
    effect(() => this.body.classList.toggle('modal-open', this.open()));
    inject(DestroyRef).onDestroy(() => this.body.classList.remove('modal-open'));
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }
}
