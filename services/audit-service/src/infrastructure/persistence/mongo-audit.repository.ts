import { Inject, Injectable } from '@nestjs/common';
import type { FilterQuery } from 'mongoose';
import type { AuditEntry } from '../../domain/entities/audit-entry';
import type { AuditRepository, AuditSearchFilter, AuditStats, DateRange } from '../../domain/repositories/audit.repository';
import { AUDIT_LOG_MODEL } from './mongo.module';
import type { AuditLogModel } from './audit-log.model';

const DUPLICATE_KEY_ERROR = 11000;

function occurredAtClause({ from, to }: DateRange): FilterQuery<AuditEntry> {
  if (!from && !to) return {};
  return { occurredAt: { ...(from && { $gte: from }), ...(to && { $lte: to }) } };
}

@Injectable()
export class MongoAuditRepository implements AuditRepository {
  constructor(@Inject(AUDIT_LOG_MODEL) private readonly model: AuditLogModel) {}

  async insert(entry: AuditEntry): Promise<boolean> {
    try {
      await this.model.create(entry);
      return true;
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICATE_KEY_ERROR) return false;
      throw error;
    }
  }

  async search(filter: AuditSearchFilter): Promise<{ items: AuditEntry[]; total: number }> {
    const query: FilterQuery<AuditEntry> = {
      ...(filter.type && { type: filter.type }),
      ...(filter.actorId && { 'actor.userId': filter.actorId }),
      ...occurredAtClause(filter),
    };
    const [items, total] = await Promise.all([
      this.model
        .find(query, { _id: 0 })
        .sort({ occurredAt: -1, eventId: 1 })
        .skip((filter.page - 1) * filter.limit)
        .limit(filter.limit)
        .lean<AuditEntry[]>(),
      this.model.countDocuments(query),
    ]);
    return { items, total };
  }

  async countByType(range: DateRange): Promise<AuditStats> {
    const rows = await this.model.aggregate<{ _id: string; count: number }>([
      { $match: occurredAtClause(range) },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);
    const byType = rows.map((row) => ({ type: row._id, count: row.count }));
    return { total: byType.reduce((sum, row) => sum + row.count, 0), byType };
  }
}
