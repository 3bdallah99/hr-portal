import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { Employee, LeaveBalance } from '../../core/models';
import { EmployeeService } from '../../core/services/employee.service';
import { LeaveService } from '../../core/services/leave.service';
import { AllocateBalanceDialogComponent } from '../../shared/ui/allocate-balance-dialog.component';
import { BalanceCardComponent } from '../../shared/ui/balance-card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../shared/ui/toast.service';

@Component({
  selector: 'app-balances',
  imports: [PageHeaderComponent, BalanceCardComponent, AllocateBalanceDialogComponent, SkeletonComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'أرصدة الإجازات'" subtitle="اعرض رصيد أي موظف لسنة محددة، أو خصّص رصيدًا جديدًا">
      <button type="button" class="btn btn-primary" (click)="allocateOpen.set(true)">
        <i class="fa-solid fa-plus ms-2" aria-hidden="true"></i>تخصيص رصيد
      </button>
    </app-page-header>

    <section class="data-card filter-card">
      <div class="row g-3 align-items-end">
        <div class="col-md-6">
          <label class="form-label" for="bal-emp">الموظف</label>
          <select id="bal-emp" class="form-select" (change)="onEmployee($any($event.target).value)">
            <option value="">اختر موظفًا لعرض أرصدته…</option>
            @for (e of employees(); track e.id) {
              <option [value]="e.id" [selected]="e.id === employeeId()">{{ e.name }}</option>
            }
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label" for="bal-year">السنة</label>
          <input id="bal-year" type="number" class="form-control" min="2020" max="2100" [value]="year()" (change)="onYear($any($event.target).value)" />
        </div>
      </div>
    </section>

    @if (!employeeId()) {
      <section class="data-card">
        <app-empty-state icon="fa-user-clock" heading="اختر موظفًا" text="اختر موظفًا من القائمة لعرض أرصدة إجازاته." />
      </section>
    } @else if (loading()) {
      <app-skeleton variant="cards" [count]="4" />
    } @else if (error()) {
      <div class="alert alert-danger" role="alert">{{ error() }}</div>
    } @else if (!balances().length) {
      <section class="data-card">
        <app-empty-state icon="fa-wallet" heading="لا توجد أرصدة" [text]="'لم يتم تخصيص أي رصيد لهذا الموظف في سنة ' + year() + '.'">
          <button type="button" class="btn btn-primary" (click)="allocateOpen.set(true)">تخصيص رصيد الآن</button>
        </app-empty-state>
      </section>
    } @else {
      <div class="balance-grid">
        @for (b of balances(); track b.leaveType) {
          <app-balance-card [balance]="b" />
        }
      </div>
    }

    <app-allocate-balance-dialog [open]="allocateOpen()" [employeeId]="employeeId()" (closed)="allocateOpen.set(false)" (saved)="reload()" />
  `,
})
export class BalancesComponent implements OnInit {
  private readonly employeesApi = inject(EmployeeService);
  private readonly leaves = inject(LeaveService);
  private readonly toast = inject(ToastService);

  readonly employees = signal<Employee[]>([]);
  readonly employeeId = signal<number | null>(null);
  readonly year = signal(new Date().getFullYear());
  readonly balances = signal<LeaveBalance[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly allocateOpen = signal(false);

  ngOnInit(): void {
    this.employeesApi.list().subscribe({
      next: (list) => this.employees.set(list),
      error: (e: Error) => this.toast.error('تعذر تحميل الموظفين: ' + e.message),
    });
  }

  onEmployee(value: string): void {
    this.employeeId.set(value ? Number(value) : null);
    this.reload();
  }

  onYear(value: string): void {
    const y = Number(value);
    if (y >= 2020 && y <= 2100) {
      this.year.set(y);
      this.reload();
    }
  }

  reload(): void {
    const id = this.employeeId();
    if (!id) {
      this.balances.set([]);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.leaves
      .balances(id, this.year())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => this.balances.set(list),
        error: (e: Error) => this.error.set(e.message),
      });
  }
}
