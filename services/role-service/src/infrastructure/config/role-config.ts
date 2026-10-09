import { intEnv } from '@toka/common';

export const ROLE_CONFIG = Symbol('ROLE_CONFIG');

export interface RoleConfig {
  port: number;
  permissionsCacheTtlSeconds: number;
}

export function loadRoleConfig(env: NodeJS.ProcessEnv = process.env): RoleConfig {
  return { port: intEnv('PORT', 3003, env), permissionsCacheTtlSeconds: 600 };
}
