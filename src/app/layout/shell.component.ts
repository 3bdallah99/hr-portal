import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { LeaveService } from '../core/services/leave.service';
import { ThemeService } from '../core/ui/theme.service';
import { AvatarDirective } from '../shared/ui/avatar.directive';
import { ChangePasswordDialogComponent } from '../shared/ui/change-password-dialog.component';
import { CommandPaletteComponent, PaletteItem } from './command-palette.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: 'pending';
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const HR_NAV: NavGroup[] = [
  { title: 'نظرة عامة', items: [{ path: '/hr/dashboard', label: 'لوحة التحكم', icon: 'fa-gauge-high' }] },
  {
    title: 'الإجازات',
    items: [
      { path: '/hr/leaves', label: 'طلبات الإجازات', icon: 'fa-calendar-check', badge: 'pending' },
      { path: '/hr/balances', label: 'أرصدة الإجازات', icon: 'fa-wallet' },
    ],
  },
  { title: 'الحضور', items: [{ path: '/hr/attendance', label: 'الحضور والبصمة', icon: 'fa-fingerprint' }] },
  {
    title: 'الرواتب',
    items: [
      { path: '/hr/payroll/structures', label: 'هيكل الرواتب', icon: 'fa-sliders' },
      { path: '/hr/payroll/run', label: 'تشغيل الرواتب', icon: 'fa-money-check-dollar' },
    ],
  },
  {
    title: 'الهيكل التنظيمي',
    items: [
      { path: '/hr/employees', label: 'الموظفون', icon: 'fa-users' },
      { path: '/hr/departments', label: 'الأقسام', icon: 'fa-sitemap' },
      { path: '/hr/positions', label: 'الوظائف', icon: 'fa-id-badge' },
    ],
  },
];

const EMPLOYEE_NAV: NavGroup[] = [
  {
    title: 'بوابتي',
    items: [
      { path: '/portal', label: 'لوحتي', icon: 'fa-house-user' },
      { path: '/portal/attendance', label: 'حضوري', icon: 'fa-fingerprint' },
    ],
  },
];

