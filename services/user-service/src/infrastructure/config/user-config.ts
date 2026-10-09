import { intEnv, requireEnv } from '@toka/common';

export const USER_CONFIG = Symbol('USER_CONFIG');

export interface UserConfig {
  port: number;
  authServiceUrl: string;
  internalApiKey: string;
  cacheTtlSeconds: number;
  seedAdminEmail?: string;
}

export function loadUserConfig(env: NodeJS.ProcessEnv = process.env): UserConfig {
  return {
    port: intEnv('PORT', 3002, env),
    authServiceUrl: requireEnv('AUTH_SERVICE_URL', env),
    internalApiKey: requireEnv('INTERNAL_API_KEY', env),
    cacheTtlSeconds: 300,
    seedAdminEmail: env.SEED_ADMIN_EMAIL || undefined,
  };
}
