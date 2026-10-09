import { Connection, Model, Schema } from 'mongoose';
import type { AuditEntry } from '../../domain/entities/audit-entry';

const SECONDS_PER_DAY = 86_400;

export type AuditLogModel = Model<AuditEntry>;

export function createAuditLogModel(connection: Connection, retentionDays: number): AuditLogModel {
  const schema = new Schema<AuditEntry>(
    {
      eventId: { type: String, required: true },
      type: { type: String, required: true },
      version: { type: Number, required: true },
      occurredAt: { type: Date, required: true },
      correlationId: { type: String, required: true },
      source: { type: String, required: true },
      actor: {
        userId: { type: String, default: null },
        ip: { type: String, default: null },
      },
      data: { type: Schema.Types.Mixed, default: {} },
    },
    { collection: 'audit_logs', versionKey: false },
  );

  schema.index({ eventId: 1 }, { unique: true });
  schema.index({ type: 1, occurredAt: -1 });
  schema.index({ occurredAt: -1 });
  schema.index({ 'actor.userId': 1, occurredAt: -1 });
  if (retentionDays > 0) schema.index({ occurredAt: 1 }, { expireAfterSeconds: retentionDays * SECONDS_PER_DAY });

  return connection.model<AuditEntry>('AuditLog', schema);
}