const COLLAPSE_KEY = 'hr.sidebar.collapsed';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ChangePasswordDialogComponent, CommandPaletteComponent, AvatarDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'userMenuOpen.set(false)',
    '(document:keydown)': 'onKey($event)',
  },
  template: `
    <div class="shell" [class.collapsed]="collapsed()">
      <aside class="sidebar" [class.open]="menuOpen()" id="app-sidebar">
        <a class="brand" [routerLink]="auth.homeUrl()">
          <span class="brand-mark" aria-hidden="true"><i class="fa-solid fa-plus"></i></span>
          <span class="brand-text">
            <strong>الموارد البشرية</strong>
            <small>الإجازات · الحضور · الرواتب</small>
          </span>
        </a>

        <nav aria-label="القائمة الرئيسية">
          @for (group of nav(); track group.title) {
            <div class="nav-group">
              <span class="nav-title">{{ group.title }}</span>
              @for (item of group.items; track item.path) {
                <a [routerLink]="item.path" routerLinkActive="active" [attr.title]="collapsed() ? item.label : null" (click)="menuOpen.set(false)">
                  <i class="fa-solid" [class]="item.icon" aria-hidden="true"></i>
                  <span class="label">{{ item.label }}</span>
                  @if (item.badge === 'pending' && leaves.pendingCount() > 0) {
                    <span class="nav-badge" [attr.aria-label]="leaves.pendingCount() + ' طلب معلّق'">{{ leaves.pendingCount() }}</span>
                  }
                </a>
              }
            </div>
          }
        </nav>

        <button type="button" class="collapse-btn" [attr.aria-label]="collapsed() ? 'توسيع القائمة' : 'طيّ القائمة'" (click)="toggleCollapse()">
          <i class="fa-solid fa-angles-right" aria-hidden="true"></i>
          <span>طيّ القائمة</span>
        </button>
      </aside>

      @if (menuOpen()) {
        <div class="scrim" (click)="menuOpen.set(false)"></div>
      }

      <div class="main">
        <header class="topbar">
          <button type="button" class="top-btn menu-btn" aria-label="فتح القائمة" aria-controls="app-sidebar"
                  [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())">
            <i class="fa-solid fa-bars" aria-hidden="true"></i>
          </button>

          <button type="button" class="top-btn search-trigger" aria-label="بحث سريع" (click)="paletteOpen.set(true)">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <span>بحث سريع…</span>
            <kbd>Ctrl K</kbd>
          </button>

          <span class="top-spacer"></span>
          <span class="topbar-date">{{ today }}</span>

          @if (auth.session()?.role === 'HR') {
            <a class="top-btn" routerLink="/hr/leaves" [attr.aria-label]="'الطلبات المعلّقة: ' + leaves.pendingCount()" title="الطلبات المعلّقة">
              <i class="fa-regular fa-bell" aria-hidden="true"></i>
              @if (leaves.pendingCount() > 0) {
                <span class="dot">{{ leaves.pendingCount() }}</span>
              }
            </a>
          }

          <button type="button" class="top-btn" [attr.aria-label]="theme.theme() === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'"
                  [attr.title]="theme.theme() === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'" (click)="theme.toggle()">
            <i class="fa-solid" [class]="theme.theme() === 'dark' ? 'fa-sun' : 'fa-moon'" aria-hidden="true"></i>
          </button>

          <div class="user-menu">
            <button type="button" class="user-trigger" aria-haspopup="menu" [attr.aria-expanded]="userMenuOpen()" (click)="toggleUserMenu($event)">
              <span class="avatar" [appAvatar]="auth.session()?.name" style="width: 30px; height: 30px; border-radius: 9px; font-size: 0.8rem" aria-hidden="true">{{ initial() }}</span>
              <span class="user-info">
                <strong>{{ auth.session()?.name || 'مستخدم' }}</strong>
                <small>{{ roleLabel() }}</small>
              </span>
              <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </button>
            @if (userMenuOpen()) {
              <div class="menu-pop" role="menu" (click)="$event.stopPropagation()">
                <button type="button" role="menuitem" (click)="openPassword()">
                  <i class="fa-solid fa-key" aria-hidden="true"></i> تغيير كلمة المرور
                </button>
                <hr />
                <button type="button" role="menuitem" class="danger" (click)="auth.logout()">
                  <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i> تسجيل الخروج
                </button>
              </div>
            }
          </div>
        </header>
        <main class="content">
          <router-outlet />
        </main>
      </div>
    </div>

    <app-change-password-dialog [open]="passwordOpen()" (closed)="passwordOpen.set(false)" />
    <app-command-palette [open]="paletteOpen()" [items]="paletteItems()" (closed)="paletteOpen.set(false)" />
  `,
})
export class ShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly leaves = inject(LeaveService);
  readonly theme = inject(ThemeService);

  readonly menuOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly passwordOpen = signal(false);
  readonly paletteOpen = signal(false);
  readonly collapsed = signal(this.readCollapsed());

  readonly today = new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });

  readonly nav = computed(() => (this.auth.session()?.role === 'HR' ? HR_NAV : EMPLOYEE_NAV));
  readonly paletteItems = computed<PaletteItem[]>(() =>
    this.nav().flatMap((g) => g.items.map((i) => ({ label: i.label, path: i.path, icon: i.icon, group: g.title }))),
  );
  readonly roleLabel = computed(() => (this.auth.session()?.role === 'HR' ? 'الموارد البشرية' : 'موظف'));
  readonly initial = computed(() => (this.auth.session()?.name || 'م').trim().charAt(0));

  ngOnInit(): void {
    if (this.auth.session()?.role === 'HR') this.leaves.refreshPending();
  }

  onKey(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.paletteOpen.update((v) => !v);
    }
  }

  toggleCollapse(): void {
    this.collapsed.update((v) => !v);
    try {
      localStorage.setItem(COLLAPSE_KEY, this.collapsed() ? '1' : '0');
    } catch {
      /* تجاهل */
    }
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen.update((v) => !v);
  }

  openPassword(): void {
    this.userMenuOpen.set(false);
    this.passwordOpen.set(true);
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
