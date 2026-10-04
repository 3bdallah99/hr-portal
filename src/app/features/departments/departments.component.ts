import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { Department, Position } from '../../core/models';
import { DepartmentService } from '../../core/services/department.service';
import { PositionService } from '../../core/services/position.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../shared/ui/toast.service';

@Component({
  selector: 'app-departments',
  imports: [ReactiveFormsModule, PageHeaderComponent, ModalComponent, SkeletonComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'الأقسام'" [subtitle]="items().length + ' قسم'">
      <button type="button" class="btn btn-primary" (click)="openCreate()">
        <i class="fa-solid fa-plus ms-2" aria-hidden="true"></i>إضافة قسم
      </button>
    </app-page-header>

    @if (loadError()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
        <span>{{ loadError() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="load()">إعادة المحاولة</button>
      </div>
    }

    @if (loading()) {
      <app-skeleton variant="cards" [count]="6" />
    } @else if (!items().length) {
      <section class="data-card">
        <app-empty-state icon="fa-sitemap" heading="لا توجد أقسام بعد" text="أنشئ أول قسم ثم أضف له الوظائف والموظفين.">
          <button type="button" class="btn btn-primary" (click)="openCreate()">إضافة قسم</button>
        </app-empty-state>
      </section>
    } @else {
      <div class="dept-grid">
        @for (d of items(); track d.id) {
          <article class="dept-card">
            <header>
              <span class="dept-icon" aria-hidden="true"><i class="fa-solid fa-building"></i></span>
              <div>
                <h3>{{ d.name }}</h3>
                @if (d.headName) {
                  <small class="text-muted"><i class="fa-solid fa-user-tie ms-1" aria-hidden="true"></i>{{ d.headName }}</small>
                }
              </div>
              <div class="dept-actions">
                <button type="button" class="icon-btn" title="تعديل" aria-label="تعديل" (click)="openEdit(d)">
                  <i class="fa-solid fa-pen" aria-hidden="true"></i>
                </button>
                <button type="button" class="icon-btn danger" title="حذف" aria-label="حذف" (click)="remove(d)">
                  <i class="fa-solid fa-trash" aria-hidden="true"></i>
                </button>
              </div>
            </header>
            <div class="dept-stats">
              <span><strong>{{ d.employeeCount ?? 0 }}</strong> موظف</span>
              <span><strong>{{ positionsOf(d.id).length }}</strong> وظيفة</span>
            </div>
            <div class="dept-positions">
              @for (p of positionsOf(d.id); track p.id) {
                <span class="chip">{{ p.title }}</span>
              } @empty {
                <small class="text-muted">لا توجد وظائف مرتبطة.</small>
              }
            </div>
          </article>
        }
      </div>
    }

    <app-modal [open]="modalOpen()" [title]="editingId() ? 'تعديل القسم' : 'إضافة قسم'" (closed)="modalOpen.set(false)">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="mb-4">
          <label class="form-label" for="dept-name">اسم القسم</label>
          <input id="dept-name" class="form-control" formControlName="name" [class.is-invalid]="invalid()" />
          <div class="invalid-feedback">اسم القسم مطلوب (حرفان على الأقل).</div>
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
export class DepartmentsComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(DepartmentService);
  private readonly positionApi = inject(PositionService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly items = signal<Department[]>([]);
  private readonly positions = signal<Position[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly modalOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);

  private readonly byDept = computed(() => {
    const map = new Map<number, Position[]>();
    for (const p of this.positions()) {
      const list = map.get(p.departmentId) ?? [];
      list.push(p);
      map.set(p.departmentId, list);
    }
    return map;
  });

  readonly form = this.fb.group({ name: ['', [Validators.required, Validators.minLength(2)]] });

  ngOnInit(): void {
    this.load();
  }

  positionsOf(departmentId: number): Position[] {
    return this.byDept().get(departmentId) ?? [];
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({ departments: this.api.list(), positions: this.positionApi.list() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => {
          this.items.set(r.departments);
          this.positions.set(r.positions);
        },
        error: (e: Error) => this.loadError.set('تعذر تحميل الأقسام: ' + e.message),
      });
  }

  invalid(): boolean {
    const c = this.form.controls.name;
    return c.invalid && (c.touched || c.dirty);
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset();
    this.modalOpen.set(true);
  }

  openEdit(d: Department): void {
    this.editingId.set(d.id);
    this.form.reset({ name: d.name });
    this.modalOpen.set(true);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const name = this.form.controls.name.value.trim();
    const id = this.editingId();
    this.saving.set(true);
    (id ? this.api.update(id, name) : this.api.create(name)).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.toast.success('تم حفظ القسم');
        this.modalOpen.set(false);
        this.load();
      },
      error: () => undefined,
    });
  }

  async remove(d: Department): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'حذف القسم',
      message: `سيتم حذف قسم «${d.name}». لو فيه موظفون أو وظائف قد يرفض النظام الحذف.`,
      confirmText: 'نعم، احذف',
    });
    if (!ok) return;
    this.api.remove(d.id).subscribe({
      next: () => {
        this.toast.success('تم حذف القسم');
        this.load();
      },
      error: () => undefined,
    });
  }
}
