import { intEnv, requireEnv } from '@toka/common';

export interface AuditConfig {
  port: number;
  mongoUri: string;
  /** Days an entry is kept before MongoDB expires it; 0 disables the TTL index. */
  retentionDays: number;
}

export function loadAuditConfig(env: NodeJS.ProcessEnv = process.env): AuditConfig {
  return {
    port: intEnv('PORT', 3004, env),
    mongoUri: requireEnv('MONGO_URI', env),
    retentionDays: intEnv('AUDIT_RETENTION_DAYS', 365, env),
  };
}
