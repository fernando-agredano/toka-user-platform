import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import type { AuditEntry } from '../../domain/entities/audit-entry';

export class AuditStatsQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class AuditSearchQueryDto extends AuditStatsQueryDto {
  @IsOptional() @IsString() @MaxLength(100) type?: string;
  @IsOptional() @IsUUID() actorId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface AuditEntryView {
  eventId: string;
  type: string;
  version: number;
  occurredAt: string;
  correlationId: string;
  source: string;
  actor: { userId: string | null; ip: string | null };
  data: Record<string, unknown>;
}

export interface AuditStatsView {
  from: string | null;
  to: string | null;
  total: number;
  byType: Array<{ type: string; count: number }>;
  failedLogins: number;
  lockedAccounts: number;
}

export const toAuditEntryView = (entry: AuditEntry): AuditEntryView => ({
  ...entry,
  occurredAt: entry.occurredAt.toISOString(),
});
