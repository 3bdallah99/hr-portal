import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { Department, Position } from '../../core/models';
import { DepartmentService } from '../../core/services/department.service';
import { PositionService } from '../../core/services/position.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../shared/ui/toast.service';

@Component({
  selector: 'app-positions',
  imports: [ReactiveFormsModule, MoneyPipe, PageHeaderComponent, ModalComponent, SkeletonComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'الوظائف'" [subtitle]="items().length + ' وظيفة'">
      <button type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="fa-solid fa-plus ms-2" aria-hidden="true"></i>إضافة وظيفة
      </button>
    </app-page-header>

    @if (loadError()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
        <span>{{ loadError() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="load()">إعادة المحاولة</button>
      </div>
    }

    <section class="data-card">
      @if (loading()) {
        <app-skeleton [count]="6" />
      } @else if (!items().length) {
        <app-empty-state icon="fa-id-badge" heading="لا توجد وظائف بعد" text="أضف قسمًا أولًا ثم أضف الوظائف." />
      } @else {
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead>
              <tr>
                <th>الوظيفة</th>
                <th>القسم</th>
                <th>الراتب المرجعي</th>
                <th class="text-end">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              @for (p of items(); track p.id) {
                <tr>
                  <td><strong>{{ p.title }}</strong></td>
                  <td>@if (p.departmentName) { <span class="chip">{{ p.departmentName }}</span> } @else { — }</td>
                  <td class="num">{{ p.baseSalary | money }}</td>
                  <td class="text-end row-actions">
                    <button type="button" class="icon-btn" title="تعديل" aria-label="تعديل" (click)="openEdit(p)">
                      <i class="fa-solid fa-pen" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="icon-btn danger" title="حذف" aria-label="حذف" (click)="remove(p)">
                      <i class="fa-solid fa-trash" aria-hidden="true"></i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <app-modal [open]="modalOpen()" [title]="editingId() ? 'تعديل الوظيفة' : 'إضافة وظيفة'" (closed)="modalOpen.set(false)">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="mb-3">
          <label class="form-label" for="pos-title">المسمى الوظيفي</label>
          <input id="pos-title" class="form-control" formControlName="title" [class.is-invalid]="invalid('title')" />
          <div class="invalid-feedback">المسمى الوظيفي مطلوب.</div>
        </div>
        <div class="mb-3">
          <label class="form-label" for="pos-salary">الراتب المرجعي (ج.م)</label>
          <input id="pos-salary" type="number" min="0" class="form-control" formControlName="baseSalary" [class.is-invalid]="invalid('baseSalary')" />
          <div class="invalid-feedback">أدخل راتبًا صحيحًا (صفر أو أكثر).</div>
          <div class="form-text">يُستخدم كقيمة مبدئية عند تصميم هيكل راتب موظف جديد.</div>
        </div>
        <div class="mb-4">
          <label class="form-label" for="pos-dept">القسم</label>
          <select id="pos-dept" class="form-select" formControlName="departmentId" [class.is-invalid]="invalid('departmentId')">
            <option [ngValue]="null">اختر القسم…</option>
            @for (d of departments(); track d.id) {
              <option [ngValue]="d.id">{{ d.name }}</option>
            }
          </select>
          <div class="invalid-feedback">اختر القسم.</div>
        </div>
        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn btn-light border" (click)="modalOpen.set(false)">إلغاء</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm ms-2" aria-hidden="true"></span>
            }
            حفظ
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class PositionsComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(PositionService);
  private readonly departmentApi = inject(DepartmentService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly items = signal<Position[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly modalOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    baseSalary: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    departmentId: this.fb.control<number | null>(null, Validators.required),
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({ positions: this.api.list(), departments: this.departmentApi.list() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => {
          this.items.set(r.positions);
          this.departments.set(r.departments);
        },
        error: (e: Error) => this.loadError.set('تعذر تحميل الوظائف: ' + e.message),
      });
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset();
    this.modalOpen.set(true);
  }

  openEdit(p: Position): void {
    this.editingId.set(p.id);
    this.form.reset({ title: p.title, baseSalary: p.baseSalary, departmentId: p.departmentId });
    this.modalOpen.set(true);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload = { title: v.title.trim(), baseSalary: v.baseSalary as number, departmentId: v.departmentId as number };
    const id = this.editingId();
    this.saving.set(true);
    (id ? this.api.update(id, payload) : this.api.create(payload)).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.toast.success('تم حفظ الوظيفة');
        this.modalOpen.set(false);
        this.load();
      },
      error: () => undefined,
    });
  }

  async remove(p: Position): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'حذف الوظيفة',
      message: `سيتم حذف وظيفة «${p.title}».`,
      confirmText: 'نعم، احذف',
    });
    if (!ok) return;
    this.api.remove(p.id).subscribe({
      next: () => {
        this.toast.success('تم حذف الوظيفة');
        this.load();
      },
      error: () => undefined,
    });
  }
}
