import { join } from 'node:path';
import { intEnv, optionalEnv } from '@toka/common';

export interface McpConfig {
  port: number;
  services: { users: string; roles: string; audit: string; ai: string };
  knowledgeDir: string;
  rateLimitPerMinute: number;
  allowedOrigins: string[];
}

/**
 * Inside Docker each service has its own URL. Outside (stdio on a laptop) everything goes through the gateway,
 * so a single `TOKA_API_URL` is enough.
 */
export function loadMcpConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const gateway = env.TOKA_API_URL;
  const serviceUrl = (name: string, fallback: string) => optionalEnv(name, gateway ?? fallback, env);
  return {
    port: intEnv('PORT', 3006, env),
    services: {
      users: serviceUrl('USER_SERVICE_URL', 'http://user-service:3002'),
      roles: serviceUrl('ROLE_SERVICE_URL', 'http://role-service:3003'),
      audit: serviceUrl('AUDIT_SERVICE_URL', 'http://audit-service:3004'),
      ai: serviceUrl('AI_SERVICE_URL', 'http://ai-agent-service:3005'),
    },
    knowledgeDir: optionalEnv('KNOWLEDGE_DIR', join(__dirname, '..', '..', '..', 'knowledge'), env),
    rateLimitPerMinute: intEnv('MCP_RATE_LIMIT_PER_MINUTE', 30, env),
    allowedOrigins: optionalEnv('MCP_ALLOWED_ORIGINS', 'http://localhost:8080', env).split(',').map((origin) => origin.trim()),
  };
}
