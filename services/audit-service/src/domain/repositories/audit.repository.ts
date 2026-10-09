import type { AuditEntry } from '../entities/audit-entry';

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface AuditSearchFilter extends DateRange {
  page: number;
  limit: number;
  type?: string;
  actorId?: string;
}

export interface AuditStats {
  total: number;
  byType: Array<{ type: string; count: number }>;
}

export interface AuditRepository {
  /** Stores the entry; returns false when an entry with the same `eventId` already exists (idempotency). */
  insert(entry: AuditEntry): Promise<boolean>;
  search(filter: AuditSearchFilter): Promise<{ items: AuditEntry[]; total: number }>;
  countByType(range: DateRange): Promise<AuditStats>;
}
