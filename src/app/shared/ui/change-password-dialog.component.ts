import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ModalComponent } from './modal.component';
import { ToastService } from './toast.service';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const a = group.get('newPassword')?.value as string;
  const b = group.get('confirmPassword')?.value as string;
  return a && b && a !== b ? { mismatch: true } : null;
}

const STRENGTH_LABELS = ['ضعيفة جدًا', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية'];

@Component({
  selector: 'app-change-password-dialog',
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="'تغيير كلمة المرور'" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="mb-3">
          <label class="form-label" for="cp-current">كلمة المرور الحالية</label>
          <input id="cp-current" type="password" dir="ltr" autocomplete="current-password" class="form-control"
                 formControlName="currentPassword" [class.is-invalid]="invalid('currentPassword')" />
          <div class="invalid-feedback">أدخل كلمة المرور الحالية.</div>
        </div>

        <div class="mb-2">
          <label class="form-label" for="cp-new">كلمة المرور الجديدة</label>
          <input id="cp-new" type="password" dir="ltr" autocomplete="new-password" class="form-control"
                 formControlName="newPassword" [class.is-invalid]="invalid('newPassword')" />
          <div class="invalid-feedback">6 أحرف على الأقل.</div>
        </div>

        <div class="strength mb-3" aria-live="polite">
          <div class="strength-track"><span [class]="'s' + score()" [style.width.%]="(score() + 1) * 20"></span></div>
          <small>{{ strengthLabel() }}</small>
        </div>

        <div class="mb-4">
          <label class="form-label" for="cp-confirm">تأكيد كلمة المرور</label>
          <input id="cp-confirm" type="password" dir="ltr" autocomplete="new-password" class="form-control"
                 formControlName="confirmPassword" [class.is-invalid]="invalid('confirmPassword') || mismatchShown()" />
          <div class="invalid-feedback">{{ form.hasError('mismatch') ? 'كلمتا المرور غير متطابقتين.' : 'أعد كتابة كلمة المرور.' }}</div>
        </div>

        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn btn-light border" (click)="closed.emit()">إلغاء</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm ms-2" aria-hidden="true"></span>
            }
            تحديث كلمة المرور
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class ChangePasswordDialogComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  readonly saving = signal(false);

  readonly form = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** 0..4 بحسب الطول وتنوّع الأحرف. */
  readonly score = computed(() => {
    const p = this.value().newPassword ?? '';
    if (!p) return 0;
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(4, s);
  });
  readonly strengthLabel = computed(() => ((this.value().newPassword ?? '') ? STRENGTH_LABELS[this.score()] : 'اكتب كلمة مرور جديدة'));

  constructor() {
    effect(() => {
      if (this.open()) this.form.reset();
    });
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  mismatchShown(): boolean {
    return this.form.hasError('mismatch') && (this.form.controls.confirmPassword.touched || this.form.controls.confirmPassword.dirty);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.saving.set(true);
    this.auth
      .changePassword(currentPassword, newPassword)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('تم تغيير كلمة المرور');
          this.closed.emit();
        },
        error: () => undefined, // الـ errorInterceptor يعرض الرسالة
      });
  }
}
