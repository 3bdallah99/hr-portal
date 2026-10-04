import { Paged } from '../models';

/** بعض الـ endpoints ترجع مصفوفة وبعضها Paged — نقبل الاثنين. */
export function unwrapItems<T>(data: T[] | Paged<T> | null | undefined): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : (data.items ?? []);
}
