import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AGENT_SETTINGS } from '../../../src/application/ports/agent-settings';
import { CACHE } from '../../../src/application/ports/cache.port';
import { CLOCK } from '../../../src/application/ports/clock.port';
import { EMBEDDING_PROVIDER } from '../../../src/application/ports/embedding.port';
import { AI_EVENT_PUBLISHER } from '../../../src/application/ports/event-publisher.port';
import { KNOWLEDGE_SOURCE } from '../../../src/application/ports/knowledge-source.port';
import { USER_RATE_LIMITER } from '../../../src/application/ports/rate-limit.port';
import { VECTOR_STORE } from '../../../src/application/ports/vector-store.port';
import { KnowledgeState } from '../../../src/application/services/knowledge-state';
import { ResilientLlm } from '../../../src/application/services/resilient-llm';
import { Retriever } from '../../../src/application/services/retriever';
import { ToolExecutor } from '../../../src/application/services/tool-executor';
import { ChatUseCase } from '../../../src/application/use-cases/chat.use-case';
import { GetMetricsUseCase } from '../../../src/application/use-cases/get-metrics.use-case';
import { IngestKnowledgeUseCase } from '../../../src/application/use-cases/ingest-knowledge.use-case';
import { AI_METRICS_REPOSITORY } from '../../../src/domain/repositories/ai-metrics.repository';
import { CONVERSATION_REPOSITORY } from '../../../src/domain/repositories/conversation.repository';
import { CostCalculator } from '../../../src/domain/services/cost-calculator';
import { FsKnowledgeSource } from '../../../src/infrastructure/knowledge/fs-knowledge.source';
import {
  FakeEmbedding,
  FakeRateLimiter,
  FakeVectorStore,
  FixedClock,
  InMemoryCache,
  InMemoryConversations,
  RecordingEvents,
  RecordingMetrics,
  testSettings,
} from '../support/fakes';
import { KNOWLEDGE_DIR } from '../support/harness';

/**
 * Unit tests build the classes by hand, so a missing @Inject or a type-only import (which erases the decorator
 * metadata) would only surface when the container starts. Resolving them through Nest's injector catches that here.
 */
describe('dependency injection wiring', () => {
  it('resolves the use cases from the container', async () => {
    const llm = { primaryModel: 'mock', primaryName: 'mock', generate: jest.fn() };
    @Module({
      providers: [
        ChatUseCase,
        IngestKnowledgeUseCase,
        GetMetricsUseCase,
        KnowledgeState,
        { provide: AGENT_SETTINGS, useValue: testSettings() },
        { provide: CACHE, useValue: new InMemoryCache() },
        { provide: USER_RATE_LIMITER, useValue: new FakeRateLimiter() },
        { provide: CONVERSATION_REPOSITORY, useValue: new InMemoryConversations() },
        { provide: AI_METRICS_REPOSITORY, useValue: new RecordingMetrics() },
        { provide: AI_EVENT_PUBLISHER, useValue: new RecordingEvents() },
        { provide: CLOCK, useValue: new FixedClock() },
        { provide: Retriever, useValue: {} },
        { provide: ResilientLlm, useValue: llm },
        { provide: ToolExecutor, useValue: {} },
        { provide: CostCalculator, useValue: new CostCalculator({}) },
        { provide: KNOWLEDGE_SOURCE, useValue: new FsKnowledgeSource(KNOWLEDGE_DIR) },
        { provide: EMBEDDING_PROVIDER, useValue: new FakeEmbedding() },
        { provide: VECTOR_STORE, useValue: new FakeVectorStore() },
      ],
    })
    class WiringModule {}

    const context = await NestFactory.createApplicationContext(WiringModule, { logger: false, abortOnError: false });
    expect(context.get(ChatUseCase)).toBeInstanceOf(ChatUseCase);
    expect(context.get(IngestKnowledgeUseCase)).toBeInstanceOf(IngestKnowledgeUseCase);
    expect(context.get(GetMetricsUseCase)).toBeInstanceOf(GetMetricsUseCase);
    await context.close();
  });
});
