import { createHash } from 'node:crypto';
import type { AgentSettings } from '../../../src/application/ports/agent-settings';
import type { Cache } from '../../../src/application/ports/cache.port';
import type { CircuitBreaker, CircuitBreakerFactory } from '../../../src/application/ports/circuit-breaker.port';
import type { Clock } from '../../../src/application/ports/clock.port';
import type { EmbeddingProvider } from '../../../src/application/ports/embedding.port';
import type { AiEventPublisher, QueryCompletedEvent } from '../../../src/application/ports/event-publisher.port';
import type {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  ToolCall,
} from '../../../src/application/ports/llm-provider.port';
import type { LlmGate, RateLimitDecision, UserRateLimiter } from '../../../src/application/ports/rate-limit.port';
import type {
  AuditGateway,
  AuditStats,
  Page,
  RoleSummary,
  RolesGateway,
  SearchUsersQuery,
  UserSummary,
  UsersGateway,
} from '../../../src/application/ports/service-gateways.port';
import type {
  IndexedChunk,
  IndexedDocument,
  ScoredChunk,
  VectorStore,
} from '../../../src/application/ports/vector-store.port';
import { Conversation } from '../../../src/domain/entities/conversation';
import type { MetricsSummary, QueryMetric } from '../../../src/domain/entities/query-metric';
import type { AiMetricsRepository } from '../../../src/domain/repositories/ai-metrics.repository';
import type { ConversationRepository } from '../../../src/domain/repositories/conversation.repository';
import { contentStems, estimateWordpieces } from '../../../src/domain/services/text';

export class FixedClock implements Clock {
  constructor(private readonly iso = '2026-10-09T12:00:00.000Z') {}
  now(): Date {
    return new Date(this.iso);
  }
}

export class InMemoryCache implements Cache {
  readonly entries = new Map<string, unknown>();
  failing = false;

  async get<T>(key: string): Promise<T | null> {
    if (this.failing) throw new Error('redis down');
    return (this.entries.get(key) as T | undefined) ?? null;
  }

  async set(key: string, value: unknown): Promise<void> {
    if (this.failing) throw new Error('redis down');
    this.entries.set(key, value);
  }
}

export class FakeRateLimiter implements UserRateLimiter {
  decision: RateLimitDecision = { allowed: true, retryAfterSeconds: 0 };
  async consume(): Promise<RateLimitDecision> {
    return this.decision;
  }
}

export class FakeGate implements LlmGate {
  acquired = 0;
  failWith?: Error;
  async acquire(): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.acquired++;
  }
}

export class PassThroughBreakerFactory implements CircuitBreakerFactory {
  create(): CircuitBreaker {
    return { execute: (task) => task() };
  }
}

export class InMemoryConversations implements ConversationRepository {
  readonly saved = new Map<string, Conversation>();
  async find(id: string): Promise<Conversation | null> {
    const found = this.saved.get(id);
    return found ? Conversation.restore(found.toProps()) : null;
  }
  async save(conversation: Conversation): Promise<void> {
    this.saved.set(conversation.id, conversation);
  }
}

export class RecordingMetrics implements AiMetricsRepository {
  readonly recorded: QueryMetric[] = [];
  async record(metric: QueryMetric): Promise<void> {
    this.recorded.push(metric);
  }
  async summarize(): Promise<MetricsSummary> {
    throw new Error('not needed in unit tests');
  }
}

export class RecordingEvents implements AiEventPublisher {
  readonly published: QueryCompletedEvent[] = [];
  async queryCompleted(event: QueryCompletedEvent): Promise<void> {
    this.published.push(event);
  }
}

const DIMENSIONS = 1024;

const hashWord = (word: string): number => createHash('md5').update(word).digest().readUInt16BE(0) % DIMENSIONS;

/** Bag-of-stems embedding: texts that share vocabulary get a high cosine, with no model download. */
export class FakeEmbedding implements EmbeddingProvider {
  readonly model = 'fake-bow';
  readonly dimensions = DIMENSIONS;
  embedCalls = 0;
  failing = false;

  async embed(texts: string[]): Promise<number[][]> {
    if (this.failing) throw new Error('embedding model unavailable');
    this.embedCalls++;
    return texts.map((text) => {
      const vector = new Array<number>(DIMENSIONS).fill(0);
      for (const stem of contentStems(text)) vector[hashWord(stem)] += 1;
      const norm = Math.hypot(...vector) || 1;
      return vector.map((value) => value / norm);
    });
  }

  async tokenCounter() {
    return estimateWordpieces;
  }
}

export class FakeVectorStore implements VectorStore {
  readonly points = new Map<string, IndexedChunk>();
  dimensions = 0;
  searchFailure?: Error;

