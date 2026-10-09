import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  HealthModule,
  JwtAuthModule,
  LoggerModule,
  MessagingModule,
  REDIS_CLIENT,
  RedisModule,
  ResilientHttpClient,
  createPingIndicator,
} from '@toka/common';
import type Redis from 'ioredis';
import type { Connection } from 'mongoose';
import { AGENT_SETTINGS, type AgentSettings } from './application/ports/agent-settings';
import { CACHE, type Cache } from './application/ports/cache.port';
import { CIRCUIT_BREAKER_FACTORY, type CircuitBreakerFactory } from './application/ports/circuit-breaker.port';
import { CLOCK, type Clock } from './application/ports/clock.port';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from './application/ports/embedding.port';
import { AI_EVENT_PUBLISHER } from './application/ports/event-publisher.port';
import { KNOWLEDGE_SOURCE } from './application/ports/knowledge-source.port';
import { LLM_GATE, type LlmGate, USER_RATE_LIMITER } from './application/ports/rate-limit.port';
import {
  AUDIT_GATEWAY,
  type AuditGateway,
  ROLES_GATEWAY,
  type RolesGateway,
  USERS_GATEWAY,
  type UsersGateway,
} from './application/ports/service-gateways.port';
import { VECTOR_STORE, type VectorStore } from './application/ports/vector-store.port';
import { KnowledgeState } from './application/services/knowledge-state';
import { ResilientLlm } from './application/services/resilient-llm';
import { Retriever } from './application/services/retriever';
import { ToolExecutor } from './application/services/tool-executor';
import { createGetAuditSummaryTool } from './application/tools/get-audit-summary.tool';
import { createGetUserRolesTool } from './application/tools/get-user-roles.tool';
import { createSearchKnowledgeBaseTool } from './application/tools/search-knowledge-base.tool';
import { createSearchUsersTool } from './application/tools/search-users.tool';
import { ChatUseCase } from './application/use-cases/chat.use-case';
import { GetMetricsUseCase } from './application/use-cases/get-metrics.use-case';
import { IngestKnowledgeUseCase } from './application/use-cases/ingest-knowledge.use-case';
import { AI_METRICS_REPOSITORY } from './domain/repositories/ai-metrics.repository';
import { CONVERSATION_REPOSITORY } from './domain/repositories/conversation.repository';
import { CostCalculator } from './domain/services/cost-calculator';
import { RedisCache } from './infrastructure/cache/redis-cache';
import { RedisLlmGate } from './infrastructure/cache/redis-llm-gate';
import { RedisUserRateLimiter } from './infrastructure/cache/redis-user-rate-limiter';
import { AI_CONFIG, AiConfigModule, type AiConfig, loadAgentSettings, loadPricing } from './infrastructure/config/ai-config';
import { TransformersEmbeddingProvider } from './infrastructure/embeddings/transformers-embedding.provider';
import { HttpAuditGateway, HttpRolesGateway, HttpUsersGateway } from './infrastructure/http/http-gateways';
import { FsKnowledgeSource } from './infrastructure/knowledge/fs-knowledge.source';
import { KnowledgeBootstrap } from './infrastructure/knowledge/knowledge-bootstrap';
import { KnowledgeModule } from './infrastructure/knowledge/knowledge.module';
import { createLlmChain } from './infrastructure/llm/create-llm-chain';
import { OpossumCircuitBreakerFactory } from './infrastructure/llm/opossum-circuit-breaker';
import { RabbitAiEventPublisher } from './infrastructure/messaging/rabbit-ai-event.publisher';
import { MongoConversationRepository } from './infrastructure/persistence/mongo-conversation.repository';
import { MongoMetricsRepository } from './infrastructure/persistence/mongo-metrics.repository';
import { MONGO_CONNECTION, MongoModule } from './infrastructure/persistence/mongo.module';
import { SystemClock } from './infrastructure/time/system-clock';
import { AiController } from './presentation/controllers/ai.controller';

const httpClient = (name: string, baseURL: string): ResilientHttpClient =>
  new ResilientHttpClient({ name, baseURL, timeoutMs: 2000 });

