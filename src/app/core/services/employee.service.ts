import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Employee, EmployeePayload, Paged, RegisterAccountPayload } from '../models';
import { unwrapItems } from '../util/unwrap';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/Employee`;

  list(): Observable<Employee[]> {
    return this.http
      .get<ApiResponse<Paged<Employee> | Employee[]>>(this.base, { params: { pageSize: 1000 } })
      .pipe(map((r) => unwrapItems(r.data)));
  }

  get(id: number): Observable<Employee> {
    return this.http.get<ApiResponse<Employee>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  create(payload: EmployeePayload): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(this.base, payload).pipe(map((r) => r.data));
  }

  update(id: number, payload: EmployeePayload): Observable<unknown> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/${id}`, payload).pipe(map((r) => r.data));
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  /** POST /api/Auth/register — AdminOnly. يُنشئ حساب دخول لموظف موجود. */
  registerAccount(payload: RegisterAccountPayload): Observable<unknown> {
    return this.http
      .post<ApiResponse<unknown>>(`${environment.apiUrl}/Auth/register`, payload)
      .pipe(map((r) => r.data));
  }
}
