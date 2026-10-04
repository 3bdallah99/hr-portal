import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { DEFAULT_EMPLOYEE_PASSWORD } from '../../core/constants';
import { Department, Employee, EmployeePayload, Position } from '../../core/models';
import { DepartmentService } from '../../core/services/department.service';
import { EmployeeService } from '../../core/services/employee.service';
import { PositionService } from '../../core/services/position.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { AvatarDirective } from '../../shared/ui/avatar.directive';
import { DrawerComponent } from '../../shared/ui/drawer.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { PagerComponent } from '../../shared/ui/pager.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../shared/ui/toast.service';

type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-employees',
  imports: [
    AvatarDirective,
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    DrawerComponent,
    PagerComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'menuFor.set(null)' },
  template: `
    <app-page-header [title]="'الموظفون'" [subtitle]="employees().length + ' موظف مسجّل'">
      <button type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="fa-solid fa-user-plus ms-2" aria-hidden="true"></i>إضافة موظف
      </button>
    </app-page-header>

    @if (loadError()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
        <span>{{ loadError() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="load()">إعادة المحاولة</button>
      </div>
    }

    <section class="data-card">
      <div class="toolbar">
        <div class="search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input type="search" class="form-control" placeholder="ابحث بالاسم أو البريد أو القسم" aria-label="بحث في الموظفين"
                 [value]="search()" (input)="onSearch($any($event.target).value)" />
        </div>
        <select class="form-select w-auto" aria-label="تصفية بالقسم" [value]="deptFilter()" (change)="onDept($any($event.target).value)">
          <option value="">كل الأقسام</option>
          @for (d of departments(); track d.id) {
            <option [value]="d.id">{{ d.name }}</option>
          }
        </select>
        <select class="form-select w-auto" aria-label="تصفية بالحالة" [value]="statusFilter()" (change)="onStatus($any($event.target).value)">
          <option value="all">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </select>
      </div>

      @if (loading()) {
        <app-skeleton [count]="7" />
      } @else if (!filtered().length) {
        <app-empty-state
          icon="fa-users"
          [heading]="hasFilters() ? 'لا توجد نتائج مطابقة' : 'لا يوجد موظفون بعد'"
          [text]="hasFilters() ? 'جرّب تغيير البحث أو الفلاتر.' : 'أضف أول موظف لبدء إدارة فريقك.'"
        />
      } @else {
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead>
              <tr>
                <th>الموظف</th>
                <th>القسم</th>
                <th>الوظيفة</th>
                <th>الحالة</th>
                <th class="text-end">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              @for (e of pageItems(); track e.id) {
                <tr>
                  <td>
                    <div class="person">
                      <span class="avatar" [appAvatar]="e.name" aria-hidden="true">{{ e.name.trim().charAt(0) }}</span>
                      <span>
                        <strong>{{ e.name }}</strong>
                        <small dir="ltr">{{ e.email }}</small>
                      </span>
                    </div>
                  </td>
                  <td>@if (e.departmentName) { <span class="chip">{{ e.departmentName }}</span> } @else { — }</td>
                  <td>{{ e.positionTitle || '—' }}</td>
                  <td>
                    <div class="form-check form-switch m-0">
                      <input type="checkbox" role="switch" class="form-check-input" [id]="'act-' + e.id"
                             [checked]="e.isActive" [disabled]="togglingId() === e.id" (change)="toggleActive(e)"
                             [attr.aria-label]="'تفعيل ' + e.name" />
                      <label class="form-check-label small" [for]="'act-' + e.id">{{ e.isActive ? 'نشط' : 'غير نشط' }}</label>
                    </div>
                  </td>
                  <td class="text-end row-actions">
                    <div class="row-menu">
                      <button type="button" class="icon-btn" aria-label="المزيد" aria-haspopup="menu"
                              [attr.aria-expanded]="menuFor() === e.id" (click)="toggleMenu($event, e.id)">
                        <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
                      </button>
                      @if (menuFor() === e.id) {
                        <div class="menu-pop" role="menu" (click)="$event.stopPropagation()">
                          <button type="button" role="menuitem" (click)="openEdit(e)"><i class="fa-solid fa-pen" aria-hidden="true"></i> تعديل البيانات</button>
                          <a role="menuitem" routerLink="/hr/payroll/structures" [queryParams]="{ employeeId: e.id }"><i class="fa-solid fa-sliders" aria-hidden="true"></i> إعداد هيكل الراتب</a>
                          <a role="menuitem" routerLink="/hr/attendance" [queryParams]="{ employeeId: e.id }"><i class="fa-solid fa-fingerprint" aria-hidden="true"></i> عرض الحضور</a>
                          <button type="button" role="menuitem" (click)="createAccount(e)"><i class="fa-solid fa-key" aria-hidden="true"></i> إنشاء حساب دخول</button>
                          <hr />
                          <button type="button" role="menuitem" class="danger" (click)="remove(e)"><i class="fa-solid fa-trash" aria-hidden="true"></i> حذف</button>
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [page]="page()" [pageSize]="pageSize" [total]="filtered().length" (pageChange)="page.set($event)" />
      }
    </section>

    <app-drawer [open]="drawerOpen()" [heading]="editingId() ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'" (closed)="closeDrawer()">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="row g-3">
          <div class="col-12">
            <label class="form-label" for="emp-name">الاسم</label>
            <input id="emp-name" class="form-control" formControlName="name" [class.is-invalid]="invalid('name')" />
            <div class="invalid-feedback">الاسم مطلوب (3 أحرف على الأقل).</div>
          </div>
          <div class="col-12">
            <label class="form-label" for="emp-email">البريد الإلكتروني</label>
            <input id="emp-email" type="email" dir="ltr" class="form-control" formControlName="email" [class.is-invalid]="invalid('email')" />
            <div class="invalid-feedback">أدخل بريدًا إلكترونيًا صحيحًا.</div>
          </div>
          <div class="col-sm-6">
            <label class="form-label" for="emp-phone">رقم الهاتف</label>
            <input id="emp-phone" dir="ltr" class="form-control" formControlName="phoneNumber" [class.is-invalid]="invalid('phoneNumber')" />
            <div class="invalid-feedback">رقم الهاتف غير صالح.</div>
          </div>
          <div class="col-sm-6">
            <label class="form-label" for="emp-hire">تاريخ التعيين</label>
            <input id="emp-hire" type="date" class="form-control" formControlName="hireDate" [class.is-invalid]="invalid('hireDate')" />
            <div class="invalid-feedback">تاريخ التعيين مطلوب.</div>
          </div>
          <div class="col-sm-6">
            <label class="form-label" for="emp-dept">القسم</label>
            <select id="emp-dept" class="form-select" formControlName="departmentId" [class.is-invalid]="invalid('departmentId')">
              <option [ngValue]="null">اختر القسم…</option>
              @for (d of departments(); track d.id) {
                <option [ngValue]="d.id">{{ d.name }}</option>
              }
            </select>
            <div class="invalid-feedback">اختر القسم.</div>
          </div>
          <div class="col-sm-6">
            <label class="form-label" for="emp-pos">الوظيفة</label>
            <select id="emp-pos" class="form-select" formControlName="positionId" [class.is-invalid]="invalid('positionId')">
              <option [ngValue]="null">{{ selectedDeptId() ? 'اختر الوظيفة…' : 'اختر القسم أولًا' }}</option>
              @for (p of positionsForDept(); track p.id) {
                <option [ngValue]="p.id">{{ p.title }}</option>
              }
            </select>
            <div class="invalid-feedback">اختر الوظيفة.</div>
          </div>
          <div class="col-12">
            <label class="form-label" for="emp-address">العنوان</label>
            <input id="emp-address" class="form-control" formControlName="address" />
          </div>
          @if (editingId()) {
            <div class="col-12">
              <div class="form-check form-switch">
                <input id="emp-active" type="checkbox" role="switch" class="form-check-input" formControlName="isActive" />
                <label class="form-check-label" for="emp-active">الموظف نشط</label>
              </div>
            </div>
          }
        </div>

        <div class="drawer-actions">
          <button type="button" class="btn btn-light border" (click)="closeDrawer()">إلغاء</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm ms-2" aria-hidden="true"></span>
            }
            حفظ
          </button>
        </div>
      </form>
    </app-drawer>
  `,
})
export class EmployeesComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(EmployeeService);
  private readonly departmentApi = inject(DepartmentService);
  private readonly positionApi = inject(PositionService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  readonly employees = signal<Employee[]>([]);
  readonly departments = signal<Department[]>([]);
  private readonly allPositions = signal<Position[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('all');
  readonly deptFilter = signal('');
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly menuFor = signal<number | null>(null);
  readonly togglingId = signal<number | null>(null);

  readonly hasFilters = computed(() => !!this.search() || this.statusFilter() !== 'all' || !!this.deptFilter());

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const dept = this.deptFilter();
    return this.employees().filter((e) => {
      if (status === 'active' && !e.isActive) return false;
      if (status === 'inactive' && e.isActive) return false;
      if (dept && String(e.departmentId) !== dept) return false;
      if (!q) return true;
      return [e.name, e.email, e.departmentName, e.positionTitle].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  });

  readonly pageItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  readonly drawerOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', Validators.pattern(/^[0-9+\-\s]{7,15}$/)],
    hireDate: ['', Validators.required],
    address: [''],
    departmentId: this.fb.control<number | null>(null, Validators.required),
    positionId: this.fb.control<number | null>(null, Validators.required),
    isActive: [true],
  });

  readonly selectedDeptId = toSignal(this.form.controls.departmentId.valueChanges, { initialValue: null });
  readonly positionsForDept = computed(() => {
    const dept = this.selectedDeptId();
    return dept === null ? [] : this.allPositions().filter((p) => p.departmentId === dept);
  });

  constructor() {
    this.form.controls.departmentId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const positionId = this.form.controls.positionId.value;
      if (positionId !== null && !this.positionsForDept().some((p) => p.id === positionId)) {
        this.form.controls.positionId.setValue(null);
      }
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      employees: this.api.list(),
      departments: this.departmentApi.list(),
      positions: this.positionApi.list(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => {
          this.employees.set(r.employees);
          this.departments.set(r.departments);
          this.allPositions.set(r.positions);
        },
        error: (e: Error) => this.loadError.set('تعذر تحميل البيانات: ' + e.message),
      });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }
  onStatus(value: string): void {
    this.statusFilter.set(value as StatusFilter);
    this.page.set(1);
  }
  onDept(value: string): void {
    this.deptFilter.set(value);
    this.page.set(1);
  }

  toggleMenu(event: Event, id: number): void {
    event.stopPropagation();
    this.menuFor.update((cur) => (cur === id ? null : id));
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.controls.email.enable();
    this.form.reset();
    this.drawerOpen.set(true);
  }

  openEdit(employee: Employee): void {
    this.menuFor.set(null);
    this.api.get(employee.id).subscribe({
      next: (e) => {
        this.editingId.set(e.id);
        this.form.reset();
        this.form.patchValue({
          name: e.name,
          email: e.email,
          phoneNumber: e.phoneNumber ?? '',
          hireDate: e.hireDate?.slice(0, 10) ?? '',
          address: e.address ?? '',
          departmentId: e.departmentId ?? null,
          positionId: e.positionId ?? null,
          isActive: e.isActive,
        });
        this.form.controls.email.disable(); // البريد مرتبط بالحساب ولا يُعدّل
        this.drawerOpen.set(true);
      },
      error: (err: Error) => this.toast.error('تعذر تحميل بيانات الموظف: ' + err.message),
    });
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const id = this.editingId();
    const payload: EmployeePayload = {
      name: v.name.trim(),
      email: v.email.trim(),
      phoneNumber: v.phoneNumber.trim(),
      hireDate: v.hireDate,
      address: v.address.trim(),
      departmentId: v.departmentId as number,
      positionId: v.positionId as number,
      ...(id ? { isActive: v.isActive } : {}),
    };

    this.saving.set(true);
    const request$ = id ? this.api.update(id, payload) : this.api.create(payload);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.toast.success(id ? 'تم تعديل بيانات الموظف' : 'تمت إضافة الموظف');
        this.closeDrawer();
        this.load();
      },
      error: () => undefined,
    });
  }

  /** نقرأ السجل الكامل أولًا حتى لا نمسح حقولًا غير ظاهرة في الجدول. */
  toggleActive(employee: Employee): void {
    this.togglingId.set(employee.id);
    this.api.get(employee.id).subscribe({
      next: (e) => {
        const payload: EmployeePayload = {
          name: e.name,
          email: e.email,
          phoneNumber: e.phoneNumber ?? '',
          hireDate: e.hireDate?.slice(0, 10) ?? '',
          address: e.address ?? '',
          departmentId: e.departmentId as number,
          positionId: e.positionId as number,
          isActive: !e.isActive,
        };
        this.api
          .update(e.id, payload)
          .pipe(finalize(() => this.togglingId.set(null)))
          .subscribe({
            next: () => {
              this.toast.success(payload.isActive ? 'تم تفعيل الموظف' : 'تم إيقاف الموظف');
              this.load();
            },
            error: () => this.load(),
          });
      },
      error: () => {
        this.togglingId.set(null);
        this.load();
      },
    });
  }

  async remove(employee: Employee): Promise<void> {
    this.menuFor.set(null);
    const ok = await this.confirm.ask({
      title: 'حذف الموظف',
      message: `سيتم حذف «${employee.name}» نهائيًا ولا يمكن التراجع.`,
      confirmText: 'نعم، احذف',
    });
    if (!ok) return;
    this.api.remove(employee.id).subscribe({
      next: () => {
        this.toast.success('تم حذف الموظف');
        this.load();
      },
      error: () => undefined,
    });
  }

  async createAccount(employee: Employee): Promise<void> {
    this.menuFor.set(null);
    const ok = await this.confirm.ask({
      title: 'إنشاء حساب دخول',
      message: `سيُنشأ حساب للبريد ${employee.email} بكلمة المرور الافتراضية ${DEFAULT_EMPLOYEE_PASSWORD}. اطلب من الموظف تغييرها بعد أول دخول.`,
      confirmText: 'إنشاء الحساب',
      tone: 'primary',
    });
    if (!ok) return;
    this.api
      .registerAccount({
        email: employee.email,
        password: DEFAULT_EMPLOYEE_PASSWORD,
        userName: employee.email,
        employeeId: employee.id,
      })
      .subscribe({
        next: () => this.toast.success('تم إنشاء حساب الدخول'),
        error: () => undefined,
      });
  }
}
