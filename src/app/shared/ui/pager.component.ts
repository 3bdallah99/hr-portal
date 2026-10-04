import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > pageSize()) {
      <nav class="pager" aria-label="التنقل بين الصفحات">
        <span class="pager-info">{{ from() }}–{{ to() }} من {{ total() }}</span>
        <div class="d-flex align-items-center gap-2">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            aria-label="الصفحة السابقة"
            [disabled]="page() <= 1"
            (click)="pageChange.emit(page() - 1)"
          >
            <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
          </button>
          <span class="small text-muted">{{ page() }} / {{ pages() }}</span>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            aria-label="الصفحة التالية"
            [disabled]="page() >= pages()"
            (click)="pageChange.emit(page() + 1)"
          >
            <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
          </button>
        </div>
      </nav>
    }
  `,
})
export class PagerComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  readonly to = computed(() => Math.min(this.page() * this.pageSize(), this.total()));
}
