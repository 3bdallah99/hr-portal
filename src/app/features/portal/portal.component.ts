import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { LeaveBalance, LeaveRequest, TardinessSummary } from '../../core/models';
import { AttendanceService } from '../../core/services/attendance.service';
import { LeaveService } from '../../core/services/leave.service';
import { LEAVE_TYPES, LeaveStatusKey, inclusiveDays, leaveStatusKey, leaveTypeKey, leaveTypeLabel } from '../../core/util/leave';
import { BalanceCardComponent } from '../../shared/ui/balance-card.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { TardinessMeterComponent } from '../../shared/ui/tardiness-meter.component';
import { ToastService } from '../../shared/ui/toast.service';

function dateRange(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value as string;
  const end = group.get('endDate')?.value as string;
  return start && end && end < start ? { dateRange: true } : null;
}

@Component({
  selector: 'app-portal',
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    ModalComponent,
    BalanceCardComponent,
    StatusBadgeComponent,
    TardinessMeterComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="hero-inner">
        <div>
          <h1>أهلًا، {{ auth.session()?.name || 'بك' }}</h1>
          <p>ملخص أرصدتك وطلباتك لسنة {{ year }}</p>
        </div>
        <div class="hero-actions">
          <button type="button" class="btn btn-light" [disabled]="!employeeId" (click)="openRequest()">
            <i class="fa-solid fa-paper-plane ms-2" aria-hidden="true"></i>طلب إجازة
          </button>
          <a routerLink="/portal/attendance" class="btn btn-ghost"><i class="fa-solid fa-fingerprint ms-2" aria-hidden="true"></i>سجل حضوري</a>
        </div>
      </div>
      @if (employeeId) {
        <div class="hero-stats">
          <div class="hero-stat"><small>أيام إجازة متبقية</small><strong>{{ remainingDays() }}</strong></div>
          <div class="hero-stat"><small>طلبات قيد المراجعة</small><strong>{{ pendingMine() }}</strong></div>
          @if (tardiness(); as t) {
            <div class="hero-stat"><small>تأخير هذا الشهر</small><strong>{{ t.totalLateMinutes }} / {{ t.allowedMinutes || 60 }} د</strong></div>
          }
        </div>
      }
    </section>

    @if (!employeeId) {
      <div class="alert alert-warning" role="alert">حسابك غير مرتبط بسجل موظف. تواصل مع الموارد البشرية لربطه.</div>
    } @else {
      <div class="row g-4">
        <div class="col-xl-8">
          <h2 class="section-title first">أرصدة الإجازات</h2>
          @if (balancesLoading()) {
            <app-skeleton variant="cards" [count]="3" />
          } @else if (balancesError()) {
            <div class="alert alert-danger" role="alert">{{ balancesError() }}</div>
          } @else if (!balances().length) {
            <section class="data-card">
              <app-empty-state icon="fa-wallet" heading="لا توجد أرصدة بعد" text="لم يتم تخصيص أرصدة إجازات لك. تواصل مع الموارد البشرية." />
            </section>
          } @else {
            <div class="balance-grid">
              @for (b of balances(); track b.leaveType) {
                <app-balance-card [balance]="b" />
              }
            </div>
          }
        </div>

        <div class="col-xl-4">
          <h2 class="section-title first">تأخيرك هذا الشهر</h2>
          @if (tardiness(); as t) {
            <app-tardiness-meter [used]="t.totalLateMinutes" [allowed]="t.allowedMinutes || 60" [occurrences]="t.totalOccurrences" />
            <a routerLink="/portal/attendance" class="link-more d-inline-block mt-2">سجل الحضور الكامل <i class="fa-solid fa-arrow-left" aria-hidden="true"></i></a>
          } @else if (tardinessLoading()) {
            <app-skeleton variant="cards" [count]="1" />
          } @else {
            <section class="data-card"><app-empty-state icon="fa-stopwatch" heading="لا تتوفر بيانات التأخير" /></section>
          }
        </div>
      </div>

      <h2 class="section-title">طلباتي</h2>
      <section class="data-card">
        @if (requestsLoading()) {
          <app-skeleton [count]="4" />
        } @else if (requestsError()) {
          <div class="state-cell text-danger">{{ requestsError() }}</div>
        } @else if (!requests().length) {
          <app-empty-state icon="fa-paper-plane" heading="لم تقدّم أي طلبات بعد" text="ابدأ بزر «طلب إجازة» — يصل طلبك مباشرة إلى الموارد البشرية.">
            <button type="button" class="btn btn-primary" (click)="openRequest()">طلب إجازة</button>
          </app-empty-state>
        } @else {
          <div class="table-responsive">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th>النوع</th>
                  <th>الفترة</th>
                  <th>المدة</th>
                  <th>الحالة</th>
                  <th class="text-end">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                @for (r of requests(); track r.id) {
                  <tr>
                    <td>
                      {{ typeLabel(r.leaveType) }}
                      @if (r.reason) {
                        <small class="d-block text-muted reason">{{ r.reason }}</small>
                      }
                    </td>
                    <td class="num">{{ r.startDate | date: 'yyyy/MM/dd' }} ← {{ r.endDate | date: 'yyyy/MM/dd' }}</td>
                    <td class="num">{{ days(r) }} يوم</td>
                    <td><app-status-badge [status]="r.status" [note]="statusOf(r) === 'rejected' ? (r.rejectionNote || r.rejectionReason || 'تم الرفض بدون ملاحظة') : null" /></td>
                    <td class="text-end">
                      @if (statusOf(r) === 'pending') {
                        <button type="button" class="btn btn-sm btn-outline-danger" [disabled]="busyId() === r.id" (click)="cancel(r)">
                          <i class="fa-solid fa-ban ms-1" aria-hidden="true"></i>إلغاء الطلب
                        </button>
                      } @else {
                        <span class="text-muted">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }

    <app-modal [open]="modalOpen()" [title]="'طلب إجازة جديد'" (closed)="modalOpen.set(false)">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="mb-3">
          <label class="form-label" for="lv-type">نوع الإجازة</label>
          <select id="lv-type" class="form-select" formControlName="leaveType">
            @for (t of leaveTypes; track t.value) {
              <option [ngValue]="t.value">{{ t.label }}</option>
            }
          </select>
        </div>
        <div class="row g-3 mb-2">
          <div class="col-6">
            <label class="form-label" for="lv-start">من</label>
            <input id="lv-start" type="date" class="form-control" formControlName="startDate" [class.is-invalid]="invalid('startDate')" />
            <div class="invalid-feedback">تاريخ البداية مطلوب.</div>
          </div>
          <div class="col-6">
            <label class="form-label" for="lv-end">إلى</label>
            <input id="lv-end" type="date" class="form-control" formControlName="endDate" [class.is-invalid]="invalid('endDate') || rangeInvalid()" />
            <div class="invalid-feedback">{{ form.hasError('dateRange') ? 'تاريخ النهاية قبل البداية.' : 'تاريخ النهاية مطلوب.' }}</div>
          </div>
        </div>
        @if (requestedDays() > 0) {
          <p class="days-hint">المدة المطلوبة: <strong>{{ requestedDays() }}</strong> يوم</p>
        }
        <div class="mb-4">
          <label class="form-label" for="lv-reason">السبب</label>
          <textarea id="lv-reason" rows="3" class="form-control" formControlName="reason" [class.is-invalid]="invalid('reason')"></textarea>
          <div class="invalid-feedback">اكتب سبب الإجازة (3 أحرف على الأقل).</div>
        </div>
        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn btn-light border" (click)="modalOpen.set(false)">إلغاء</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm ms-2" aria-hidden="true"></span>
            }
            إرسال الطلب
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class PortalComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(LeaveService);
  private readonly attendanceApi = inject(AttendanceService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  readonly auth = inject(AuthService);

  readonly employeeId = this.auth.session()?.employeeId ?? null;
  readonly year = new Date().getFullYear();
  readonly leaveTypes = LEAVE_TYPES;

  readonly balances = signal<LeaveBalance[]>([]);
  readonly balancesLoading = signal(false);
  readonly balancesError = signal<string | null>(null);

  readonly tardiness = signal<TardinessSummary | null>(null);
  readonly tardinessLoading = signal(false);

  readonly requests = signal<LeaveRequest[]>([]);
  readonly requestsLoading = signal(false);
  readonly requestsError = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);

  readonly modalOpen = signal(false);
  readonly saving = signal(false);

  readonly form = this.fb.group(
    {
      leaveType: [1],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      reason: ['', [Validators.required, Validators.minLength(3)]],
    },
    { validators: dateRange },
  );

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly requestedDays = computed(() => inclusiveDays(this.formValue().startDate, this.formValue().endDate));

  /** مجموع المتبقي من الأرصدة المدفوعة (يستبعد «بدون مرتب»). */
  readonly remainingDays = computed(() =>
    this.balances()
      .filter((b) => leaveTypeKey(b.leaveType) !== 'Unpaid')
      .reduce((sum, b) => sum + Math.max(0, b.totalDays - b.usedDays), 0),
  );
  readonly pendingMine = computed(() => this.requests().filter((r) => leaveStatusKey(r.status) === 'pending').length);

  typeLabel = leaveTypeLabel;
  statusOf = (r: LeaveRequest): LeaveStatusKey => leaveStatusKey(r.status);
  days = (r: LeaveRequest): number => inclusiveDays(r.startDate, r.endDate);

  ngOnInit(): void {
    if (this.employeeId) this.reload();
  }

  reload(): void {
    const id = this.employeeId;
    if (!id) return;

    this.balancesLoading.set(true);
    this.balancesError.set(null);
    this.api
      .balances(id, this.year)
      .pipe(finalize(() => this.balancesLoading.set(false)))
      .subscribe({
        next: (list) => this.balances.set(list),
        error: (e: Error) => this.balancesError.set(e.message),
      });

    this.requestsLoading.set(true);
    this.requestsError.set(null);
    this.api
      .employeeRequests(id)
      .pipe(finalize(() => this.requestsLoading.set(false)))
      .subscribe({
        next: (list) => this.requests.set(list),
        error: (e: Error) => this.requestsError.set(e.message),
      });

    const now = new Date();
    this.tardinessLoading.set(true);
    this.attendanceApi
      .tardiness(id, now.getFullYear(), now.getMonth() + 1)
      .pipe(finalize(() => this.tardinessLoading.set(false)))
      .subscribe({
        next: (t) => this.tardiness.set(t),
        error: () => this.tardiness.set(null),
      });
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  rangeInvalid(): boolean {
    return this.form.hasError('dateRange') && (this.form.controls.endDate.touched || this.form.controls.endDate.dirty);
  }

  openRequest(): void {
    this.form.reset({ leaveType: 1, startDate: '', endDate: '', reason: '' });
    this.modalOpen.set(true);
  }

  submit(): void {
    if (this.form.invalid || !this.employeeId) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .submit({
        employeeId: this.employeeId,
        leaveType: v.leaveType,
        startDate: v.startDate,
        endDate: v.endDate,
        reason: v.reason.trim(),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('تم إرسال طلبك إلى الموارد البشرية');
          this.modalOpen.set(false);
          this.reload();
        },
        error: () => undefined,
      });
  }

  async cancel(r: LeaveRequest): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'إلغاء الطلب',
      message: 'هل تريد إلغاء طلب الإجازة هذا؟ لا يمكن التراجع بعد الإلغاء.',
      confirmText: 'نعم، ألغِ الطلب',
      cancelText: 'تراجع',
    });
    if (!ok) return;
    this.busyId.set(r.id);
    this.api
      .cancel(r.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: () => {
          this.toast.success('تم إلغاء الطلب');
          this.reload();
        },
        error: () => undefined,
      });
  }
}
