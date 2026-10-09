import type { AuditEntry } from '../../../src/domain/entities/audit-entry';
import type { AuditRepository, AuditSearchFilter, AuditStats, DateRange } from '../../../src/domain/repositories/audit.repository';

export class InMemoryAuditRepository implements AuditRepository {
  readonly entries = new Map<string, AuditEntry>();

  async insert(entry: AuditEntry): Promise<boolean> {
    if (this.entries.has(entry.eventId)) return false;
    this.entries.set(entry.eventId, entry);
    return true;
  }

  private inRange(range: DateRange): AuditEntry[] {
    return [...this.entries.values()].filter(
      (entry) => (!range.from || entry.occurredAt >= range.from) && (!range.to || entry.occurredAt <= range.to),
    );
  }

  async search(filter: AuditSearchFilter): Promise<{ items: AuditEntry[]; total: number }> {
    const matching = this.inRange(filter)
      .filter((entry) => !filter.type || entry.type === filter.type)
      .filter((entry) => !filter.actorId || entry.actor.userId === filter.actorId)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    const start = (filter.page - 1) * filter.limit;
    return { items: matching.slice(start, start + filter.limit), total: matching.length };
  }

  async countByType(range: DateRange): Promise<AuditStats> {
    const counts = new Map<string, number>();
    const entries = this.inRange(range);
    for (const entry of entries) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
    return {
      total: entries.length,
      byType: [...counts].map(([type, count]) => ({ type, count })),
    };
  }
}
