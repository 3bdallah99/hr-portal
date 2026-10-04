import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  LeaveBalance,
  LeaveBalancePayload,
  LeaveRequest,
  LeaveRequestPayload,
  Paged,
} from '../models';
import { leaveStatusKey } from '../util/leave';
import { unwrapItems } from '../util/unwrap';

@Injectable({ providedIn: 'root' })
export class LeaveService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/Leave`;

  /** عدّاد الطلبات المعلّقة (Badge الشريط الجانبي للـ HR). */
  readonly pendingCount = signal(0);

  refreshPending(): void {
    this.allRequests().subscribe({
      next: (list) => this.pendingCount.set(list.filter((r) => leaveStatusKey(r.status) === 'pending').length),
      error: () => undefined,
    });
  }

  allRequests(): Observable<LeaveRequest[]> {
    return this.http
      .get<ApiResponse<Paged<LeaveRequest> | LeaveRequest[]>>(`${this.base}/requests`, { params: { pageSize: 500 } })
      .pipe(map((r) => unwrapItems(r.data)));
  }

  employeeRequests(employeeId: number): Observable<LeaveRequest[]> {
    return this.http
      .get<ApiResponse<Paged<LeaveRequest> | LeaveRequest[]>>(`${this.base}/requests/employee/${employeeId}`, {
        params: { pageSize: 100 },
      })
      .pipe(map((r) => unwrapItems(r.data)));
  }

  submit(payload: LeaveRequestPayload): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/requests`, payload).pipe(map((r) => r.data));
  }

  /** POST /api/leave/requests/{id}/approve — بدون body. */
  approve(id: number): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/requests/${id}/approve`, null).pipe(map((r) => r.data));
  }

  /** POST /api/leave/requests/{id}/reject — الملاحظة اختيارية. نرسل الاسمين لتوافق الـ DTO. */
  reject(id: number, note: string): Observable<unknown> {
    const value = note.trim();
    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/requests/${id}/reject`, {
        rejectionNote: value,
        rejectionReason: value,
      })
      .pipe(map((r) => r.data));
  }

  cancel(id: number): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/requests/${id}/cancel`, {}).pipe(map((r) => r.data));
  }

  balances(employeeId: number, year: number): Observable<LeaveBalance[]> {
    return this.http
      .get<ApiResponse<LeaveBalance[]>>(`${this.base}/balances/${employeeId}`, { params: { year } })
      .pipe(map((r) => r.data ?? []));
  }

  /** POST /api/leave/balances — Upsert بدون فقدان UsedDays. */
  setBalance(payload: LeaveBalancePayload): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/balances`, payload).pipe(map((r) => r.data));
  }
}
