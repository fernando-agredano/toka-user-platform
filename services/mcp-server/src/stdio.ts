#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLoggerOptions } from '@toka/common';
import pino from 'pino';
import { createRuntime } from './composition-root';
import { decodingAuthenticator } from './infrastructure/auth/token-authenticator';
import { InMemoryToolRateLimiter } from './infrastructure/cache/rate-limiters';
import { loadMcpConfig } from './infrastructure/config/mcp-config';
import { NullInvocationAuditor } from './infrastructure/messaging/rabbit-invocation-auditor';
import { createMcpServer } from './presentation/mcp-server-factory';

async function main(): Promise<void> {
  const token = process.env.TOKA_ACCESS_TOKEN;
  if (!token) throw new Error('TOKA_ACCESS_TOKEN is required (the JWT returned by POST /api/auth/login)');

  const config = loadMcpConfig({ TOKA_API_URL: 'http://localhost:8080', ...process.env });
  // stdout carries the protocol: logs must go to stderr.
  const logger = pino(createLoggerOptions('mcp-server'), pino.destination(2));
  const runtime = createRuntime(config, {
    rateLimiter: new InMemoryToolRateLimiter(config.rateLimitPerMinute),
    auditor: new NullInvocationAuditor(),
    logger,
  });

  const caller = await decodingAuthenticator(`Bearer ${token}`, null);
  await createMcpServer(runtime, caller).connect(new StdioServerTransport());
  logger.info({ userId: caller.userId }, 'MCP server running on stdio');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
