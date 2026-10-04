import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../../shared/ui/toast.service';
import { ApiError, toApiError } from './api-error';

/** مرّره في HttpContext لمنع الـ Toast التلقائي لطلب معيّن. */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  if (!token || !req.url.startsWith(environment.apiUrl)) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

/**
 * - 401 (وهناك جلسة): تسجيل خروج + تنبيه.
 * - فشل أي عملية كتابة (POST/PUT/DELETE): Toast برسالة الـ API (ProblemDetails / errors).
 * - فشل القراءة (GET) لا يُعرض كـ Toast لأن كل شاشة تعرض حالة خطأ مع «إعادة المحاولة».
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);

  return next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse) {
        const body = event.body as { success?: boolean; message?: string } | null;
        if (body && body.success === false) {
          throw new ApiError(body.message || 'تعذر تنفيذ العملية.', event.status);
        }
      }
      return event;
    }),
    catchError((err: unknown) => {
      let apiError: ApiError;
      if (err instanceof HttpErrorResponse) apiError = toApiError(err);
      else if (err instanceof ApiError) apiError = err;
      else return throwError(() => err);

      const isLogin = req.url.endsWith('/Auth/login');
      if (apiError.status === 401 && !isLogin && auth.token()) {
        auth.logout();
        toast.warning('انتهت الجلسة. سجّل الدخول من جديد.');
      } else if (!isLogin && req.method !== 'GET' && !req.context.get(SILENT_ERRORS)) {
        toast.error(apiError.message);
      }
      return throwError(() => apiError);
    }),
  );
};
