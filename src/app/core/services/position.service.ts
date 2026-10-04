import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Paged, Position, PositionPayload } from '../models';
import { unwrapItems } from '../util/unwrap';

@Injectable({ providedIn: 'root' })
export class PositionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/Position`;

  list(): Observable<Position[]> {
    return this.http
      .get<ApiResponse<Paged<Position> | Position[]>>(this.base)
      .pipe(map((r) => unwrapItems(r.data)));
  }

  get(id: number): Observable<Position> {
    return this.http.get<ApiResponse<Position>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  create(payload: PositionPayload): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(this.base, payload).pipe(map((r) => r.data));
  }

  update(id: number, payload: PositionPayload): Observable<unknown> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/${id}`, payload).pipe(map((r) => r.data));
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }
}
