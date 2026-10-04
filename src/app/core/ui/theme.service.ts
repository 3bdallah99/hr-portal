import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const KEY = 'hr.theme';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* التخزين غير متاح */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Light/Dark: يضبط data-theme (ألواننا) و data-bs-theme (مكوّنات Bootstrap) ويحفظ الاختيار. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(initialTheme());

  constructor() {
    effect(() => {
      const t = this.theme();
      const root = document.documentElement;
      root.setAttribute('data-theme', t);
      root.setAttribute('data-bs-theme', t);
      try {
        localStorage.setItem(KEY, t);
      } catch {
        /* تجاهل */
      }
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }
}
