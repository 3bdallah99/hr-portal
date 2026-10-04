import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../http/api-error';
import {
  ApiResponse,
  Paged,
  PayrollRunRequest,
  PayrollRunResult,
  Payslip,
  PayslipAdjustPayload,
  SalaryStructure,
} from '../models';
import { unwrapItems } from '../util/unwrap';

@Injectable({ providedIn: 'root' })
export class PayrollService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/Payroll`;

  /** GET /api/payroll/salary-structure/{employeeId} — يرجع null لو لم يُعرَّف بعد (404). */
  getStructure(employeeId: number): Observable<SalaryStructure | null> {
    return this.http.get<ApiResponse<SalaryStructure | null>>(`${this.base}/salary-structure/${employeeId}`).pipe(
      map((r) => r.data ?? null),
      catchError((e: unknown) =>
        e instanceof ApiError && e.status === 404 ? of(null) : throwError(() => e),
      ),
    );
  }

  /** POST /api/payroll/salary-structure/{employeeId} (Upsert) */
  saveStructure(employeeId: number, payload: SalaryStructure): Observable<unknown> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/salary-structure/${employeeId}`, payload)
      .pipe(map((r) => r.data));
  }

  /** POST /api/payroll/run */
  run(payload: PayrollRunRequest): Observable<PayrollRunResult> {
    return this.http.post<ApiResponse<PayrollRunResult>>(`${this.base}/run`, payload).pipe(map((r) => r.data));
  }

  /** GET /api/payroll?month=&year=&departmentId= */
  list(month: number, year: number, departmentId: number | null): Observable<Payslip[]> {
    const params: Record<string, number> = { month, year, pageSize: 1000 };
    if (departmentId) params['departmentId'] = departmentId;
    return this.http
      .get<ApiResponse<Payslip[] | Paged<Payslip>>>(this.base, { params })
      .pipe(map((r) => unwrapItems(r.data)));
  }

  /** PUT /api/payroll/{id} */
  adjust(id: number, payload: PayslipAdjustPayload): Observable<unknown> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/${id}`, payload).pipe(map((r) => r.data));
  }
}
