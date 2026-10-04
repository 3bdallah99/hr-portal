import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../shared/ui/toast.service';
import { TOKEN_STORAGE_KEY } from '../constants';
import { ApiResponse } from '../models';
import { JwtClaims, isExpired, parseJwt } from '../util/jwt';

export type Role = 'HR' | 'Employee';

export interface Session {
  name: string;
  role: Role;
  employeeId: number | null;
  permissions: string[];
}

const ROLE_CLAIMS = ['http://schemas.microsoft.com/ws/2008/06/identity/claims/role', 'role'];
const NAME_CLAIMS = ['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', 'name', 'unique_name'];
const MAX_TIMEOUT = 2_147_483_647;

function claimValues(claims: JwtClaims, keys: string[]): string[] {
  for (const key of keys) {
    const v = claims[key];
    if (v !== undefined && v !== null) return Array.isArray(v) ? v.map(String) : [String(v)];
  }
  return [];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly _token = signal<string | null>(this.readStoredToken());
  readonly token = this._token.asReadonly();

  /** تُحسب مرة واحدة من التوكن وتُخزَّن (claims caching). null = لا جلسة صالحة. */
  readonly session = computed<Session | null>(() => {
    const token = this._token();
    if (!token) return null;
    const claims = parseJwt(token);
    if (!claims || isExpired(claims)) return null;

    const roles = claimValues(claims, ROLE_CLAIMS);
    const role: Role | null = roles.includes('HR') ? 'HR' : roles.includes('Employee') ? 'Employee' : null;
    if (!role) return null;

    const employeeId = Number(claims['EmployeeId']);
    return {
      name: claimValues(claims, NAME_CLAIMS)[0] ?? '',
      role,
      employeeId: Number.isFinite(employeeId) && employeeId > 0 ? employeeId : null,
      permissions: claimValues(claims, ['Permission']),
    };
  });

  readonly isAuthenticated = computed(() => this.session() !== null);

  constructor() {
    // تسجيل خروج تلقائي لحظة انتهاء صلاحية التوكن
    effect((onCleanup) => {
      const token = this._token();
      const claims = token ? parseJwt(token) : null;
      if (!claims || typeof claims.exp !== 'number') return;

      const remaining = claims.exp * 1000 - Date.now();
      if (remaining <= 0) {
        this.clear();
        return;
      }
      const handle = setTimeout(() => {
        this.toast.warning('انتهت صلاحية الجلسة. سجّل الدخول من جديد.');
        this.logout();
      }, Math.min(remaining, MAX_TIMEOUT));
      onCleanup(() => clearTimeout(handle));
    });
  }

  homeUrl(): string {
    switch (this.session()?.role) {
      case 'HR':
        return '/hr/dashboard';
      case 'Employee':
        return '/portal';
      default:
        return '/login';
    }
  }

  login(email: string, password: string, remember: boolean): Observable<void> {
    return this.http
      .post<ApiResponse<string>>(`${environment.apiUrl}/Auth/login`, { email, password })
      .pipe(
        tap((res) => this.setToken(res.data, remember)),
        map(() => undefined),
      );
  }

  /** POST /api/auth/change-password */
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http
      .post<ApiResponse<unknown>>(`${environment.apiUrl}/Auth/change-password`, { currentPassword, newPassword })
      .pipe(map(() => undefined));
  }

  clear(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      /* التخزين غير متاح */
    }
    this._token.set(null);
  }

  logout(): void {
    this.clear();
    void this.router.navigateByUrl('/login');
  }

  /** «تذكرني» = localStorage، وإلا sessionStorage (تنتهي بإغلاق التبويب). */
  private setToken(token: string, remember: boolean): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      (remember ? localStorage : sessionStorage).setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      /* التخزين غير متاح: الجلسة تعمل في الذاكرة فقط */
    }
    this._token.set(token);
  }

  private readStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY) ?? sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
