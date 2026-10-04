import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-host" aria-live="polite" aria-atomic="false">
      @for (t of toasts.toasts(); track t.id) {
        <div class="app-toast" [class]="'app-toast app-toast-' + t.kind" role="status">
          <i class="fa-solid" [class]="icon(t.kind)" aria-hidden="true"></i>
          <span>{{ t.message }}</span>
          <button type="button" class="btn-close" aria-label="إغلاق" (click)="toasts.dismiss(t.id)"></button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  readonly toasts = inject(ToastService);

  icon(kind: string): string {
    switch (kind) {
      case 'success':
        return 'fa-circle-check';
      case 'danger':
        return 'fa-circle-exclamation';
      case 'warning':
        return 'fa-triangle-exclamation';
      default:
        return 'fa-circle-info';
    }
  }
}
