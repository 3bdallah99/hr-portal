import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/ui/theme.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-layout">
      <section class="auth-brand" aria-hidden="true">
        <span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>
        <span class="grid-lines"></span>
        <div class="auth-brand-inner">
          <span class="brand-mark lg"><i class="fa-solid fa-plus"></i></span>
          <h1>إدارة الموارد البشرية بوضوح وسرعة</h1>
          <p>الإجازات والحضور بالبصمة والرواتب — في منصة واحدة، بدون ورق وبدون جداول متفرقة.</p>
          <ul class="auth-points">
            <li><i class="fa-solid fa-circle-check"></i> طلبات إجازة مباشرة للـ HR</li>
            <li><i class="fa-solid fa-circle-check"></i> متابعة التأخير مقابل سماحية 60 دقيقة</li>
            <li><i class="fa-solid fa-circle-check"></i> رواتب تلقائية بخصومات الغياب والتأخير</li>
          </ul>
        </div>
        <div class="glass-card g1"><small>سماحية التأخير</small><strong>42 / 60 دقيقة</strong></div>
        <div class="glass-card g2"><small>صافي الراتب</small><strong>18,450.00 ج.م</strong></div>
      </section>

      <section class="auth-form-wrap">
        <button type="button" class="top-btn auth-theme" [attr.aria-label]="theme.theme() === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'" (click)="theme.toggle()">
          <i class="fa-solid" [class]="theme.theme() === 'dark' ? 'fa-sun' : 'fa-moon'" aria-hidden="true"></i>
        </button>

        <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <h2>أهلًا بعودتك</h2>
          <p class="text-muted mb-4">سجّل الدخول للمتابعة إلى حسابك.</p>

          @if (error(); as message) {
            <div class="alert alert-danger" role="alert">{{ message }}</div>
          }

          <div class="mb-3">
            <label class="form-label" for="email">البريد الإلكتروني</label>
            <input id="email" type="email" class="form-control form-control-lg" formControlName="email"
                   autocomplete="username" dir="ltr" placeholder="name@company.com" [class.is-invalid]="invalid('email')" />
            <div class="invalid-feedback">أدخل بريدًا إلكترونيًا صحيحًا.</div>
          </div>

          <div class="mb-3">
            <label class="form-label" for="password">كلمة المرور</label>
            <div class="input-eye">
              <input id="password" [type]="showPassword() ? 'text' : 'password'" class="form-control form-control-lg" formControlName="password"
                     autocomplete="current-password" dir="ltr" [class.is-invalid]="invalid('password')" />
              <button type="button" class="eye" [attr.aria-label]="showPassword() ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'" (click)="showPassword.set(!showPassword())">
                <i class="fa-regular" [class]="showPassword() ? 'fa-eye-slash' : 'fa-eye'" aria-hidden="true"></i>
              </button>
            </div>
            @if (invalid('password')) {
              <div class="invalid-feedback d-block">أدخل كلمة المرور.</div>
            }
          </div>

          <div class="form-check mb-4">
            <input id="remember" type="checkbox" class="form-check-input" formControlName="remember" />
            <label class="form-check-label" for="remember">تذكّرني على هذا الجهاز</label>
          </div>

          <button type="submit" class="btn btn-primary btn-lg w-100" [disabled]="loading()">
            @if (loading()) {
              <span class="spinner-border spinner-border-sm ms-2" aria-hidden="true"></span>
              جاري التحقق…
            } @else {
              دخول
            }
          </button>

          @if (demo) {
            <button type="button" class="btn btn-link w-100 mt-3 small" (click)="fillDemo()">
              تعبئة بيانات حساب الـ HR التجريبي
            </button>
          }
        </form>
      </section>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly showPassword = signal(false);

  readonly demo = environment.production ? null : environment.demo;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [true],
  });

  invalid(name: 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  fillDemo(): void {
    if (this.demo) this.form.patchValue(this.demo);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password, remember } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    this.auth
      .login(email, password, remember)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          if (!this.auth.session()) {
            this.auth.clear();
            this.error.set('هذا الحساب غير مرتبط بدور صالح. تواصل مع مسؤول النظام.');
            return;
          }
          void this.router.navigateByUrl(this.auth.homeUrl());
        },
        error: (e: Error) => this.error.set(e.message),
      });
  }
}
