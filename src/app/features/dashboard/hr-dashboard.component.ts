import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Employee, LeaveRequest } from '../../core/models';
import { DepartmentService } from '../../core/services/department.service';
import { EmployeeService } from '../../core/services/employee.service';
import { LeaveService } from '../../core/services/leave.service';
import { PositionService } from '../../core/services/position.service';
import { leaveStatusKey, leaveTypeLabel } from '../../core/util/leave';
import { AvatarDirective } from '../../shared/ui/avatar.directive';
import { BarListComponent } from '../../shared/ui/bar-list.component';
import { ChartSegment, DonutChartComponent } from '../../shared/ui/donut-chart.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';

@Component({
  selector: 'app-hr-dashboard',
  imports: [
    RouterLink,
    DatePipe,
    AvatarDirective,
    KpiCardComponent,
    SkeletonComponent,
    EmptyStateComponent,
    DonutChartComponent,
    BarListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="hero-inner">
        <div>
          <h1>{{ greeting() }}، {{ firstName() }}</h1>
          <p>
            @if (pending().length) {
              لديك <strong>{{ pending().length }}</strong> طلب إجازة بانتظار قرارك اليوم.
            } @else {
              لا توجد طلبات معلّقة — كل شيء تحت السيطرة.
            }
          </p>
        </div>
        <div class="hero-actions">
          <a routerLink="/hr/leaves" class="btn btn-light"><i class="fa-solid fa-calendar-check ms-2" aria-hidden="true"></i>مراجعة الطلبات</a>
          <a routerLink="/hr/payroll/run" class="btn btn-ghost"><i class="fa-solid fa-money-check-dollar ms-2" aria-hidden="true"></i>تشغيل الرواتب</a>
        </div>
      </div>
    </section>

    @if (loadError()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
        <span>{{ loadError() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="load()">إعادة المحاولة</button>
      </div>
    }

    @if (loading()) {
      <app-skeleton variant="cards" [count]="4" />
    } @else {
      <div class="kpi-grid">
        <app-kpi-card label="موظفون نشطون" [value]="activeCount()" icon="fa-users" tone="indigo" [hint]="'من أصل ' + employees().length" />
        <app-kpi-card label="طلبات قيد المراجعة" [value]="pending().length" icon="fa-hourglass-half" tone="amber" hint="تنتظر قرار الـ HR" />
        <app-kpi-card label="الأقسام" [value]="departmentCount()" icon="fa-sitemap" tone="emerald" />
        <app-kpi-card label="الوظائف" [value]="positionCount()" icon="fa-id-badge" tone="slate" />
      </div>

      <div class="row g-4 mt-1">
        <div class="col-lg-7">
          <section class="data-card h-100">
            <header class="card-head">
              <h2>أحدث الطلبات المعلّقة</h2>
              <a routerLink="/hr/leaves" class="link-more">عرض الكل <i class="fa-solid fa-arrow-left" aria-hidden="true"></i></a>
            </header>
            @if (!pending().length) {
              <app-empty-state icon="fa-circle-check" heading="لا توجد طلبات معلّقة" text="كل الطلبات تمت مراجعتها." />
            } @else {
              <ul class="plain-list">
                @for (r of latest(); track r.id) {
                  <li>
                    <div class="person">
                      <span class="avatar" [appAvatar]="r.employeeName" aria-hidden="true">{{ (r.employeeName || '#').trim().charAt(0) }}</span>
                      <span>
                        <strong>{{ r.employeeName || '#' + r.employeeId }}</strong>
                        <small>{{ typeLabel(r.leaveType) }} · <span class="num">{{ r.startDate | date: 'yyyy/MM/dd' }}</span> ← <span class="num">{{ r.endDate | date: 'yyyy/MM/dd' }}</span></small>
                      </span>
                    </div>
                    <a routerLink="/hr/leaves" class="btn btn-sm btn-outline-primary">مراجعة</a>
                  </li>
                }
              </ul>
            }
          </section>
        </div>

        <div class="col-lg-5">
          <section class="data-card h-100">
            <header class="card-head"><h2>حالة طلبات الإجازة</h2></header>
            @if (!requests().length) {
              <app-empty-state icon="fa-chart-pie" heading="لا توجد بيانات بعد" text="ستظهر الإحصائية بعد أول طلب إجازة." />
            } @else {
              <app-donut-chart [segments]="statusSegments()" centerLabel="طلب" />
            }
          </section>
        </div>

        <div class="col-lg-7">
          <section class="data-card h-100">
            <header class="card-head"><h2>الموظفون حسب القسم</h2></header>
            @if (!headcount().length) {
              <app-empty-state icon="fa-sitemap" heading="لا توجد بيانات" />
            } @else {
              <app-bar-list [items]="headcount()" />
            }
          </section>
        </div>

        <div class="col-lg-5">
          <section class="data-card h-100">
            <header class="card-head"><h2>اختصارات</h2></header>
            <div class="shortcuts">
              <a routerLink="/hr/attendance"><i class="fa-solid fa-fingerprint" aria-hidden="true"></i> متابعة الحضور والبصمة</a>
              <a routerLink="/hr/payroll/structures"><i class="fa-solid fa-sliders" aria-hidden="true"></i> تصميم هيكل راتب</a>
              <a routerLink="/hr/balances"><i class="fa-solid fa-wallet" aria-hidden="true"></i> تخصيص أرصدة الإجازات</a>
              <a routerLink="/hr/employees"><i class="fa-solid fa-user-plus" aria-hidden="true"></i> إضافة موظف</a>
            </div>
          </section>
        </div>
      </div>
    }
  `,
})
export class HrDashboardComponent implements OnInit {
  private readonly employeesApi = inject(EmployeeService);
  private readonly departmentsApi = inject(DepartmentService);
  private readonly positionsApi = inject(PositionService);
  private readonly leavesApi = inject(LeaveService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly employees = signal<Employee[]>([]);
  readonly departmentCount = signal(0);
  readonly positionCount = signal(0);
  readonly requests = signal<LeaveRequest[]>([]);

  readonly activeCount = computed(() => this.employees().filter((e) => e.isActive).length);
  readonly pending = computed(() => this.requests().filter((r) => leaveStatusKey(r.status) === 'pending'));
  readonly latest = computed(() => this.pending().slice(0, 5));

  /** من البيانات الفعلية فقط. */
  readonly statusSegments = computed<ChartSegment[]>(() => {
    const c = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    for (const r of this.requests()) c[leaveStatusKey(r.status)]++;
    return [
      { label: 'قيد المراجعة', value: c.pending, color: '#f59e0b' },
      { label: 'مقبولة', value: c.approved, color: '#10b981' },
      { label: 'مرفوضة', value: c.rejected, color: '#ef4444' },
      { label: 'ملغاة', value: c.cancelled, color: '#8b95b3' },
    ];
  });

  readonly headcount = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.employees().filter((x) => x.isActive)) {
      const key = e.departmentName || 'بدون قسم';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  });

  readonly firstName = computed(() => (this.auth.session()?.name || '').trim().split(/\s+/)[0] || 'مرحبًا');
  readonly greeting = (): string => {
    const h = new Date().getHours();
    return h < 12 ? 'صباح الخير' : h < 18 ? 'مساء الخير' : 'مساء النور';
  };

  typeLabel = leaveTypeLabel;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      employees: this.employeesApi.list(),
      departments: this.departmentsApi.list(),
      positions: this.positionsApi.list(),
      requests: this.leavesApi.allRequests(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => {
          this.employees.set(r.employees);
          this.departmentCount.set(r.departments.length);
          this.positionCount.set(r.positions.length);
          this.requests.set(r.requests);
          this.leavesApi.pendingCount.set(r.requests.filter((x) => leaveStatusKey(x.status) === 'pending').length);
        },
        error: (e: Error) => this.loadError.set('تعذر تحميل بعض البيانات: ' + e.message),
      });
  }
}