  async ensureCollection(dimensions: number): Promise<void> {
    this.dimensions = dimensions;
  }
  async count(): Promise<number> {
    return this.points.size;
  }
  async listDocuments(): Promise<Map<string, IndexedDocument>> {
    const documents = new Map<string, IndexedDocument>();
    for (const point of this.points.values()) {
      const current = documents.get(point.docId);
      documents.set(point.docId, { contentHash: point.contentHash, chunkCount: (current?.chunkCount ?? 0) + 1 });
    }
    return documents;
  }
  async upsert(chunks: IndexedChunk[]): Promise<void> {
    for (const chunk of chunks) this.points.set(chunk.id, chunk);
  }
  async deleteStale(docId: string, keepIds: string[]): Promise<void> {
    for (const [id, point] of this.points) if (point.docId === docId && !keepIds.includes(id)) this.points.delete(id);
  }
  async deleteDocument(docId: string): Promise<void> {
    for (const [id, point] of this.points) if (point.docId === docId) this.points.delete(id);
  }
  async search(vector: number[], limit: number, minScore: number): Promise<ScoredChunk[]> {
    if (this.searchFailure) throw this.searchFailure;
    return [...this.points.values()]
      .map(({ vector: stored, ...chunk }) => ({
        chunk,
        score: stored.reduce((sum, value, index) => sum + value * vector[index], 0),
      }))
      .filter(({ score }) => score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  async isHealthy(): Promise<boolean> {
    return true;
  }
}

export class FakeUsersGateway implements UsersGateway {
  readonly calls: Array<{ query: SearchUsersQuery; authorization: string }> = [];
  users: UserSummary[] = [];
  failWith?: Error;
  async search(query: SearchUsersQuery, authorization: string): Promise<Page<UserSummary>> {
    this.calls.push({ query, authorization });
    if (this.failWith) throw this.failWith;
    const items = this.users.filter((user) => !query.status || user.status === query.status);
    return { items, page: query.page, limit: query.limit, total: items.length };
  }
}

export class FakeRolesGateway implements RolesGateway {
  readonly calls: string[] = [];
  roles: RoleSummary[] = [{ name: 'USER', permissions: ['ai:use'] }];
  async rolesOfUser(userId: string): Promise<RoleSummary[]> {
    this.calls.push(userId);
    return this.roles;
  }
}

export class FakeAuditGateway implements AuditGateway {
  readonly calls: Array<{ from?: string; to?: string }> = [];
  stats_: AuditStats = {
    from: null,
    to: null,
    total: 42,
    byType: [
      { type: 'auth.login.succeeded', count: 30 },
      { type: 'auth.login.failed', count: 7 },
    ],
    failedLogins: 7,
    lockedAccounts: 1,
  };
  async stats(range: { from?: string; to?: string }): Promise<AuditStats> {
    this.calls.push(range);
    return this.stats_;
  }
}

export const textResponse = (text: string, usage: Partial<LlmResponse['usage']> = {}): LlmResponse => ({
  text,
  toolCalls: [],
  usage: { input: 3000, output: 200, thoughts: 0, cachedInput: 0, estimated: false, ...usage },
});

export const toolCallResponse = (...calls: ToolCall[]): LlmResponse => ({
  text: '',
  toolCalls: calls,
  usage: { input: 3000, output: 40, thoughts: 0, cachedInput: 0, estimated: false },
});

/** Plays back queued responses (or throws queued errors) and remembers every request it received. */
export class ScriptedProvider implements LlmProvider {
  readonly requests: LlmRequest[] = [];
  constructor(
    readonly name: string,
    readonly model: string,
    private readonly script: Array<LlmResponse | Error>,
    readonly rateLimited = true,
  ) {}

  async generate(request: LlmRequest): Promise<LlmResponse> {
    this.requests.push(request);
    const next = this.script.shift();
    if (!next) throw new Error(`${this.name}: script exhausted`);
    if (next instanceof Error) throw next;
    return next;
  }
}

export const testSettings = (overrides: Partial<AgentSettings> = {}): AgentSettings => ({
  responseCacheTtlSeconds: 3600,
  deadlineMs: 25_000,
  maxToolRounds: 2,
  maxToolExecutions: 4,
  maxOutputTokens: 600,
  temperature: 0.2,
  topP: 0.9,
  rag: {
    candidateLimit: 8,
    minScore: 0.25,
    topK: 4,
    maxPerSection: 2,
    maxContextTokens: 1200,
    embeddingCacheTtlSeconds: 86_400,
  },
  degradedMinScore: 0.3,
  ...overrides,
});
