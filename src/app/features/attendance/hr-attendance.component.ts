import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { Department, DeviceLog, Employee, AttendanceRecord, TardinessSummary } from '../../core/models';
import { AttendanceService } from '../../core/services/attendance.service';
import { DepartmentService } from '../../core/services/department.service';
import { EmployeeService } from '../../core/services/employee.service';
import {
  attendanceKey,
  clockInput,
  clockText,
  currentMonthInput,
  parseMonthInput,
  toClockPayload,
  todayIso,
} from '../../core/util/attendance';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { PagerComponent } from '../../shared/ui/pager.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { TardinessMeterComponent } from '../../shared/ui/tardiness-meter.component';
import { ToastService } from '../../shared/ui/toast.service';

type Tab = 'monitor' | 'tardiness' | 'logs';
type LogFilter = 'all' | 'processed' | 'failed';

@Component({
  selector: 'app-hr-attendance',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    KpiCardComponent,
    ModalComponent,
    PagerComponent,
    SkeletonComponent,
    StatusBadgeComponent,
    TardinessMeterComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'الحضور والبصمة'" subtitle="بيانات أجهزة ZKTeco — الدوام يبدأ 09:00 مع سماحية 60 دقيقة شهريًا" />

    <div class="tabs tabs-solo" role="tablist" aria-label="أقسام الحضور">
      <button type="button" role="tab" [class.active]="tab() === 'monitor'" [attr.aria-selected]="tab() === 'monitor'" (click)="setTab('monitor')">
        <i class="fa-solid fa-table-list ms-1" aria-hidden="true"></i> متابعة الحضور
      </button>
      <button type="button" role="tab" [class.active]="tab() === 'tardiness'" [attr.aria-selected]="tab() === 'tardiness'" (click)="setTab('tardiness')">
        <i class="fa-solid fa-stopwatch ms-1" aria-hidden="true"></i> فاحص التأخير
      </button>
      <button type="button" role="tab" [class.active]="tab() === 'logs'" [attr.aria-selected]="tab() === 'logs'" (click)="setTab('logs')">
        <i class="fa-solid fa-microchip ms-1" aria-hidden="true"></i> سجلات الأجهزة
      </button>
    </div>

    @if (tab() === 'monitor') {
      <section class="data-card filter-card">
        <div class="row g-3 align-items-end">
          <div class="col-md-4">
            <label class="form-label" for="at-dept">القسم</label>
            <select id="at-dept" class="form-select" (change)="onDept($any($event.target).value)">
              @for (d of departments(); track d.id) {
                <option [value]="d.id" [selected]="d.id === deptId()">{{ d.name }}</option>
              }
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label" for="at-date">التاريخ</label>
            <input id="at-date" type="date" class="form-control" [value]="date()" (change)="onDate($any($event.target).value)" />
          </div>
        </div>
      </section>

      <div class="kpi-grid compact mb-3">
        <app-kpi-card label="حاضرون" [value]="counts().present" icon="fa-user-check" tone="emerald" />
        <app-kpi-card label="متأخرون" [value]="counts().late" icon="fa-clock" tone="amber" />
        <app-kpi-card label="غائبون" [value]="counts().absent" icon="fa-user-xmark" tone="rose" />
      </div>

      <section class="data-card">
        @if (monitorLoading()) {
          <app-skeleton [count]="6" />
        } @else if (monitorError()) {
          <div class="state-cell text-danger">
            {{ monitorError() }} <button type="button" class="btn btn-sm btn-outline-danger me-2" (click)="loadMonitor()">إعادة المحاولة</button>
          </div>
        } @else if (!deptId()) {
          <app-empty-state icon="fa-sitemap" heading="اختر قسمًا" text="اختر القسم والتاريخ لعرض الحضور." />
        } @else if (!records().length) {
          <app-empty-state icon="fa-fingerprint" heading="لا توجد سجلات" text="لا توجد بصمات مسجلة لهذا القسم في هذا اليوم." />
        } @else {
          <div class="table-responsive">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>حضور</th>
                  <th>انصراف</th>
                  <th>الحالة</th>
                  <th>دقائق التأخير</th>
                  <th class="text-end">تصحيح</th>
                </tr>
              </thead>
              <tbody>
                @for (r of records(); track r.id) {
                  <tr>
                    <td><strong>{{ r.employeeName || '#' + r.employeeId }}</strong></td>
                    <td class="num">{{ clock(r.clockIn) }}</td>
                    <td class="num">{{ clock(r.clockOut) }}</td>
                    <td><app-status-badge kind="attendance" [status]="key(r)" /></td>
                    <td class="num">{{ r.lateMinutes || 0 }}</td>
                    <td class="text-end row-actions">
                      <button type="button" class="icon-btn" title="تصحيح يدوي" aria-label="تصحيح يدوي" (click)="openCorrection(r)">
                        <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }

    @if (tab() === 'tardiness') {
      <section class="data-card filter-card">
        <div class="row g-3 align-items-end">
          <div class="col-md-5">
            <label class="form-label" for="td-emp">الموظف</label>
            <select id="td-emp" class="form-select" (change)="onTardEmployee($any($event.target).value)">
              <option value="">اختر موظفًا…</option>
              @for (e of employees(); track e.id) {
                <option [value]="e.id" [selected]="e.id === tardEmployeeId()">{{ e.name }}</option>
              }
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label" for="td-month">الشهر</label>
            <input id="td-month" type="month" class="form-control" [value]="tardMonth()" (change)="onTardMonth($any($event.target).value)" />
          </div>
        </div>
      </section>

      @if (!tardEmployeeId()) {
        <section class="data-card"><app-empty-state icon="fa-stopwatch" heading="اختر موظفًا" text="اختر موظفًا وشهرًا لمراجعة التأخير والخصم." /></section>
      } @else if (tardLoading()) {
        <app-skeleton variant="cards" [count]="4" />
      } @else if (tardError()) {
        <div class="alert alert-danger" role="alert">{{ tardError() }}</div>
      } @else {
        @if (tardiness(); as t) {
          <div class="kpi-grid mb-3">
            <app-kpi-card label="مرات التأخير" [value]="t.totalOccurrences" icon="fa-rotate-left" tone="slate" />
            <app-kpi-card label="إجمالي دقائق التأخير" [value]="t.totalLateMinutes" icon="fa-clock" tone="amber" />
            <app-kpi-card label="السماحية المجانية" [value]="t.allowedMinutes || 60" icon="fa-shield-halved" tone="emerald" hint="دقيقة / شهر" />
            <app-kpi-card label="دقائق قابلة للخصم" [value]="t.deductibleMinutes" icon="fa-scissors" tone="rose" />
          </div>
          <app-tardiness-meter [used]="t.totalLateMinutes" [allowed]="t.allowedMinutes || 60" [occurrences]="t.totalOccurrences" />
        }
      }
    }

    @if (tab() === 'logs') {
      <section class="data-card">
        <div class="toolbar">
          <select class="form-select w-auto" aria-label="تصفية السجلات" [value]="logFilter()" (change)="onLogFilter($any($event.target).value)">
            <option value="all">كل السجلات</option>
            <option value="processed">تمت معالجتها</option>
            <option value="failed">لم تُعالج / بها خطأ</option>
          </select>
          <button type="button" class="btn btn-outline-primary ms-auto" (click)="loadLogs()">
            <i class="fa-solid fa-rotate ms-2" aria-hidden="true"></i>تحديث
          </button>
        </div>

        @if (logsLoading()) {
          <app-skeleton [count]="8" />
        } @else if (logsError()) {
          <div class="state-cell text-danger">
            {{ logsError() }} <button type="button" class="btn btn-sm btn-outline-danger me-2" (click)="loadLogs()">إعادة المحاولة</button>
          </div>
        } @else if (!filteredLogs().length) {
          <app-empty-state icon="fa-microchip" heading="لا توجد سجلات" text="لم تصل أي بيانات من أجهزة البصمة بعد." />
        } @else {
          <div class="table-responsive">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th>الجهاز</th>
                  <th>رقم المستخدم (PIN)</th>
                  <th>الوقت</th>
                  <th>الاتجاه</th>
                  <th>المعالجة</th>
                  <th>الخطأ</th>
                </tr>
              </thead>
              <tbody>
                @for (l of logPage(); track l.id) {
                  <tr>
                    <td class="num" dir="ltr">{{ l.deviceSerial }}</td>
                    <td class="num">{{ l.userPin }}</td>
                    <td class="num">{{ (l.logTime || l.timestamp) | date: 'yyyy/MM/dd HH:mm:ss' }}</td>
                    <td>{{ l.inOutMode ?? '—' }}</td>
                    <td><span [class]="l.processed ? 'status status-approved' : 'status status-pending'">{{ l.processed ? 'تمت' : 'معلّقة' }}</span></td>
                    <td class="reason text-danger">{{ l.errorMessage || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pager [page]="logPageNo()" [pageSize]="logPageSize" [total]="filteredLogs().length" (pageChange)="logPageNo.set($event)" />
        }
      </section>
    }

    <app-modal [open]="correcting() !== null" [title]="'تصحيح سجل حضور'" (closed)="correcting.set(null)">
      @if (correcting(); as c) {
        <p class="text-muted mb-3">
          {{ c.employeeName || '#' + c.employeeId }} · <span class="num">{{ c.date | date: 'yyyy/MM/dd' }}</span>
        </p>
      }
      <form [formGroup]="form" (ngSubmit)="saveCorrection()" novalidate>
        <div class="row g-3 mb-3">
          <div class="col-6">
            <label class="form-label" for="fix-in">وقت الحضور</label>
            <input id="fix-in" type="time" class="form-control" formControlName="clockIn" />
          </div>
          <div class="col-6">
            <label class="form-label" for="fix-out">وقت الانصراف</label>
            <input id="fix-out" type="time" class="form-control" formControlName="clockOut" />
          </div>
          <div class="col-12">
            <label class="form-label" for="fix-late">دقائق التأخير</label>
            <input id="fix-late" type="number" min="0" class="form-control" formControlName="lateMinutes" [class.is-invalid]="invalid('lateMinutes')" />
            <div class="invalid-feedback">أدخل رقمًا صفر أو أكثر.</div>
          </div>
        </div>
        <div class="mb-4">
          <label class="form-label" for="fix-notes">ملاحظة التدقيق (إلزامية)</label>
          <textarea id="fix-notes" rows="3" class="form-control" formControlName="notes" placeholder="سبب التعديل اليدوي…" [class.is-invalid]="invalid('notes')"></textarea>
          <div class="invalid-feedback">اكتب سبب التعديل (3 أحرف على الأقل) ليُسجَّل في التدقيق.</div>
        </div>
        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn btn-light border" (click)="correcting.set(null)">إلغاء</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm ms-2" aria-hidden="true"></span>
            }
            حفظ التصحيح
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class HrAttendanceComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(AttendanceService);
  private readonly departmentApi = inject(DepartmentService);
  private readonly employeeApi = inject(EmployeeService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly tab = signal<Tab>('monitor');
  readonly departments = signal<Department[]>([]);
  readonly employees = signal<Employee[]>([]);

  /* Monitor */
  readonly deptId = signal<number | null>(null);
  readonly date = signal(todayIso());
  readonly records = signal<AttendanceRecord[]>([]);
  readonly monitorLoading = signal(false);
  readonly monitorError = signal<string | null>(null);
  readonly counts = computed(() => {
    const c = { present: 0, late: 0, absent: 0 };
    for (const r of this.records()) c[attendanceKey(r)]++;
    return c;
  });

  /* Tardiness inspector */
  readonly tardEmployeeId = signal<number | null>(null);
  readonly tardMonth = signal(currentMonthInput());
  readonly tardiness = signal<TardinessSummary | null>(null);
  readonly tardLoading = signal(false);
  readonly tardError = signal<string | null>(null);

  /* Device logs */
  readonly logs = signal<DeviceLog[]>([]);
  readonly logsLoading = signal(false);
  readonly logsError = signal<string | null>(null);
  readonly logFilter = signal<LogFilter>('all');
  readonly logPageNo = signal(1);
  readonly logPageSize = 15;
  private logsLoaded = false;

  readonly filteredLogs = computed(() => {
    const f = this.logFilter();
    return this.logs().filter((l) => {
      if (f === 'processed') return l.processed && !l.errorMessage;
      if (f === 'failed') return !l.processed || !!l.errorMessage;
      return true;
    });
  });
  readonly logPage = computed(() => {
    const start = (this.logPageNo() - 1) * this.logPageSize;
    return this.filteredLogs().slice(start, start + this.logPageSize);
  });

  /* Manual correction */
  readonly correcting = signal<AttendanceRecord | null>(null);
  readonly saving = signal(false);
  readonly form = this.fb.group({
    clockIn: [''],
    clockOut: [''],
    lateMinutes: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    notes: ['', [Validators.required, Validators.minLength(3)]],
  });

  clock = clockText;
  key = attendanceKey;

  ngOnInit(): void {
    forkJoin({ departments: this.departmentApi.list(), employees: this.employeeApi.list() }).subscribe({
      next: (r) => {
        this.departments.set(r.departments);
        this.employees.set(r.employees);

        const empParam = Number(this.route.snapshot.queryParamMap.get('employeeId'));
        if (empParam) {
          this.tardEmployeeId.set(empParam);
          this.tab.set('tardiness');
          this.loadTardiness();
        }
        if (r.departments.length) {
          this.deptId.set(r.departments[0].id);
          this.loadMonitor();
        }
      },
      error: (e: Error) => this.toast.error('تعذر تحميل الأقسام والموظفين: ' + e.message),
    });
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'logs' && !this.logsLoaded) this.loadLogs();
  }

  /* ───── Monitor ───── */
  onDept(value: string): void {
    this.deptId.set(value ? Number(value) : null);
    this.loadMonitor();
  }
  onDate(value: string): void {
    if (value) {
      this.date.set(value);
      this.loadMonitor();
    }
  }

  loadMonitor(): void {
    const dept = this.deptId();
    if (!dept) return;
    this.monitorLoading.set(true);
    this.monitorError.set(null);
    this.api
      .byDepartmentAndDate(dept, this.date())
      .pipe(finalize(() => this.monitorLoading.set(false)))
      .subscribe({
        next: (list) => this.records.set(list),
        error: (e: Error) => {
          this.records.set([]);
          this.monitorError.set('تعذر تحميل الحضور: ' + e.message);
        },
      });
  }

  /* ───── Tardiness ───── */
  onTardEmployee(value: string): void {
    this.tardEmployeeId.set(value ? Number(value) : null);
    this.loadTardiness();
  }
  onTardMonth(value: string): void {
    if (parseMonthInput(value)) {
      this.tardMonth.set(value);
      this.loadTardiness();
    }
  }

  loadTardiness(): void {
    const id = this.tardEmployeeId();
    const ym = parseMonthInput(this.tardMonth());
    if (!id || !ym) {
      this.tardiness.set(null);
      return;
    }
    this.tardLoading.set(true);
    this.tardError.set(null);
    this.api
      .tardiness(id, ym.year, ym.month)
      .pipe(finalize(() => this.tardLoading.set(false)))
      .subscribe({
        next: (t) => this.tardiness.set(t),
        error: (e: Error) => {
          this.tardiness.set(null);
          this.tardError.set('تعذر تحميل ملخص التأخير: ' + e.message);
        },
      });
  }

  /* ───── Device logs ───── */
  onLogFilter(value: string): void {
    this.logFilter.set(value as LogFilter);
    this.logPageNo.set(1);
  }

  loadLogs(): void {
    this.logsLoaded = true;
    this.logsLoading.set(true);
    this.logsError.set(null);
    this.api
      .deviceLogs()
      .pipe(finalize(() => this.logsLoading.set(false)))
      .subscribe({
        next: (list) => {
          this.logs.set(list);
          this.logPageNo.set(1);
        },
        error: (e: Error) => this.logsError.set('تعذر تحميل سجلات الأجهزة: ' + e.message),
      });
  }

  /* ───── Correction ───── */
  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  openCorrection(r: AttendanceRecord): void {
    this.form.reset({
      clockIn: clockInput(r.clockIn),
      clockOut: clockInput(r.clockOut),
      lateMinutes: r.lateMinutes || 0,
      notes: '',
    });
    this.correcting.set(r);
  }

  saveCorrection(): void {
    const record = this.correcting();
    if (!record) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .update(record.id, {
        clockIn: toClockPayload(record.clockIn, record.date, v.clockIn),
        clockOut: toClockPayload(record.clockOut, record.date, v.clockOut),
        lateMinutes: Number(v.lateMinutes) || 0,
        notes: v.notes.trim(),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('تم حفظ التصحيح');
          this.correcting.set(null);
          this.loadMonitor();
        },
        error: () => undefined,
      });
  }
}
