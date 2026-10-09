import { Logger } from '@nestjs/common';
import { LlmUnavailableError } from '../../domain/errors/domain-error';
import {
  type CircuitBreaker,
  type CircuitBreakerFactory,
  CircuitOpenError,
  CircuitTimeoutError,
} from '../ports/circuit-breaker.port';
import {
  type LlmProvider,
  LlmProviderError,
  type LlmRequest,
  type LlmResponse,
} from '../ports/llm-provider.port';
import { GateTimeoutError, type LlmGate } from '../ports/rate-limit.port';

export interface ResilientLlmOptions {
  gateMaxWaitMs: number;
  maxRetries: number;
  baseDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
}

export interface ProviderResult {
  response: LlmResponse;
  provider: string;
  model: string;
}

const JITTER = 0.25;

/**
 * Wraps an ordered chain of providers with the shared quota gate, retries with backoff and a circuit
 * breaker per provider. A request only fails with LlmUnavailableError once the whole chain is exhausted.
 */
export class ResilientLlm {
  private readonly logger = new Logger(ResilientLlm.name);
  private readonly breakers = new Map<string, CircuitBreaker>();
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(
    private readonly chain: LlmProvider[],
    private readonly gate: LlmGate,
    private readonly breakerFactory: CircuitBreakerFactory,
    private readonly options: ResilientLlmOptions,
  ) {
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
  }

  get primaryModel(): string {
    return this.chain[0].model;
  }

  get primaryName(): string {
    return this.chain[0].name;
  }

  async generate(request: LlmRequest, deadlineAt: number): Promise<ProviderResult> {
    let lastError: unknown;
    for (const provider of this.chain) {
      try {
        return await this.callWithRetries(provider, request, deadlineAt);
      } catch (error) {
        if (!this.isRecoverable(error)) throw error;
        lastError = error;
        this.logger.warn(`Provider ${provider.name} unavailable (${(error as Error).message}); trying the next one`);
      }
    }
    const retryAfterMs = lastError instanceof LlmProviderError ? lastError.retryAfterMs : undefined;
    throw new LlmUnavailableError(retryAfterMs ? Math.ceil(retryAfterMs / 1000) : undefined);
  }

  private isRecoverable(error: unknown): boolean {
    if (error instanceof LlmProviderError) return error.kind !== 'bad_request';
    return error instanceof CircuitOpenError || error instanceof GateTimeoutError;
  }

  private breakerFor(provider: LlmProvider): CircuitBreaker {
    let breaker = this.breakers.get(provider.name);
    if (!breaker) {
      // A malformed request is our bug, not the provider's: it must not open the circuit.
      breaker = this.breakerFactory.create(
        provider.name,
        (error) => error instanceof LlmProviderError && error.kind === 'bad_request',
      );
      this.breakers.set(provider.name, breaker);
    }
    return breaker;
  }

  private backoff(attempt: number): number {
    const base = this.options.baseDelayMs * 2 ** attempt;
    return Math.round(base * (1 + (this.random() * 2 - 1) * JITTER));
  }

  private async callWithRetries(provider: LlmProvider, request: LlmRequest, deadlineAt: number): Promise<ProviderResult> {
    const breaker = this.breakerFor(provider);
    for (let attempt = 0; ; attempt++) {
      const remaining = deadlineAt - this.now();
      if (remaining <= 0) throw new LlmProviderError('Request deadline exceeded', 'unavailable');

      // Every attempt, retries included, consumes a slot of the shared provider quota.
      if (provider.rateLimited) await this.gate.acquire(Math.min(this.options.gateMaxWaitMs, remaining));

      try {
        const response = await breaker.execute(() =>
          provider.generate(request, { signal: AbortSignal.timeout(Math.max(1, deadlineAt - this.now())) }),
        );
        return { response, provider: provider.name, model: provider.model };
      } catch (caught) {
        // The breaker's own timeout is just a slow provider, so it is retried like any other transient failure.
        const error = caught instanceof CircuitTimeoutError ? new LlmProviderError(caught.message, 'unavailable') : caught;
        if (!(error instanceof LlmProviderError) || !error.retryable || attempt >= this.options.maxRetries) throw error;
        // Gemini states how long to wait on a 429; honour it when it still fits the deadline.
        const delay = error.retryAfterMs ?? this.backoff(attempt);
        if (this.now() + delay >= deadlineAt) throw error;
        await this.sleep(delay);
      }
    }
  }
}
