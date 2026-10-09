import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Conversation } from '../../domain/entities/conversation';
import type { LatencyBreakdown, QueryMetric } from '../../domain/entities/query-metric';
import {
  ConversationNotFoundError,
  InvalidMessageError,
  LlmUnavailableError,
  RateLimitedError,
} from '../../domain/errors/domain-error';
import { AI_METRICS_REPOSITORY, type AiMetricsRepository } from '../../domain/repositories/ai-metrics.repository';
import { CONVERSATION_REPOSITORY, type ConversationRepository } from '../../domain/repositories/conversation.repository';
import { asksForDetail, thinkingBudgetFor } from '../../domain/services/complexity';
// CostCalculator is injected by class, so it must be a value import: a type-only import erases the DI metadata.
import { CostCalculator, type TokenUsage, addUsage, emptyUsage } from '../../domain/services/cost-calculator';
import { type QualityChecks, evaluateQuality } from '../../domain/services/quality-evaluator';
import { sanitizeUserInput } from '../../domain/services/sanitize-input';
import { normalizeText } from '../../domain/services/text';
import type { ChatInput, ChatOutput } from '../dtos/chat.dtos';
import { AGENT_SETTINGS, type AgentSettings } from '../ports/agent-settings';
import { CACHE, type Cache } from '../ports/cache.port';
import { CLOCK, type Clock } from '../ports/clock.port';
import { AI_EVENT_PUBLISHER, type AiEventPublisher } from '../ports/event-publisher.port';
import type { LlmMessage, LlmRequest } from '../ports/llm-provider.port';
import { USER_RATE_LIMITER, type UserRateLimiter } from '../ports/rate-limit.port';
import { FEW_SHOT_MESSAGES } from '../prompts/few-shot';
import { PROMPT_VERSION, renderSystemPrompt } from '../prompts/system-prompt';
import { buildDegradedAnswer, buildUserTurn } from '../prompts/user-turn';
import { EvidenceLedger, type AiSourceView } from '../services/evidence-ledger';
import { KnowledgeState } from '../services/knowledge-state';
import { ResilientLlm } from '../services/resilient-llm';
import { Retriever, buildSearchQuery } from '../services/retriever';
import { ToolExecutor } from '../services/tool-executor';

const KNOWLEDGE_TOOL = 'search_knowledge_base';
/** Below this score an answer is not cached or trusted as a good reply for other users. */
const MIN_CACHEABLE_SCORE = 0.5;
const FALLBACK_ANSWER =
  'No pude completar la respuesta con la información disponible. Reformula la pregunta o contacta a soporte.';

interface CachedAnswer {
  answer: string;
  sources: AiSourceView[];
  toolsUsed: string[];
  quality: { score: number; checks: QualityChecks };
  costUsd: number;
}

interface TurnResult extends CachedAnswer {
  usage: TokenUsage;
  estimatedTokens: boolean;
  savedCostUsd: number;
  pricingKnown: boolean;
  cached: boolean;
  degraded: boolean;
  llmCalls: number;
  provider: string;
  model: string;
  topScore: number | null;
  latency: Omit<LatencyBreakdown, 'totalMs'>;
}

interface TurnContext {
  input: ChatInput;
  message: string;
  injectionSuspected: boolean;
  conversation: Conversation;
  startedAt: number;
  requestId: string;
}

const round = (value: number): number => Math.round(value);

@Injectable()
export class ChatUseCase {
  private readonly logger = new Logger(ChatUseCase.name);

  constructor(
    @Inject(AGENT_SETTINGS) private readonly settings: AgentSettings,
    @Inject(CACHE) private readonly cache: Cache,
    @Inject(USER_RATE_LIMITER) private readonly rateLimiter: UserRateLimiter,
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(AI_METRICS_REPOSITORY) private readonly metricsRepository: AiMetricsRepository,
    @Inject(AI_EVENT_PUBLISHER) private readonly events: AiEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly retriever: Retriever,
    private readonly llm: ResilientLlm,
    private readonly tools: ToolExecutor,
    private readonly costs: CostCalculator,
    private readonly knowledge: KnowledgeState,
  ) {}

