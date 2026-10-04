import { HttpErrorResponse } from '@angular/common/http';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const FALLBACK: Record<number, string> = {
  0: 'تعذر الاتصال بالخادم. تأكد أن الـ API يعمل وأن العنوان صحيح.',
  401: 'بيانات الدخول غير صحيحة أو انتهت الجلسة.',
  403: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
  404: 'العنصر المطلوب غير موجود.',
  409: 'يوجد تعارض مع بيانات أخرى.',
  429: 'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.',
  500: 'حدث خطأ في الخادم. حاول لاحقًا.',
};

/** يحوّل أي HttpErrorResponse (حتى لو الـ body فاضي زي 401/403) لرسالة عربية مفهومة. */
export function toApiError(err: HttpErrorResponse): ApiError {
  const body = err.error as { message?: string; errors?: unknown } | string | null;
  const bodyObj = body && typeof body === 'object' ? body : null;
  const details = Array.isArray(bodyObj?.errors) ? (bodyObj.errors as unknown[]).map(String) : [];
  const serverMessage = bodyObj?.message;

  const message =
    serverMessage ||
    (details.length ? details.join('، ') : undefined) ||
    FALLBACK[err.status] ||
    (err.status >= 500 ? FALLBACK[500] : 'حدث خطأ غير متوقع.');

  return new ApiError(message, err.status, details);
}
