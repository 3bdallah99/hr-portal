import { ChangeDetectionStrategy, Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { Employee } from '../../core/models';
import { EmployeeService } from '../../core/services/employee.service';
import { LeaveService } from '../../core/services/leave.service';
import { LEAVE_TYPES } from '../../core/util/leave';
import { ModalComponent } from './modal.component';
import { ToastService } from './toast.service';

/** تخصيص / تعديل رصيد إجازات موظف (Upsert). */
@Component({
  selector: 'app-allocate-balance-dialog',
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="'تخصيص رصيد إجازات'" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="mb-3">
          <label class="form-label" for="ab-employee">الموظف</label>
          <select id="ab-employee" class="form-select" formControlName="employeeId" [class.is-invalid]="invalid('employeeId')">
            <option [ngValue]="null">اختر الموظف…</option>
            @for (e of employees(); track e.id) {
              <option [ngValue]="e.id">{{ e.name }}</option>
            }
          </select>
          <div class="invalid-feedback">اختر الموظف.</div>
        </div>

        <div class="row g-3 mb-3">
          <div class="col-6">
            <label class="form-label" for="ab-year">السنة</label>
            <input id="ab-year" type="number" class="form-control" formControlName="year" [class.is-invalid]="invalid('year')" />
            <div class="invalid-feedback">أدخل سنة بين 2020 و 2100.</div>
          </div>
          <div class="col-6">
            <label class="form-label" for="ab-type">نوع الإجازة</label>
            <select id="ab-type" class="form-select" formControlName="leaveType">
              @for (t of leaveTypes; track t.value) {
                <option [ngValue]="t.value">{{ t.label }}</option>
              }
            </select>
          </div>
        </div>

        <div class="mb-4">
          <label class="form-label" for="ab-days">إجمالي الأيام الممنوحة</label>
          <input
            id="ab-days"
            type="number"
            class="form-control"
            formControlName="totalDays"
            placeholder="مثال: 21"
            [class.is-invalid]="invalid('totalDays')"
          />
          <div class="invalid-feedback">أدخل عددًا بين 0 و 365.</div>
          <div class="form-text">تعديل الرصيد لا يمسّ الأيام المستخدمة بالفعل.</div>
        </div>

        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn btn-light border" (click)="closed.emit()">إلغاء</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm ms-2" aria-hidden="true"></span>
            }
            حفظ الرصيد
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class AllocateBalanceDialogComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly employeesApi = inject(EmployeeService);
  private readonly leaves = inject(LeaveService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  /** موظف محدد مسبقًا (اختياري). */
  readonly employeeId = input<number | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly leaveTypes = LEAVE_TYPES;
  readonly employees = signal<Employee[]>([]);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    employeeId: this.fb.control<number | null>(null, Validators.required),
    year: this.fb.control(new Date().getFullYear(), [Validators.required, Validators.min(2020), Validators.max(2100)]),
    leaveType: this.fb.control(1, Validators.required),
    totalDays: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(365)]),
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset({
          employeeId: this.employeeId(),
          year: new Date().getFullYear(),
          leaveType: 1,
          totalDays: null,
        });
      }
    });
  }

  ngOnInit(): void {
    this.employeesApi.list().subscribe({
      next: (list) => this.employees.set(list),
      error: (e: Error) => this.toast.error('تعذر تحميل قائمة الموظفين: ' + e.message),
    });
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.leaves
      .setBalance({
        employeeId: v.employeeId as number,
        year: v.year,
        leaveType: v.leaveType,
        totalDays: v.totalDays as number,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('تم حفظ الرصيد');
          this.saved.emit();
          this.closed.emit();
        },
        error: () => undefined, // الـ errorInterceptor يعرض الرسالة
      });
  }
}
