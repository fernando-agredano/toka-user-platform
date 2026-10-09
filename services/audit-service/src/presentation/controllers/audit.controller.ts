import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Permissions, PermissionsGuard } from '@toka/common';
import { AuditEntryView, AuditSearchQueryDto, AuditStatsQueryDto, AuditStatsView, Page } from '../../application/dtos/audit.dtos';
import { GetAuditStatsUseCase } from '../../application/use-cases/get-audit-stats.use-case';
import { SearchAuditUseCase } from '../../application/use-cases/search-audit.use-case';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('audit:read')
export class AuditController {
  constructor(
    private readonly searchAudit: SearchAuditUseCase,
    private readonly auditStats: GetAuditStatsUseCase,
  ) {}

  @Get()
  search(@Query() query: AuditSearchQueryDto): Promise<Page<AuditEntryView>> {
    return this.searchAudit.execute(query);
  }

  // Declared as a distinct static segment; there is no ':id' route that could shadow it.
  @Get('stats')
  stats(@Query() query: AuditStatsQueryDto): Promise<AuditStatsView> {
    return this.auditStats.execute(query);
  }
}
