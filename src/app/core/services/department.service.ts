import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Department, Paged } from '../models';
import { unwrapItems } from '../util/unwrap';

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/Department`;

  list(): Observable<Department[]> {
    return this.http
      .get<ApiResponse<Paged<Department> | Department[]>>(this.base)
      .pipe(map((r) => unwrapItems(r.data)));
  }

  create(name: string): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(this.base, { name }).pipe(map((r) => r.data));
  }

  update(id: number, name: string): Observable<unknown> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/${id}`, { name }).pipe(map((r) => r.data));
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }
}
