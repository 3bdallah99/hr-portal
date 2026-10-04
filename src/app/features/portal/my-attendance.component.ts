import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AttendanceRecord, TardinessSummary } from '../../core/models';
import { AttendanceService } from '../../core/services/attendance.service';
import { attendanceKey, clockText, currentMonthInput, parseMonthInput } from '../../core/util/attendance';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { TardinessMeterComponent } from '../../shared/ui/tardiness-meter.component';

@Component({
  selector: 'app-my-attendance',
  imports: [DatePipe, PageHeaderComponent, KpiCardComponent, StatusBadgeComponent, TardinessMeterComponent, SkeletonComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'حضوري'" subtitle="سجل البصمة الشهري وسماحية التأخير (الدوام من 09:00 صباحًا)">
      <input type="month" class="form-control w-auto" aria-label="الشهر" [value]="month()" (change)="onMonth($any($event.target).value)" />
    </app-page-header>

    @if (!employeeId) {
      <div class="alert alert-warning" role="alert">حسابك غير مرتبط بسجل موظف. تواصل مع الموارد البشرية لربطه.</div>
    } @else {
      <div class="row g-4 mb-4">
        <div class="col-lg-6">
          @if (tardiness(); as t) {
            <app-tardiness-meter [used]="t.totalLateMinutes" [allowed]="t.allowedMinutes || 60" [occurrences]="t.totalOccurrences" />
          } @else if (loading()) {
            <app-skeleton variant="cards" [count]="1" />
          } @else {
            <section class="data-card"><app-empty-state icon="fa-stopwatch" heading="لا تتوفر بيانات التأخير لهذا الشهر" /></section>
          }
        </div>
        <div class="col-lg-6">
          <div class="kpi-grid compact">
            <app-kpi-card label="أيام حضور" [value]="counts().present" icon="fa-user-check" tone="emerald" />
            <app-kpi-card label="أيام تأخير" [value]="counts().late" icon="fa-clock" tone="amber" />
            <app-kpi-card label="أيام غياب" [value]="counts().absent" icon="fa-user-xmark" tone="rose" />
          </div>
        </div>
      </div>

      <section class="data-card">
        @if (loading()) {
          <app-skeleton [count]="8" />
        } @else if (error()) {
          <div class="state-cell text-danger">
            {{ error() }} <button type="button" class="btn btn-sm btn-outline-danger me-2" (click)="load()">إعادة المحاولة</button>
          </div>
        } @else if (!records().length) {
          <app-empty-state icon="fa-calendar-day" heading="لا توجد سجلات حضور" text="لم تُسجَّل أي بصمات في هذا الشهر." />
        } @else {
          <div class="table-responsive">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>حضور</th>
                  <th>انصراف</th>
                  <th>الحالة</th>
                  <th>دقائق التأخير</th>
                </tr>
              </thead>
              <tbody>
                @for (r of records(); track r.id) {
                  <tr>
                    <td class="num">{{ r.date | date: 'EEE yyyy/MM/dd' }}</td>
                    <td class="num">{{ clock(r.clockIn) }}</td>
                    <td class="num">{{ clock(r.clockOut) }}</td>
                    <td><app-status-badge kind="attendance" [status]="key(r)" /></td>
                    <td class="num" [class.text-warning-emphasis]="r.lateMinutes > 0">{{ r.lateMinutes || 0 }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    }
  `,
})
export class MyAttendanceComponent implements OnInit {
  private readonly api = inject(AttendanceService);
  private readonly auth = inject(AuthService);

  readonly employeeId = this.auth.session()?.employeeId ?? null;
  readonly month = signal(currentMonthInput());
  readonly records = signal<AttendanceRecord[]>([]);
  readonly tardiness = signal<TardinessSummary | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly counts = computed(() => {
    const c = { present: 0, late: 0, absent: 0 };
    for (const r of this.records()) c[attendanceKey(r)]++;
    return c;
  });

  clock = clockText;
  key = attendanceKey;

  ngOnInit(): void {
    this.load();
  }

  onMonth(value: string): void {
    if (parseMonthInput(value)) {
      this.month.set(value);
      this.load();
    }
  }

  load(): void {
    const id = this.employeeId;
    const ym = parseMonthInput(this.month());
    if (!id || !ym) return;

    this.loading.set(true);
    this.error.set(null);
    this.tardiness.set(null);

    let pending = 2;
    const done = () => {
      if (--pending === 0) this.loading.set(false);
    };

    this.api
      .byEmployeeMonth(id, ym.year, ym.month)
      .pipe(finalize(done))
      .subscribe({
        next: (list) => this.records.set([...list].sort((a, b) => a.date.localeCompare(b.date))),
        error: (e: Error) => {
          this.records.set([]);
          this.error.set('تعذر تحميل سجل الحضور: ' + e.message);
        },
      });

    this.api
      .tardiness(id, ym.year, ym.month)
      .pipe(finalize(done))
      .subscribe({
        next: (t) => this.tardiness.set(t),
        error: () => this.tardiness.set(null),
      });
  }
}
