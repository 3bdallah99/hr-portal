import { Directive, computed, input } from '@angular/core';

const PALETTE = [
  ['#6366f1', '#3b82f6'],
  ['#8b5cf6', '#6366f1'],
  ['#0ea5e9', '#2563eb'],
  ['#10b981', '#0d9488'],
  ['#f59e0b', '#ea580c'],
  ['#ec4899', '#8b5cf6'],
  ['#14b8a6', '#0ea5e9'],
  ['#ef4444', '#f97316'],
];

/** لون تدرّج ثابت لكل اسم: <span class="avatar" [appAvatar]="name">{{ initial }}</span> */
@Directive({
  selector: '[appAvatar]',
  standalone: true,
  host: { '[style.background]': 'gradient()' },
})
export class AvatarDirective {
  readonly appAvatar = input<string | null | undefined>('');

  readonly gradient = computed(() => {
    const name = (this.appAvatar() ?? '').trim();
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const [a, b] = PALETTE[h % PALETTE.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
  });
}
