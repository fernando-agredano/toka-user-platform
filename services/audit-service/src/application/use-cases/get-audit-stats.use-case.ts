import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_REPOSITORY, AuditRepository } from '../../domain/repositories/audit.repository';
import { AuditStatsQueryDto, AuditStatsView } from '../dtos/audit.dtos';
import { parseDateRange } from './date-range';

@Injectable()
export class GetAuditStatsUseCase {
  constructor(@Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository) {}

  async execute(query: AuditStatsQueryDto): Promise<AuditStatsView> {
    const range = parseDateRange(query.from, query.to);
    const { total, byType } = await this.audit.countByType(range);
    const countOf = (type: string) => byType.find((entry) => entry.type === type)?.count ?? 0;
    return {
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
      total,
      byType,
      failedLogins: countOf('auth.login.failed'),
      lockedAccounts: countOf('auth.login.locked'),
    };
  }
}
