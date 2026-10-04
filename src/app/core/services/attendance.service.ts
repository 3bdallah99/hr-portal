import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, AttendanceRecord, AttendanceUpdatePayload, DeviceLog, Paged, TardinessSummary } from '../models';
import { unwrapItems } from '../util/unwrap';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/Attendance`;

  /** HR: GET /api/attendance/department/{id}/date/{yyyy-MM-dd} */
  byDepartmentAndDate(departmentId: number, date: string): Observable<AttendanceRecord[]> {
    return this.http
      .get<ApiResponse<AttendanceRecord[] | Paged<AttendanceRecord>>>(`${this.base}/department/${departmentId}/date/${date}`)
      .pipe(map((r) => unwrapItems(r.data)));
  }

  /** الموظف: سجل شهر كامل. (افتراض: GET /api/attendance/employee/{id}?year=&month=) */
  byEmployeeMonth(employeeId: number, year: number, month: number): Observable<AttendanceRecord[]> {
    return this.http
      .get<ApiResponse<AttendanceRecord[] | Paged<AttendanceRecord>>>(`${this.base}/employee/${employeeId}`, {
        params: { year, month },
      })
      .pipe(map((r) => unwrapItems(r.data)));
  }

  /** GET /api/attendance/tardiness/{employeeId}?year=&month= */
  tardiness(employeeId: number, year: number, month: number): Observable<TardinessSummary> {
    return this.http
      .get<ApiResponse<TardinessSummary>>(`${this.base}/tardiness/${employeeId}`, { params: { year, month } })
      .pipe(map((r) => r.data));
  }

  /** PUT /api/attendance/{id} */
  update(id: number, payload: AttendanceUpdatePayload): Observable<unknown> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/${id}`, payload).pipe(map((r) => r.data));
  }

  /** GET /api/attendance/device-logs */
  deviceLogs(): Observable<DeviceLog[]> {
    return this.http
      .get<ApiResponse<DeviceLog[] | Paged<DeviceLog>>>(`${this.base}/device-logs`, { params: { pageSize: 500 } })
      .pipe(map((r) => unwrapItems(r.data)));
  }
}
