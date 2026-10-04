import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { MONTHS_AR, TARDINESS_ALLOWANCE_MINUTES } from '../../core/constants';
import { Department, Employee, PayrollRunResult, Payslip } from '../../core/models';
import { DepartmentService } from '../../core/services/department.service';
import { EmployeeService } from '../../core/services/employee.service';
import { PayrollService } from '../../core/services/payroll.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { DrawerComponent } from '../../shared/ui/drawer.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../shared/ui/toast.service';

const num = (v: number | null | undefined): number => Number(v) || 0;

@Component({
  selector: 'app-payroll-run',
  imports: [
    ReactiveFormsModule,
    MoneyPipe,
    PageHeaderComponent,
    KpiCardComponent,
    DrawerComponent,
    ModalComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'تشغيل الرواتب'" subtitle="يحسب النظام خصم الغياب وخصم التأخير (بعد أول 60 دقيقة) تلقائيًا" />

    <section class="data-card filter-card">
      <div class="row g-3 align-items-end">
        <div class="col-6 col-md-2">
          <label class="form-label" for="pr-month">الشهر</label>
          <select id="pr-month" class="form-select" [value]="month()" (change)="onMonth($any($event.target).value)">
            @for (m of months; track $index) {
              <option [value]="$index + 1">{{ m }}</option>
            }
          </select>
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label" for="pr-year">السنة</label>
          <input id="pr-year" type="number" min="2020" max="2100" class="form-control" [value]="year()" (change)="onYear($any($event.target).value)" />
        </div>
        <div class="col-md-3">
          <label class="form-label" for="pr-dept">القسم (اختياري)</label>
          <select id="pr-dept" class="form-select" (change)="onDept($any($event.target).value)">
            <option value="">كل الأقسام</option>
            @for (d of departments(); track d.id) {
              <option [value]="d.id">{{ d.name }}</option>
            }
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label" for="pr-emp">موظف واحد (اختياري)</label>
          <select id="pr-emp" class="form-select" (change)="onEmp($any($event.target).value)">
            <option value="">كل الموظفين</option>
            @for (e of employees(); track e.id) {
              <option [value]="e.id">{{ e.name }}</option>
            }
          </select>
        </div>
        <div class="col-md-2">
          <button type="button" class="btn btn-primary w-100" [disabled]="running()" (click)="run()">
            @if (running()) {
              <span class="spinner-border spinner-border-sm ms-2" aria-hidden="true"></span>
            } @else {
              <i class="fa-solid fa-play ms-2" aria-hidden="true"></i>
            }
            تشغيل الرواتب
          </button>
        </div>
      </div>
    </section>

    @if (result(); as r) {
      <div class="kpi-grid mb-3">
        <app-kpi-card label="تمت معالجتهم" [value]="r.processedCount" icon="fa-circle-check" tone="emerald" />
        <app-kpi-card label="تم تخطّيهم" [value]="r.skippedCount" icon="fa-forward" tone="amber" hint="غالبًا بدون هيكل راتب" />
        <app-kpi-card label="إجمالي الصافي المصروف" [value]="(r.totalNetDisbursed | money)" icon="fa-money-bill-wave" tone="indigo" />
      </div>
    }

    <section class="data-card">
      <div class="toolbar">
        <div class="search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input type="search" class="form-control" placeholder="ابحث في كشوف المرتبات" aria-label="بحث في كشوف المرتبات"
                 [value]="search()" (input)="search.set($any($event.target).value)" />
        </div>
        <span class="toolbar-total">صافي الكشف: <strong class="num">{{ totalNet() | money }}</strong></span>
      </div>

      @if (loading()) {
        <app-skeleton [count]="7" />
      } @else if (loadError()) {
        <div class="state-cell text-danger">
          {{ loadError() }} <button type="button" class="btn btn-sm btn-outline-danger me-2" (click)="loadSlips()">إعادة المحاولة</button>
        </div>
      } @else if (!filtered().length) {
        <app-empty-state icon="fa-file-invoice-dollar" heading="لا توجد كشوف لهذا الشهر"
                         [text]="search() ? 'لا توجد نتائج مطابقة للبحث.' : 'اضغط «تشغيل الرواتب» لإنشاء كشوف ' + monthLabel() + ' ' + year() + '.'" />
      } @else {
        <div class="table-responsive">
          <table class="table align-middle mb-0 clickable">
            <thead>
              <tr>
                <th>الموظف</th>
                <th>القسم</th>
                <th>الإجمالي</th>
                <th>الخصومات</th>
                <th>الصافي</th>
                <th class="text-end"></th>
              </tr>
            </thead>
            <tbody>
              @for (p of filtered(); track p.id) {
                <tr (click)="open(p)" (keydown.enter)="open(p)" tabindex="0">
                  <td><strong>{{ p.employeeName || '#' + p.employeeId }}</strong></td>
                  <td>{{ p.departmentName || '—' }}</td>
                  <td class="num">{{ gross(p) | money }}</td>
                  <td class="num neg">{{ deductions(p) | money }}</td>
                  <td class="num"><strong>{{ net(p) | money }}</strong></td>
                  <td class="text-end"><i class="fa-solid fa-chevron-left text-muted" aria-hidden="true"></i></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <app-drawer [open]="selected() !== null" [heading]="'قسيمة الراتب'" [subtitle]="slipSubtitle()" (closed)="selected.set(null)">
      @if (selected(); as p) {
        <div class="payslip payslip-print">
          <header class="payslip-head">
            <div>
              <strong>{{ p.employeeName || '#' + p.employeeId }}</strong>
              <small>{{ p.departmentName || '' }}</small>
            </div>
            <span class="payslip-period">{{ monthName(p.month) }} {{ p.year }}</span>
          </header>

          <h3 class="slip-group earn">المستحقات</h3>
          <dl class="slip-rows">
            <div><dt>الراتب الأساسي</dt><dd class="num">{{ p.basicSalary | money }}</dd></div>
            <div><dt>البدلات</dt><dd class="num">{{ p.totalAllowances | money }}</dd></div>
            <div><dt>الإضافي</dt><dd class="num">{{ p.overtime | money }}</dd></div>
            <div class="sum"><dt>إجمالي الراتب</dt><dd class="num">{{ gross(p) | money }}</dd></div>
          </dl>

          <h3 class="slip-group ded">الخصومات</h3>
          <dl class="slip-rows">
            <div>
              <dt>خصم الغياب <small>{{ p.absentDays }} يوم · (الأساسي ÷ أيام العمل) × أيام الغياب</small></dt>
              <dd class="num neg">− {{ p.absenceDeduction | money }}</dd>
            </div>
            <div>
              <dt>خصم التأخير <small>{{ p.totalLateMinutes }} دقيقة · قابل للخصم {{ deductibleMinutes(p) }} · سعر الدقيقة × (الدقائق − {{ allowance }})</small></dt>
              <dd class="num neg">− {{ p.tardinessDeduction | money }}</dd>
            </div>
            <div><dt>التأمينات الاجتماعية</dt><dd class="num neg">− {{ p.socialInsurance | money }}</dd></div>
            <div><dt>الضرائب</dt><dd class="num neg">− {{ p.taxAmount | money }}</dd></div>
            <div><dt>خصومات أخرى</dt><dd class="num neg">− {{ p.otherDeductions | money }}</dd></div>
            <div class="sum"><dt>إجمالي الخصومات</dt><dd class="num neg">− {{ deductions(p) | money }}</dd></div>
          </dl>

          <div class="net-callout">
            <span>صافي الراتب</span>
            <strong class="num">{{ net(p) | money }}</strong>
          </div>
        </div>

        <div class="drawer-actions no-print">
          <button type="button" class="btn btn-outline-primary" (click)="openAdjust(p)">
            <i class="fa-solid fa-pen-to-square ms-2" aria-hidden="true"></i>تعديل بعد التشغيل
          </button>
          <button type="button" class="btn btn-primary" (click)="print()">
            <i class="fa-solid fa-print ms-2" aria-hidden="true"></i>طباعة / تنزيل PDF
          </button>
        </div>
      }
    </app-drawer>

    <app-modal [open]="adjusting() !== null" [title]="'تعديل بعد التشغيل'" (closed)="adjusting.set(null)">
      <form [formGroup]="adjustForm" (ngSubmit)="saveAdjust()" novalidate>
        @if (adjusting(); as a) {
          <p class="text-muted">{{ a.employeeName || '#' + a.employeeId }} · {{ monthName(a.month) }} {{ a.year }}</p>
        }
        <div class="row g-3 mb-3">
          <div class="col-sm-6">
            <label class="form-label" for="adj-ot">الإضافي</label>
            <div class="input-group">
              <input id="adj-ot" type="number" min="0" step="0.01" class="form-control num-input" formControlName="overtime" [class.is-invalid]="adjInvalid('overtime')" />
              <span class="input-group-text">ج.م</span>
            </div>
          </div>
          <div class="col-sm-6">
            <label class="form-label" for="adj-ded">خصومات إضافية</label>
            <div class="input-group">
              <input id="adj-ded" type="number" min="0" step="0.01" class="form-control num-input" formControlName="otherDeductions" [class.is-invalid]="adjInvalid('otherDeductions')" />
              <span class="input-group-text">ج.م</span>
            </div>
          </div>
        </div>
        <div class="net-preview" aria-live="polite">
          <span>الصافي بعد التعديل</span>
          <strong class="num">{{ previewNet() | money }}</strong>
        </div>
        <div class="d-flex gap-2 justify-content-end mt-4">
          <button type="button" class="btn btn-light border" (click)="adjusting.set(null)">إلغاء</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm ms-2" aria-hidden="true"></span>
            }
            حفظ التعديل
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class PayrollRunComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly payroll = inject(PayrollService);
  private readonly departmentApi = inject(DepartmentService);
  private readonly employeeApi = inject(EmployeeService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly months = MONTHS_AR;
  readonly allowance = TARDINESS_ALLOWANCE_MINUTES;

  readonly month = signal(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());
  readonly deptId = signal<number | null>(null);
  readonly empId = signal<number | null>(null);

  readonly departments = signal<Department[]>([]);
  readonly employees = signal<Employee[]>([]);

  readonly slips = signal<Payslip[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly search = signal('');
  readonly running = signal(false);
  readonly result = signal<PayrollRunResult | null>(null);

  readonly selected = signal<Payslip | null>(null);
  readonly adjusting = signal<Payslip | null>(null);
  readonly saving = signal(false);

  readonly monthLabel = computed(() => this.months[this.month() - 1]);
  readonly slipSubtitle = computed(() => {
    const p = this.selected();
    return p ? `${this.monthName(p.month)} ${p.year}` : '';
  });

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.slips();
    return q ? list.filter((p) => (p.employeeName ?? '').toLowerCase().includes(q) || (p.departmentName ?? '').toLowerCase().includes(q)) : list;
  });
  readonly totalNet = computed(() => this.filtered().reduce((sum, p) => sum + this.net(p), 0));

  readonly adjustForm = this.fb.group({
    overtime: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    otherDeductions: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
  });
  private readonly adjustValue = toSignal(this.adjustForm.valueChanges, { initialValue: this.adjustForm.getRawValue() });

  /** معاينة محلية؛ الخادم هو المصدر النهائي للحساب. */
  readonly previewNet = computed(() => {
    const p = this.adjusting();
    if (!p) return 0;
    const v = this.adjustValue();
    const gross = num(p.basicSalary) + num(p.totalAllowances) + num(v.overtime);
    const ded =
      num(p.absenceDeduction) + num(p.tardinessDeduction) + num(p.taxAmount) + num(p.socialInsurance) + num(v.otherDeductions);
    return gross - ded;
  });

  gross = (p: Payslip): number => p.grossPay ?? num(p.basicSalary) + num(p.totalAllowances) + num(p.overtime);
  deductions = (p: Payslip): number =>
    p.totalDeductions ??
    num(p.absenceDeduction) + num(p.tardinessDeduction) + num(p.taxAmount) + num(p.socialInsurance) + num(p.otherDeductions);
  net = (p: Payslip): number => p.netPay ?? this.gross(p) - this.deductions(p);
  deductibleMinutes = (p: Payslip): number => Math.max(0, num(p.totalLateMinutes) - this.allowance);
  monthName = (m: number): string => this.months[m - 1] ?? String(m);

  ngOnInit(): void {
    forkJoin({ departments: this.departmentApi.list(), employees: this.employeeApi.list() }).subscribe({
      next: (r) => {
        this.departments.set(r.departments);
        this.employees.set(r.employees);
      },
      error: (e: Error) => this.toast.error('تعذر تحميل الأقسام والموظفين: ' + e.message),
    });
    this.loadSlips();
  }

  onMonth(v: string): void {
    this.month.set(Number(v));
    this.result.set(null);
    this.loadSlips();
  }
  onYear(v: string): void {
    const y = Number(v);
    if (y >= 2020 && y <= 2100) {
      this.year.set(y);
      this.result.set(null);
      this.loadSlips();
    }
  }
  onDept(v: string): void {
    this.deptId.set(v ? Number(v) : null);
    this.loadSlips();
  }
  onEmp(v: string): void {
    this.empId.set(v ? Number(v) : null);
  }

  loadSlips(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.payroll
      .list(this.month(), this.year(), this.deptId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => {
          this.slips.set(list);
          const cur = this.selected();
          if (cur) this.selected.set(list.find((p) => p.id === cur.id) ?? null);
        },
        error: (e: Error) => {
          this.slips.set([]);
          this.loadError.set('تعذر تحميل كشوف المرتبات: ' + e.message);
        },
      });
  }

  async run(): Promise<void> {
    const dept = this.departments().find((d) => d.id === this.deptId())?.name;
    const emp = this.employees().find((e) => e.id === this.empId())?.name;
    const scope = emp ? `الموظف «${emp}»` : dept ? `قسم «${dept}»` : 'كل الموظفين';
    const ok = await this.confirm.ask({
      title: 'تشغيل الرواتب',
      message: `سيتم احتساب رواتب ${scope} عن ${this.monthLabel()} ${this.year()} شاملة خصومات الغياب والتأخير. هل تريد المتابعة؟`,
      confirmText: 'نعم، شغّل الرواتب',
      tone: 'primary',
    });
    if (!ok) return;

    this.running.set(true);
    this.payroll
      .run({ month: this.month(), year: this.year(), departmentId: this.deptId(), employeeId: this.empId() })
      .pipe(finalize(() => this.running.set(false)))
      .subscribe({
        next: (r) => {
          this.result.set(r);
          this.toast.success(`تمت معالجة ${r.processedCount} موظف`);
          this.loadSlips();
        },
        error: () => undefined,
      });
  }

  open(p: Payslip): void {
    this.selected.set(p);
  }

  print(): void {
    window.print();
  }

  adjInvalid(name: 'overtime' | 'otherDeductions'): boolean {
    const c = this.adjustForm.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  openAdjust(p: Payslip): void {
    this.adjustForm.reset({ overtime: num(p.overtime), otherDeductions: num(p.otherDeductions) });
    this.adjusting.set(p);
  }

  saveAdjust(): void {
    const p = this.adjusting();
    if (!p) return;
    if (this.adjustForm.invalid) {
      this.adjustForm.markAllAsTouched();
      return;
    }
    const v = this.adjustForm.getRawValue();
    this.saving.set(true);
    this.payroll
      .adjust(p.id, { overtime: num(v.overtime), otherDeductions: num(v.otherDeductions) })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('تم تعديل القسيمة وإعادة احتساب الصافي');
          this.adjusting.set(null);
          this.loadSlips();
        },
        error: () => undefined,
      });
  }
}
