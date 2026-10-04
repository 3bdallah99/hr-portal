import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TARDINESS_ALLOWANCE_MINUTES } from '../../core/constants';

/** عدّاد سماحية التأخير الشهرية (افتراضيًا 60 دقيقة). */
@Component({
  selector: 'app-tardiness-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tard" [class]="'tard tard-' + state()">
      <header>
        <span class="tard-title"><i class="fa-solid fa-stopwatch" aria-hidden="true"></i> {{ title() }}</span>
        <span class="tard-figure"><strong>{{ used() }}</strong> / {{ allowed() }} دقيقة</span>
      </header>
      <div
        class="tard-track"
        role="progressbar"
        aria-valuemin="0"
        [attr.aria-valuemax]="allowed()"
        [attr.aria-valuenow]="used()"
        aria-label="دقائق التأخير المستخدمة"
      >
        <span [style.width.%]="percent()"></span>
      </div>
      <footer>
        @if (deductible() > 0) {
          <span><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> {{ deductible() }} دقيقة تُخصم من الراتب</span>
        } @else {
          <span><i class="fa-solid fa-circle-check" aria-hidden="true"></i> متبقٍ {{ allowed() - used() }} دقيقة من السماحية</span>
        }
        @if (occurrences() !== null) {
          <span class="text-muted">{{ occurrences() }} مرة تأخير</span>
        }
      </footer>
    </section>
  `,
})
export class TardinessMeterComponent {
  readonly used = input.required<number>();
  readonly allowed = input(TARDINESS_ALLOWANCE_MINUTES);
  readonly occurrences = input<number | null>(null);
  readonly title = input('سماحية التأخير الشهرية');

  readonly percent = computed(() => {
    const a = this.allowed();
    return a > 0 ? Math.min(100, Math.round((this.used() / a) * 100)) : 100;
  });
  readonly deductible = computed(() => Math.max(0, this.used() - this.allowed()));
  readonly state = computed<'safe' | 'warn' | 'over'>(() => {
    if (this.used() > this.allowed()) return 'over';
    return this.percent() >= 75 ? 'warn' : 'safe';
  });
}