@Module({
  imports: [
    LoggerModule.forService('ai-agent-service'),
    AiConfigModule,
    KnowledgeModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    RedisModule,
    MessagingModule,
    JwtAuthModule.register(),
    MongoModule,
    HealthModule.registerAsync({
      inject: [MONGO_CONNECTION, REDIS_CLIENT, VECTOR_STORE, KnowledgeState],
      useFactory: (mongo: Connection, redis: Redis, vectors: VectorStore, knowledge: KnowledgeState) => [
        createPingIndicator('mongo', () => mongo.db!.admin().ping()),
        createPingIndicator('redis', () => redis.ping()),
        createPingIndicator('qdrant', () => vectors.isHealthy()),
        // Indexing runs in the background and is not a liveness failure; its state is reported for operators.
        async () => ({ knowledge: { status: 'up' as const, state: knowledge.status, kbVersion: knowledge.kbVersion } }),
      ],
    }),
  ],
  controllers: [AiController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: AGENT_SETTINGS, useFactory: () => loadAgentSettings() },
    { provide: CLOCK, useClass: SystemClock },
    { provide: CostCalculator, useFactory: () => new CostCalculator(loadPricing()) },

    { provide: CACHE, inject: [REDIS_CLIENT], useFactory: (redis: Redis) => new RedisCache(redis) },
    {
      provide: USER_RATE_LIMITER,
      inject: [REDIS_CLIENT, AI_CONFIG],
      useFactory: (redis: Redis, config: AiConfig) => new RedisUserRateLimiter(redis, config.userRateLimitPerMinute),
    },
    {
      provide: LLM_GATE,
      inject: [REDIS_CLIENT, AI_CONFIG],
      useFactory: (redis: Redis, config: AiConfig) => new RedisLlmGate(redis, config.llm.rpmLimit),
    },
    { provide: CIRCUIT_BREAKER_FACTORY, useFactory: () => new OpossumCircuitBreakerFactory() },
    {
      provide: ResilientLlm,
      inject: [AI_CONFIG, LLM_GATE, CIRCUIT_BREAKER_FACTORY],
      useFactory: (config: AiConfig, gate: LlmGate, breakers: CircuitBreakerFactory) =>
        new ResilientLlm(createLlmChain(config.llm), gate, breakers, {
          gateMaxWaitMs: config.llm.gateMaxWaitMs,
          maxRetries: config.llm.maxRetries,
          baseDelayMs: config.llm.retryBaseDelayMs,
        }),
    },

    {
      provide: EMBEDDING_PROVIDER,
      inject: [AI_CONFIG],
      useFactory: (config: AiConfig) =>
        new TransformersEmbeddingProvider(
          config.embedding.model,
          config.embedding.dimensions,
          config.embedding.cacheDir,
          config.embedding.dtype,
        ),
    },
    {
      provide: KNOWLEDGE_SOURCE,
      inject: [AI_CONFIG],
      useFactory: (config: AiConfig) => new FsKnowledgeSource(config.knowledgeDir),
    },
    {
      provide: Retriever,
      inject: [EMBEDDING_PROVIDER, VECTOR_STORE, CACHE, AGENT_SETTINGS],
      useFactory: (embedding: EmbeddingProvider, vectors: VectorStore, cache: Cache, settings: AgentSettings) =>
        new Retriever(embedding, vectors, cache, settings.rag),
    },

    {
      provide: USERS_GATEWAY,
      inject: [AI_CONFIG],
      useFactory: (config: AiConfig) => new HttpUsersGateway(httpClient('user-service', config.services.users)),
    },
    {
      provide: ROLES_GATEWAY,
      inject: [AI_CONFIG],
      useFactory: (config: AiConfig) => new HttpRolesGateway(httpClient('role-service', config.services.roles)),
    },
    {
      provide: AUDIT_GATEWAY,
      inject: [AI_CONFIG],
      useFactory: (config: AiConfig) => new HttpAuditGateway(httpClient('audit-service', config.services.audit)),
    },
    {
      provide: ToolExecutor,
      inject: [USERS_GATEWAY, ROLES_GATEWAY, AUDIT_GATEWAY, Retriever, CLOCK],
      useFactory: (users: UsersGateway, roles: RolesGateway, audit: AuditGateway, retriever: Retriever, clock: Clock) =>
        new ToolExecutor([
          createSearchUsersTool(users),
          createGetUserRolesTool(roles),
          createGetAuditSummaryTool(audit, clock),
          createSearchKnowledgeBaseTool(retriever),
        ]),
    },

    { provide: AI_EVENT_PUBLISHER, useClass: RabbitAiEventPublisher },
    { provide: CONVERSATION_REPOSITORY, useClass: MongoConversationRepository },
    { provide: AI_METRICS_REPOSITORY, useClass: MongoMetricsRepository },
    ChatUseCase,
    IngestKnowledgeUseCase,
    GetMetricsUseCase,
    KnowledgeBootstrap,
  ],
})
export class AppModule {}
