import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'confirm.answer(false)' },
  template: `
    @if (confirm.pending(); as p) {
      <div class="modal-backdrop fade show"></div>
      <div class="modal fade show d-block" tabindex="-1" role="alertdialog" aria-modal="true">
        <div class="modal-dialog modal-dialog-centered modal-sm-confirm">
          <div class="modal-content">
            <div class="modal-body confirm-body">
              <div class="confirm-icon" [class.is-danger]="p.options.tone !== 'primary'">
                <i
                  class="fa-solid"
                  [class]="p.options.tone === 'primary' ? 'fa-circle-question' : 'fa-triangle-exclamation'"
                  aria-hidden="true"
                ></i>
              </div>
              <h2 class="confirm-title">{{ p.options.title }}</h2>
              <p class="confirm-text">{{ p.options.message }}</p>
              <div class="d-flex gap-2 justify-content-center">
                <button type="button" class="btn btn-light border" (click)="confirm.answer(false)">
                  {{ p.options.cancelText ?? 'إلغاء' }}
                </button>
                <button
                  type="button"
                  class="btn"
                  [class]="p.options.tone === 'primary' ? 'btn btn-primary' : 'btn btn-danger'"
                  (click)="confirm.answer(true)"
                >
                  {{ p.options.confirmText ?? 'تأكيد' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  readonly confirm = inject(ConfirmService);
}
