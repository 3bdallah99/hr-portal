import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state">
      <span class="empty-icon" aria-hidden="true"><i class="fa-solid" [class]="icon()"></i></span>
      <h3>{{ heading() }}</h3>
      @if (text()) {
        <p>{{ text() }}</p>
      }
      <div class="empty-actions"><ng-content /></div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input('fa-inbox');
  readonly heading = input.required<string>();
  readonly text = input('');
}
