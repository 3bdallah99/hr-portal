import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { LeaveRequest } from '../../core/models';
import { LeaveService } from '../../core/services/leave.service';
import { LeaveStatusKey, inclusiveDays, leaveStatusKey, leaveTypeKey, leaveTypeLabel } from '../../core/util/leave';
import { AllocateBalanceDialogComponent } from '../../shared/ui/allocate-balance-dialog.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { ToastService } from '../../shared/ui/toast.service';

type Tab = 'all' | LeaveStatusKey;

@Component({
  selector: 'app-leaves',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    ModalComponent,
    StatusBadgeComponent,
    AllocateBalanceDialogComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'طلبات الإجازات'" subtitle="الموظفون يرسلون طلباتهم مباشرة إليك — وافق أو ارفض بضغطة واحدة">
      <button type="button" class="btn btn-outline-primary" (click)="allocateOpen.set(true)">
        <i class="fa-solid fa-wallet ms-2" aria-hidden="true"></i>تخصيص رصيد موظف
      </button>
    </app-page-header>

    @if (loadError()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
        <span>{{ loadError() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="load()">إعادة المحاولة</button>
      </div>
    }

    <section class="data-card">
      <div class="tabs" role="tablist" aria-label="تصفية الطلبات بالحالة">
        @for (t of tabs; track t.key) {
          <button type="button" role="tab" [class.active]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="tab.set(t.key)">
            {{ t.label }}
            <span class="count" [class.count-alert]="t.key === 'pending' && counts()[t.key] > 0">{{ counts()[t.key] }}</span>
          </button>
        }
      </div>

      @if (loading()) {
        <app-skeleton [count]="6" />
      } @else if (!visible().length) {
        <app-empty-state icon="fa-calendar-check" heading="لا توجد طلبات في هذا التصنيف" />
      } @else {
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead>
              <tr>
                <th>الموظف</th>
                <th>النوع</th>
                <th>الفترة</th>
                <th>المدة</th>
                <th>الحالة</th>
                <th class="text-end">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              @for (r of visible(); track r.id) {
                <tr>
                  <td>
                    <strong>{{ r.employeeName || '#' + r.employeeId }}</strong>
                    @if (r.reason) {
                      <small class="d-block text-muted reason">{{ r.reason }}</small>
                    }
                  </td>
                  <td>{{ typeLabel(r.leaveType) }}</td>
                  <td class="num">{{ r.startDate | date: 'yyyy/MM/dd' }} ← {{ r.endDate | date: 'yyyy/MM/dd' }}</td>
                  <td class="num">{{ days(r) }} يوم</td>
                  <td><app-status-badge [status]="r.status" [note]="statusOf(r) === 'rejected' ? (r.rejectionNote || r.rejectionReason) : null" /></td>
                  <td class="text-end">
                    @if (statusOf(r) === 'pending') {
                      <button type="button" class="btn btn-sm btn-success ms-1" [disabled]="busyId() === r.id" (click)="approve(r)">
                        <i class="fa-solid fa-check ms-1" aria-hidden="true"></i>قبول
                      </button>
                      <button type="button" class="btn btn-sm btn-outline-danger" [disabled]="busyId() === r.id" (click)="openReject(r)">
                        <i class="fa-solid fa-xmark ms-1" aria-hidden="true"></i>رفض
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

    <app-modal [open]="rejectTarget() !== null" [title]="'رفض طلب الإجازة'" (closed)="closeReject()">
      <form (ngSubmit)="confirmReject()" novalidate>
        <p class="text-muted">
          ملاحظة الرفض اختيارية وتظهر للموظف عند مرور الماوس على حالة الطلب.
        </p>
        <div class="mb-4">
          <label class="form-label" for="reject-note">ملاحظة الرفض (اختياري)</label>
          <textarea id="reject-note" rows="3" class="form-control" [formControl]="note"></textarea>
        </div>
        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn btn-light border" (click)="closeReject()">إلغاء</button>
          <button type="submit" class="btn btn-danger" [disabled]="rejecting()">
            @if (rejecting()) {
              <span class="spinner-border spinner-border-sm ms-2" aria-hidden="true"></span>
            }
            تأكيد الرفض
          </button>
        </div>
      </form>
    </app-modal>

    <app-allocate-balance-dialog [open]="allocateOpen()" (closed)="allocateOpen.set(false)" />
  `,
})
export class LeavesComponent implements OnInit {
  private readonly api = inject(LeaveService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly tabs: ReadonlyArray<{ key: Tab; label: string }> = [
    { key: 'pending', label: 'قيد المراجعة' },
    { key: 'approved', label: 'مقبولة' },
    { key: 'rejected', label: 'مرفوضة' },
    { key: 'cancelled', label: 'ملغاة' },
    { key: 'all', label: 'الكل' },
  ];

  readonly requests = signal<LeaveRequest[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly tab = signal<Tab>('pending');
  readonly busyId = signal<number | null>(null);

  readonly counts = computed<Record<Tab, number>>(() => {
    const c: Record<Tab, number> = { all: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    for (const r of this.requests()) {
      c.all++;
      c[leaveStatusKey(r.status)]++;
    }
    return c;
  });

  readonly visible = computed(() => {
    const t = this.tab();
    return t === 'all' ? this.requests() : this.requests().filter((r) => leaveStatusKey(r.status) === t);
  });

  readonly rejectTarget = signal<LeaveRequest | null>(null);
  readonly rejecting = signal(false);
  readonly note = new FormControl('', { nonNullable: true });
  readonly allocateOpen = signal(false);

  typeLabel = leaveTypeLabel;
  statusOf = (r: LeaveRequest): LeaveStatusKey => leaveStatusKey(r.status);
  days = (r: LeaveRequest): number => inclusiveDays(r.startDate, r.endDate);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .allRequests()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => {
          this.requests.set(list);
          this.api.pendingCount.set(list.filter((r) => leaveStatusKey(r.status) === 'pending').length);
        },
        error: (e: Error) => this.loadError.set('تعذر تحميل الطلبات: ' + e.message),
      });
  }

  async approve(r: LeaveRequest): Promise<void> {
    const unpaid = leaveTypeKey(r.leaveType) === 'Unpaid';
    const who = r.employeeName || '#' + r.employeeId;
    const ok = await this.confirm.ask({
      title: 'الموافقة على الطلب',
      message: unpaid
        ? `سيتم قبول إجازة ${who} (بدون مرتب، لا تُخصم من الرصيد).`
        : `سيتم قبول إجازة ${who} وخصم ${this.days(r)} يوم من رصيده.`,
      confirmText: 'موافقة',
      tone: 'primary',
    });
    if (!ok) return;

    this.busyId.set(r.id);
    this.api
      .approve(r.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: () => {
          this.toast.success('تمت الموافقة على الطلب');
          this.load();
        },
        error: () => undefined,
      });
  }

  openReject(r: LeaveRequest): void {
    this.note.reset('');
    this.rejectTarget.set(r);
  }

  closeReject(): void {
    this.rejectTarget.set(null);
  }

  confirmReject(): void {
    const target = this.rejectTarget();
    if (!target) return;
    this.rejecting.set(true);
    this.api
      .reject(target.id, this.note.value)
      .pipe(finalize(() => this.rejecting.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('تم رفض الطلب');
          this.closeReject();
          this.load();
        },
        error: () => undefined,
      });
  }
}