  async execute(input: ChatInput): Promise<ChatOutput> {
    const startedAt = performance.now();
    const { text: message, injectionSuspected } = sanitizeUserInput(input.message);
    if (!message) throw new InvalidMessageError();

    await this.enforceRateLimit(input.user.userId);
    const conversation = await this.resolveConversation(input);
    const context: TurnContext = {
      input,
      message,
      injectionSuspected,
      conversation,
      startedAt,
      requestId: randomUUID(),
    };

    // A cache hit is only valid for the first turn: with history the answer depends on earlier messages.
    const cacheKey = conversation.history.length === 0 ? this.responseCacheKey(message, input.user.permissions) : null;
    const hit = cacheKey ? await this.safely(() => this.cache.get<CachedAnswer>(cacheKey), null, 'response cache read') : null;
    const result = hit ? this.fromCache(hit) : await this.generate(context, cacheKey);
    return this.finalize(context, result);
  }

  private async enforceRateLimit(userId: string): Promise<void> {
    // Availability beats strictness here: the gateway still limits per IP if Redis is unreachable.
    const decision = await this.safely(
      () => this.rateLimiter.consume(userId),
      { allowed: true, retryAfterSeconds: 0 },
      'rate limiter',
    );
    if (!decision.allowed) throw new RateLimitedError(decision.retryAfterSeconds);
  }

  private async resolveConversation(input: ChatInput): Promise<Conversation> {
    const { userId } = input.user;
    // If the store is unreachable the conversation starts over rather than failing the question.
    const { conversationId } = input;
    const found = conversationId ? await this.safely(() => this.conversations.find(conversationId), null, 'conversation read') : null;
    // 404 rather than 403 so the existence of someone else's conversation is not revealed.
    if (found && !found.isOwnedBy(userId)) throw new ConversationNotFoundError();
    // An expired or unknown id starts a fresh conversation under a server-generated id, which the client adopts.
    return found ?? Conversation.start(randomUUID(), userId);
  }

  // The permission set (not the role name) is part of the key, so two roles never share an answer unless they see the same things.
  private responseCacheKey(message: string, permissions: string[]): string {
    const material = [
      normalizeText(message),
      [...permissions].sort().join(','),
      this.knowledge.kbVersion,
      PROMPT_VERSION,
      this.llm.primaryModel,
    ].join('|');
    return `ai:resp:${createHash('sha256').update(material).digest('hex')}`;
  }

  private fromCache(hit: CachedAnswer): TurnResult {
    return {
      ...hit,
      usage: emptyUsage(),
      estimatedTokens: false,
      costUsd: 0,
      savedCostUsd: hit.costUsd,
      pricingKnown: true,
      cached: true,
      degraded: false,
      llmCalls: 0,
      provider: 'cache',
      model: 'cache',
      topScore: null,
      latency: { queueWaitMs: 0, embedMs: 0, retrievalMs: 0, llmMs: 0, toolsMs: 0 },
    };
  }

