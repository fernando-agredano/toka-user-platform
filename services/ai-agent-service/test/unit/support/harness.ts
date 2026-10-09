import { join } from 'node:path';
import type { SessionUser } from '../../../src/application/dtos/session-user';
import type { LlmProvider } from '../../../src/application/ports/llm-provider.port';
import type { AgentSettings } from '../../../src/application/ports/agent-settings';
import { KnowledgeState } from '../../../src/application/services/knowledge-state';
import { ResilientLlm } from '../../../src/application/services/resilient-llm';
import { Retriever } from '../../../src/application/services/retriever';
import { ToolExecutor } from '../../../src/application/services/tool-executor';
import { createGetAuditSummaryTool } from '../../../src/application/tools/get-audit-summary.tool';
import { createGetUserRolesTool } from '../../../src/application/tools/get-user-roles.tool';
import { createSearchKnowledgeBaseTool } from '../../../src/application/tools/search-knowledge-base.tool';
import { createSearchUsersTool } from '../../../src/application/tools/search-users.tool';
import { ChatUseCase } from '../../../src/application/use-cases/chat.use-case';
import { IngestKnowledgeUseCase } from '../../../src/application/use-cases/ingest-knowledge.use-case';
import { CostCalculator } from '../../../src/domain/services/cost-calculator';
import { FsKnowledgeSource } from '../../../src/infrastructure/knowledge/fs-knowledge.source';
import { MockProvider } from '../../../src/infrastructure/llm/mock.provider';
import {
  FakeAuditGateway,
  FakeEmbedding,
  FakeGate,
  FakeRateLimiter,
  FakeRolesGateway,
  FakeUsersGateway,
  FakeVectorStore,
  FixedClock,
  InMemoryCache,
  InMemoryConversations,
  PassThroughBreakerFactory,
  RecordingEvents,
  RecordingMetrics,
  testSettings,
} from './fakes';

export const KNOWLEDGE_DIR = join(__dirname, '../../../knowledge');

export const PRICING = {
  'gemini-2.5-flash-lite': { input: 0.1, cachedInput: 0.025, output: 0.4 },
  mock: { input: 0, cachedInput: 0, output: 0 },
};

export const userWith = (
  permissions: string[],
  roles = ['USER'],
  userId = '11111111-1111-4111-8111-111111111111',
): SessionUser => ({ userId, email: `${userId.slice(0, 4)}@toka.local`, roles, permissions });

export const USER = userWith(['ai:use']);
export const MANAGER = userWith(
  ['users:read', 'users:write', 'roles:read', 'audit:read', 'ai:use'],
  ['MANAGER'],
  '22222222-2222-4222-8222-222222222222',
);

interface HarnessOptions {
  providers?: LlmProvider[];
  settings?: AgentSettings;
  indexKnowledge?: boolean;
}

/** The whole chat pipeline wired with in-memory adapters; only the LLM and the knowledge files vary per test. */
export async function buildHarness(options: HarnessOptions = {}) {
  const settings = options.settings ?? testSettings();
  const clock = new FixedClock();
  const cache = new InMemoryCache();
  const embedding = new FakeEmbedding();
  const store = new FakeVectorStore();
  const knowledge = new KnowledgeState();
  const gate = new FakeGate();
  const rateLimiter = new FakeRateLimiter();
  const conversations = new InMemoryConversations();
  const metrics = new RecordingMetrics();
  const events = new RecordingEvents();
  const users = new FakeUsersGateway();
  const roles = new FakeRolesGateway();
  const audit = new FakeAuditGateway();

  const retriever = new Retriever(embedding, store, cache, settings.rag);
  const tools = new ToolExecutor([
    createSearchUsersTool(users),
    createGetUserRolesTool(roles),
    createGetAuditSummaryTool(audit, clock),
    createSearchKnowledgeBaseTool(retriever),
  ]);
  const providers = options.providers ?? [new MockProvider()];
  const llm = new ResilientLlm(providers, gate, new PassThroughBreakerFactory(), {
    gateMaxWaitMs: 10,
    maxRetries: 1,
    baseDelayMs: 1,
    sleep: async () => undefined,
  });
  const ingest = new IngestKnowledgeUseCase(new FsKnowledgeSource(KNOWLEDGE_DIR), embedding, store, knowledge);
  if (options.indexKnowledge !== false) await ingest.execute();

  const chat = new ChatUseCase(
    settings,
    cache,
    rateLimiter,
    conversations,
    metrics,
    events,
    clock,
    retriever,
    llm,
    tools,
    new CostCalculator(PRICING),
    knowledge,
  );

  const ask = (message: string, user: SessionUser = USER, conversationId?: string) =>
    chat.execute({ user, authorization: `Bearer jwt-${user.userId}`, message, conversationId, ip: '10.0.0.1', correlationId: 'corr-1' });
  // Metrics and events are published fire-and-forget, so let their promises settle before asserting.
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  return { chat, ask, settle, cache, embedding, store, knowledge, gate, rateLimiter, conversations, metrics, events, users, roles, audit, ingest, retriever, llm };
}
