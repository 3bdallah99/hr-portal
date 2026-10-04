import { Pipe, PipeTransform } from '@angular/core';

/** 12,345.50 ج.م — أرقام لاتينية tabular للمبالغ. */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, withCurrency = true): string {
    const n = Number(value ?? 0);
    const text = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return withCurrency ? `${text} ج.م` : text;
  }
}