  private async generate(context: TurnContext, cacheKey: string | null): Promise<TurnResult> {
    const { input, message, conversation } = context;
    const { user } = input;
    const ledger = new EvidenceLedger();
    const latency = { queueWaitMs: 0, embedMs: 0, retrievalMs: 0, llmMs: 0, toolsMs: 0 };

    try {
      const retrieval = await this.retriever.retrieve(buildSearchQuery(message, conversation.history));
      ledger.addChunks(retrieval.chunks);
      latency.embedMs = retrieval.embedMs;
      latency.retrievalMs = retrieval.searchMs;
    } catch (error) {
      // Without the vector store the agent can still answer from tools, so retrieval is best-effort.
      this.logger.warn(`Retrieval unavailable, continuing without context: ${(error as Error).message}`);
    }

    const declarations = this.tools.declarationsFor(user);
    const systemPrompt = renderSystemPrompt({
      today: this.clock.now().toISOString().slice(0, 10),
      userId: user.userId,
      roles: user.roles,
      permissions: user.permissions,
      availableTools: declarations.map((tool) => tool.name),
    });
    const messages: LlmMessage[] = [
      ...FEW_SHOT_MESSAGES,
      ...conversation.history.map(
        (entry): LlmMessage => (entry.role === 'user' ? { role: 'user', text: entry.text } : { role: 'model', text: entry.text }),
      ),
      { role: 'user', text: buildUserTurn(message, ledger.labeledChunks) },
    ];

    const deadlineAt = Date.now() + this.settings.deadlineMs;
    let usage = emptyUsage();
    let costUsd = 0;
    let pricingKnown = true;
    let estimatedTokens = false;
    let llmCalls = 0;
    let toolRounds = 0;
    let toolExecutions = 0;
    const toolsUsed: string[] = [];
    let text = '';
    let provider = this.llm.primaryName;
    let model = this.llm.primaryModel;

    try {
      for (;;) {
        const forbidTools = toolRounds >= this.settings.maxToolRounds || toolExecutions >= this.settings.maxToolExecutions;
        const request: LlmRequest = {
          systemPrompt,
          messages,
          tools: declarations,
          forbidTools,
          maxOutputTokens: this.settings.maxOutputTokens,
          temperature: this.settings.temperature,
          topP: this.settings.topP,
          thinkingBudget: thinkingBudgetFor(message, toolRounds),
        };

        const llmStart = performance.now();
        const result = await this.llm.generate(request, deadlineAt);
        latency.llmMs += round(performance.now() - llmStart);

        llmCalls++;
        provider = result.provider;
        model = result.model;
        usage = addUsage(usage, result.response.usage);
        estimatedTokens ||= result.response.usage.estimated;
        const callCost = this.costs.compute(result.model, result.response.usage);
        costUsd += callCost.costUsd;
        pricingKnown &&= callCost.pricingKnown;
        text = result.response.text;

        const { toolCalls } = result.response;
        if (toolCalls.length === 0 || forbidTools) break;

        toolRounds++;
        // Every executed call needs a response, so calls beyond the budget are dropped from the replayed turn too.
        const allowed = toolCalls.slice(0, this.settings.maxToolExecutions - toolExecutions);
        messages.push({
          role: 'model',
          text: result.response.text || undefined,
          toolCalls: allowed,
          raw: allowed.length === toolCalls.length ? result.response.raw : undefined,
        });

        const toolsStart = performance.now();
        const executions = await Promise.all(
          allowed.map((call) =>
            this.tools.execute(call, { user, authorization: input.authorization }, ledger),
          ),
        );
        latency.toolsMs += round(performance.now() - toolsStart);

        executions.forEach((execution, index) => {
          messages.push({ role: 'tool', callId: allowed[index].id, name: execution.name, content: execution.content });
          if (!toolsUsed.includes(execution.name)) toolsUsed.push(execution.name);
        });
        toolExecutions += allowed.length;
      }
    } catch (error) {
      if (this.canDegrade(error, toolsUsed, ledger)) {
        return this.degraded(context, ledger, latency, { usage, costUsd, pricingKnown, llmCalls, provider, model });
      }
      throw error;
    }

    const report = evaluateQuality({
      answer: text.trim() || FALLBACK_ANSWER,
      evidence: ledger.evidence,
      allowedEntities: [user.userId, user.email],
      detailRequested: asksForDetail(message),
      degraded: false,
    });
    const sources = ledger.sourcesCitedIn(report.answer);
    const quality = { score: report.score, checks: report.checks };

    const cacheable =
      cacheKey !== null &&
      toolsUsed.every((name) => name === KNOWLEDGE_TOOL) &&
      report.score >= MIN_CACHEABLE_SCORE;
    if (cacheable) {
      const entry: CachedAnswer = { answer: report.answer, sources, toolsUsed, quality, costUsd };
      await this.safely(() => this.cache.set(cacheKey, entry, this.settings.responseCacheTtlSeconds), undefined, 'response cache write');
    }

    return {
      answer: report.answer,
      sources,
      toolsUsed,
      quality,
      usage,
      estimatedTokens,
      costUsd,
      savedCostUsd: 0,
      pricingKnown,
      cached: false,
      degraded: false,
      llmCalls,
      provider,
      model,
      topScore: ledger.topScore,
      latency,
    };
  }

