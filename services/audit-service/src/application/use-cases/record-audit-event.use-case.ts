import { Inject, Injectable } from '@nestjs/common';
import { AuditSourceEvent, createAuditEntry } from '../../domain/entities/audit-entry';
import { AUDIT_REPOSITORY, AuditRepository } from '../../domain/repositories/audit.repository';

@Injectable()
export class RecordAuditEventUseCase {
  constructor(@Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository) {}

  /** Returns false when the event had already been recorded. */
  execute(event: AuditSourceEvent): Promise<boolean> {
    return this.audit.insert(createAuditEntry(event));
  }
}
