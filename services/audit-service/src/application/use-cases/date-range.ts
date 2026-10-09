import { InvalidDateRangeError } from '../../domain/errors/domain-error';
import type { DateRange } from '../../domain/repositories/audit.repository';

export function parseDateRange(from?: string, to?: string): DateRange {
  const range: DateRange = {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  };
  if (range.from && range.to && range.from > range.to) throw new InvalidDateRangeError();
  return range;
}
