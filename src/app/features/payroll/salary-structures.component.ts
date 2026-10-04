import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { Employee, Position, SalaryStructure } from '../../core/models';
import { EmployeeService } from '../../core/services/employee.service';
import { PayrollService } from '../../core/services/payroll.service';
import { PositionService } from '../../core/services/position.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { AvatarDirective } from '../../shared/ui/avatar.directive';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../shared/ui/toast.service';

type Field = keyof SalaryStructure;

const num = (v: number | null | undefined): number => Number(v) || 0;

@Component({
  selector: 'app-salary-structures',
  imports: [
    AvatarDirective,ReactiveFormsModule, MoneyPipe, PageHeaderComponent, SkeletonComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'هيكل الرواتب'" subtitle="صمّم مكوّنات راتب كل موظف: بدلات وخصومات ثابتة، ويُحسب الصافي لحظيًا" />

    <div class="structure-layout">
      <aside class="data-card picker">
        <div class="toolbar">
          <div class="search">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <input type="search" class="form-control" placeholder="ابحث عن موظف" aria-label="بحث عن موظف"
                   [value]="search()" (input)="search.set($any($event.target).value)" />
          </div>
        </div>
        @if (listLoading()) {
          <app-skeleton [count]="8" />
        } @else {
          <ul class="picker-list" role="listbox" aria-label="الموظفون">
            @for (e of filteredEmployees(); track e.id) {
              <li>
                <button type="button" role="option" [class.active]="selected()?.id === e.id" [attr.aria-selected]="selected()?.id === e.id" (click)="select(e)">
                  <span class="avatar" [appAvatar]="e.name" aria-hidden="true">{{ e.name.trim().charAt(0) }}</span>
                  <span>
                    <strong>{{ e.name }}</strong>
                    <small>{{ e.positionTitle || e.departmentName || '' }}</small>
                  </span>
                </button>
              </li>
            } @empty {
              <li class="state-cell">لا توجد نتائج.</li>
            }
          </ul>
        }
      </aside>

      <section>
        @if (!selected()) {
          <div class="data-card">
            <app-empty-state icon="fa-sliders" heading="اختر موظفًا" text="اختر موظفًا من القائمة لتصميم أو تعديل هيكل راتبه." />
          </div>
        } @else if (structureLoading()) {
          <app-skeleton variant="cards" [count]="3" />
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" novalidate>
            <div class="builder-head">
              <div class="person">
                <span class="avatar lg" [appAvatar]="selected()!.name" aria-hidden="true">{{ selected()!.name.trim().charAt(0) }}</span>
                <span>
                  <strong>{{ selected()!.name }}</strong>
                  <small>{{ selected()!.positionTitle || '—' }} · {{ selected()!.departmentName || '—' }}</small>
                </span>
              </div>
              @if (prefilled()) {
                <span class="note-pill"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> لا يوجد هيكل محفوظ — الأساسي مأخوذ من الراتب المرجعي للوظيفة</span>
              }
            </div>

            <div class="row g-4">
              <div class="col-xl-8">
                <section class="data-card pad">
                  <h2 class="group-title earn"><i class="fa-solid fa-circle-plus" aria-hidden="true"></i> المستحقات</h2>
                  <div class="row g-3">
                    @for (f of earningFields; track f.name) {
                      <div class="col-sm-6">
                        <label class="form-label" [for]="'f-' + f.name">{{ f.label }}</label>
                        <div class="input-group">
                          <input [id]="'f-' + f.name" type="number" min="0" step="0.01" class="form-control num-input"
                                 [formControlName]="f.name" [class.is-invalid]="invalid(f.name)" />
                          <span class="input-group-text">ج.م</span>
                        </div>
                      </div>
                    }
                  </div>
                </section>

                <section class="data-card pad mt-3">
                  <h2 class="group-title ded"><i class="fa-solid fa-circle-minus" aria-hidden="true"></i> الخصومات الثابتة</h2>
                  <div class="row g-3">
                    @for (f of deductionFields; track f.name) {
                      <div class="col-sm-6">
                        <label class="form-label" [for]="'f-' + f.name">{{ f.label }}</label>
                        <div class="input-group">
                          <input [id]="'f-' + f.name" type="number" min="0" step="0.01" class="form-control num-input"
                                 [formControlName]="f.name" [class.is-invalid]="invalid(f.name)" />
                          <span class="input-group-text">ج.م</span>
                        </div>
                      </div>
                    }
                  </div>
                </section>
              </div>

              <div class="col-xl-4">
                <aside class="summary-card" aria-live="polite">
                  <h2>ملخص الراتب التقديري</h2>
                  <dl>
                    <div><dt>إجمالي المستحقات</dt><dd class="num">{{ gross() | money }}</dd></div>
                    <div><dt>إجمالي الخصومات الثابتة</dt><dd class="num neg">− {{ deductions() | money }}</dd></div>
                  </dl>
                  <div class="summary-net">
                    <span>الصافي التقديري</span>
                    <strong class="num">{{ net() | money }}</strong>
                  </div>
                  <p class="summary-note">لا يشمل خصم الغياب وخصم التأخير (بعد 60 دقيقة)، فهما يُحسبان عند تشغيل الرواتب.</p>
                  <button type="submit" class="btn btn-light w-100" [disabled]="saving()">
                    @if (saving()) {
                      <span class="spinner-border spinner-border-sm ms-2" aria-hidden="true"></span>
                    }
                    <i class="fa-solid fa-floppy-disk ms-2" aria-hidden="true"></i>حفظ الهيكل
                  </button>
                </aside>
              </div>
            </div>
          </form>
        }
      </section>
    </div>
  `,
})
export class SalaryStructuresComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly employeesApi = inject(EmployeeService);
  private readonly positionsApi = inject(PositionService);
  private readonly payroll = inject(PayrollService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly earningFields: ReadonlyArray<{ name: Field; label: string }> = [
    { name: 'basicSalary', label: 'الراتب الأساسي' },
    { name: 'housingAllowance', label: 'بدل السكن' },
    { name: 'transportationAllowance', label: 'بدل المواصلات' },
    { name: 'mealAllowance', label: 'بدل الوجبات' },
    { name: 'otherAllowances', label: 'بدلات أخرى' },
    { name: 'monthlyOvertime', label: 'الإضافي الشهري' },
  ];
  readonly deductionFields: ReadonlyArray<{ name: Field; label: string }> = [
    { name: 'socialInsurance', label: 'التأمينات الاجتماعية' },
    { name: 'taxAmount', label: 'قيمة الضريبة' },
    { name: 'otherDeductions', label: 'خصومات أخرى' },
  ];

  readonly employees = signal<Employee[]>([]);
  private readonly positions = signal<Position[]>([]);
  readonly search = signal('');
  readonly listLoading = signal(true);
  readonly selected = signal<Employee | null>(null);
  readonly structureLoading = signal(false);
  readonly prefilled = signal(false);
  readonly saving = signal(false);

  readonly filteredEmployees = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.employees().filter((e) => [e.name, e.email, e.positionTitle].some((v) => (v ?? '').toLowerCase().includes(q))) : this.employees();
  });

  readonly form = this.fb.group({
    basicSalary: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    housingAllowance: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    transportationAllowance: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    mealAllowance: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    otherAllowances: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    monthlyOvertime: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    socialInsurance: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    taxAmount: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    otherDeductions: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly gross = computed(() => {
    const v = this.value();
    return num(v.basicSalary) + num(v.housingAllowance) + num(v.transportationAllowance) + num(v.mealAllowance) + num(v.otherAllowances) + num(v.monthlyOvertime);
  });
  readonly deductions = computed(() => {
    const v = this.value();
    return num(v.socialInsurance) + num(v.taxAmount) + num(v.otherDeductions);
  });
  readonly net = computed(() => this.gross() - this.deductions());

  ngOnInit(): void {
    forkJoin({ employees: this.employeesApi.list(), positions: this.positionsApi.list() })
      .pipe(finalize(() => this.listLoading.set(false)))
      .subscribe({
        next: (r) => {
          this.employees.set(r.employees);
          this.positions.set(r.positions);
          const id = Number(this.route.snapshot.queryParamMap.get('employeeId'));
          const preset = id ? r.employees.find((e) => e.id === id) : undefined;
          if (preset) this.select(preset);
        },
        error: (e: Error) => this.toast.error('تعذر تحميل الموظفين: ' + e.message),
      });
  }

  invalid(name: Field): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  select(employee: Employee): void {
    this.selected.set(employee);
    this.structureLoading.set(true);
    this.prefilled.set(false);
    this.payroll
      .getStructure(employee.id)
      .pipe(finalize(() => this.structureLoading.set(false)))
      .subscribe({
        next: (s) => {
          if (s) {
            this.form.reset({
              basicSalary: s.basicSalary,
              housingAllowance: s.housingAllowance,
              transportationAllowance: s.transportationAllowance,
              mealAllowance: s.mealAllowance,
              otherAllowances: s.otherAllowances,
              monthlyOvertime: s.monthlyOvertime,
              socialInsurance: s.socialInsurance,
              taxAmount: s.taxAmount,
              otherDeductions: s.otherDeductions,
            });
          } else {
            const benchmark = this.positions().find((p) => p.id === employee.positionId)?.baseSalary ?? 0;
            this.form.reset({
              basicSalary: benchmark, housingAllowance: 0, transportationAllowance: 0, mealAllowance: 0,
              otherAllowances: 0, monthlyOvertime: 0, socialInsurance: 0, taxAmount: 0, otherDeductions: 0,
            });
            this.prefilled.set(benchmark > 0);
          }
        },
        error: (e: Error) => this.toast.error('تعذر تحميل هيكل الراتب: ' + e.message),
      });
  }

  save(): void {
    const employee = this.selected();
    if (!employee) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: SalaryStructure = {
      basicSalary: num(v.basicSalary),
      housingAllowance: num(v.housingAllowance),
      transportationAllowance: num(v.transportationAllowance),
      mealAllowance: num(v.mealAllowance),
      otherAllowances: num(v.otherAllowances),
      monthlyOvertime: num(v.monthlyOvertime),
      socialInsurance: num(v.socialInsurance),
      taxAmount: num(v.taxAmount),
      otherDeductions: num(v.otherDeductions),
    };
    this.saving.set(true);
    this.payroll
      .saveStructure(employee.id, payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.prefilled.set(false);
          this.toast.success('تم حفظ هيكل الراتب');
        },
        error: () => undefined,
      });
  }
}
