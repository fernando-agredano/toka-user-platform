import { intEnv, optionalEnv, requireEnv } from '@toka/common';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export interface AuthConfig {
  port: number;
  roleServiceUrl: string;
  internalApiKey: string;
  jwt: { issuer: string; audience: string; keysDir: string; accessTtlSeconds: number };
  refreshTtlSeconds: number;
  lockout: { maxAttempts: number; windowSeconds: number };
  secureCookies: boolean;
  seedAdmin?: { email: string; password: string };
}

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const seedEmail = env.SEED_ADMIN_EMAIL;
  const seedPassword = env.SEED_ADMIN_PASSWORD;
  return {
    port: intEnv('PORT', 3001, env),
    roleServiceUrl: requireEnv('ROLE_SERVICE_URL', env),
    internalApiKey: requireEnv('INTERNAL_API_KEY', env),
    jwt: {
      issuer: requireEnv('JWT_ISSUER', env),
      audience: requireEnv('JWT_AUDIENCE', env),
      keysDir: optionalEnv('JWT_KEYS_DIR', '.keys', env),
      accessTtlSeconds: 15 * 60,
    },
    refreshTtlSeconds: 7 * 24 * 60 * 60,
    lockout: { maxAttempts: 5, windowSeconds: 15 * 60 },
    secureCookies: env.NODE_ENV === 'production',
    seedAdmin: seedEmail && seedPassword ? { email: seedEmail, password: seedPassword } : undefined,
  };
}
