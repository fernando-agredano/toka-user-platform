import { ResilientHttpClient } from '@toka/common';
import type { InvocationAuditor, LogSink, ToolRateLimiter } from './application/ports/governance.port';
import { ToolRunner } from './application/services/tool-runner';
import { createReadTools } from './application/tools/read-tools';
import { createWriteTools } from './application/tools/write-tools';
import { GetMeUseCase } from './application/use-cases/get-me.use-case';
import { ReadDocUseCase } from './application/use-cases/read-doc.use-case';
import type { McpConfig } from './infrastructure/config/mcp-config';
import { FsDocsRepository } from './infrastructure/docs/fs-docs.repository';
import {
  HttpAuditGateway,
  HttpKnowledgeGateway,
  HttpRolesGateway,
  HttpUsersGateway,
} from './infrastructure/http/http-gateways';
import type { McpRuntime } from './presentation/mcp-server-factory';

// The assistant can take ~25s to answer, so the knowledge client gets more room than the data services.
const DATA_TIMEOUT_MS = 2000;
const KNOWLEDGE_TIMEOUT_MS = 30_000;

export interface Governance {
  rateLimiter: ToolRateLimiter;
  auditor: InvocationAuditor;
  logger: LogSink;
}

const client = (name: string, baseURL: string, timeoutMs = DATA_TIMEOUT_MS) =>
  new ResilientHttpClient({ name, baseURL, timeoutMs });

/** Wires the gateways, tools and governance once; transports (HTTP, stdio) only differ in who authenticates the caller. */
export function createRuntime(config: McpConfig, governance: Governance): McpRuntime {
  const users = new HttpUsersGateway(client('user-service', config.services.users));
  const roles = new HttpRolesGateway(client('role-service', config.services.roles));
  const audit = new HttpAuditGateway(client('audit-service', config.services.audit));
  const knowledge = new HttpKnowledgeGateway(client('ai-agent-service', config.services.ai, KNOWLEDGE_TIMEOUT_MS));
  const docs = new FsDocsRepository(config.knowledgeDir);

  return {
    tools: [...createReadTools({ users, roles, audit, knowledge }), ...createWriteTools({ users, roles })],
    runner: new ToolRunner({ ...governance, clock: { now: Date.now } }),
    getMe: new GetMeUseCase(users),
    readDoc: new ReadDocUseCase(docs),
    now: () => new Date(),
  };
}
