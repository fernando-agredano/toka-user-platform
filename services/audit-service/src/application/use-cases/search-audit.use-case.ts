import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_REPOSITORY, AuditRepository } from '../../domain/repositories/audit.repository';
import { AuditEntryView, AuditSearchQueryDto, Page, toAuditEntryView } from '../dtos/audit.dtos';
import { parseDateRange } from './date-range';

@Injectable()
export class SearchAuditUseCase {
  constructor(@Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository) {}

  async execute(query: AuditSearchQueryDto): Promise<Page<AuditEntryView>> {
    const { items, total } = await this.audit.search({
      page: query.page,
      limit: query.limit,
      type: query.type,
      actorId: query.actorId,
      ...parseDateRange(query.from, query.to),
    });
    return { items: items.map(toAuditEntryView), page: query.page, limit: query.limit, total };
  }
}