  // Degrading is only honest when nothing was fetched yet and the retrieved fragments are clearly relevant.
  private canDegrade(error: unknown, toolsUsed: string[], ledger: EvidenceLedger): boolean {
    return (
      error instanceof LlmUnavailableError &&
      toolsUsed.length === 0 &&
      (ledger.topScore ?? 0) >= this.settings.degradedMinScore
    );
  }

  private degraded(
    context: TurnContext,
    ledger: EvidenceLedger,
    latency: TurnResult['latency'],
    spent: Pick<TurnResult, 'usage' | 'costUsd' | 'pricingKnown' | 'llmCalls' | 'provider' | 'model'>,
  ): TurnResult {
    const { user } = context.input;
    const report = evaluateQuality({
      answer: buildDegradedAnswer(ledger.labeledChunks),
      evidence: ledger.evidence,
      allowedEntities: [user.userId, user.email],
      detailRequested: false,
      degraded: true,
    });
    this.logger.warn('LLM unavailable: answering in degraded mode with retrieved fragments');
    return {
      ...spent,
      answer: report.answer,
      sources: ledger.sourcesCitedIn(report.answer),
      toolsUsed: [],
      quality: { score: report.score, checks: report.checks },
      estimatedTokens: false,
      savedCostUsd: 0,
      cached: false,
      degraded: true,
      topScore: ledger.topScore,
      latency,
    };
  }

  private async finalize(context: TurnContext, result: TurnResult): Promise<ChatOutput> {
    const { input, message, conversation, requestId } = context;
    const totalMs = round(performance.now() - context.startedAt);

    conversation.recordTurn(message, result.answer);
    await this.safely(() => this.conversations.save(conversation), undefined, 'conversation save');

    const metric: QueryMetric = {
      requestId,
      correlationId: input.correlationId,
      userId: input.user.userId,
      conversationId: conversation.id,
      createdAt: this.clock.now(),
      provider: result.provider,
      model: result.model,
      promptVersion: PROMPT_VERSION,
      kbVersion: this.knowledge.kbVersion,
      latency: { totalMs, ...result.latency },
      tokens: { ...result.usage, estimated: result.estimatedTokens },
      costUsd: result.costUsd,
      savedCostUsd: result.savedCostUsd,
      pricingKnown: result.pricingKnown,
      cached: result.cached,
      degraded: result.degraded,
      llmCalls: result.llmCalls,
      toolsUsed: result.toolsUsed,
      sourcesCount: result.sources.length,
      topScore: result.topScore,
      quality: result.quality,
      injectionSuspected: context.injectionSuspected,
    };
    // Observability must never delay or fail the answer the user is waiting for.
    void this.metricsRepository.record(metric).catch((error: Error) => this.logger.error(`Metrics not saved: ${error.message}`));
    void this.events
      .queryCompleted({
        userId: input.user.userId,
        ip: input.ip,
        data: {
          requestId,
          conversationId: conversation.id,
          provider: result.provider,
          model: result.model,
          cached: result.cached,
          degraded: result.degraded,
          latencyMs: totalMs,
          inputTokens: result.usage.input,
          outputTokens: result.usage.output + result.usage.thoughts,
          costUsd: result.costUsd,
          toolsUsed: result.toolsUsed,
          qualityScore: result.quality.score,
        },
      })
      .catch((error: Error) => this.logger.warn(`ai.query.completed not published: ${error.message}`));

    return {
      answer: result.answer,
      conversationId: conversation.id,
      sources: result.sources,
      toolsUsed: result.toolsUsed,
      metrics: {
        latencyMs: totalMs,
        inputTokens: result.usage.input,
        outputTokens: result.usage.output + result.usage.thoughts,
        costUsd: result.costUsd,
        cached: result.cached,
        provider: result.provider,
        model: result.model,
      },
      quality: result.quality,
    };
  }

  private async safely<T>(task: () => Promise<T>, fallback: T, what: string): Promise<T> {
    try {
      return await task();
    } catch (error) {
      this.logger.warn(`${what} failed, continuing: ${(error as Error).message}`);
      return fallback;
    }
  }
}
