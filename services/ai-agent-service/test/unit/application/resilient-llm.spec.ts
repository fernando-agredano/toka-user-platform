import { CircuitOpenError, CircuitTimeoutError, type CircuitBreakerFactory } from '../../../src/application/ports/circuit-breaker.port';
import { LlmProviderError, type LlmRequest } from '../../../src/application/ports/llm-provider.port';
import { GateTimeoutError } from '../../../src/application/ports/rate-limit.port';
import { ResilientLlm } from '../../../src/application/services/resilient-llm';
import { LlmUnavailableError } from '../../../src/domain/errors/domain-error';
import { FakeGate, PassThroughBreakerFactory, ScriptedProvider, textResponse } from '../support/fakes';

const request: LlmRequest = {
  systemPrompt: 'system',
  messages: [{ role: 'user', text: 'hola' }],
  tools: [],
  forbidTools: false,
  maxOutputTokens: 100,
  temperature: 0.2,
  topP: 0.9,
  thinkingBudget: 0,
};

const rateLimited = (retryAfterMs?: number) => new LlmProviderError('429', 'rate_limited', retryAfterMs);

function build(providers: ScriptedProvider[], overrides: { gate?: FakeGate; breakers?: CircuitBreakerFactory; maxRetries?: number } = {}) {
  const sleeps: number[] = [];
  const now = { value: 1_000 };
  const gate = overrides.gate ?? new FakeGate();
  const llm = new ResilientLlm(providers, gate, overrides.breakers ?? new PassThroughBreakerFactory(), {
    gateMaxWaitMs: 8000,
    maxRetries: overrides.maxRetries ?? 2,
    baseDelayMs: 1000,
    sleep: async (ms) => {
      sleeps.push(ms);
      now.value += ms;
    },
    random: () => 0.5,
    now: () => now.value,
  });
  return { llm, sleeps, gate, deadline: now.value + 25_000 };
}

describe('ResilientLlm', () => {
  it('returns the provider answer with the provider and model that produced it', async () => {
    const provider = new ScriptedProvider('gemini', 'gemini-2.5-flash-lite', [textResponse('hola')]);
    const { llm, deadline } = build([provider]);
    const result = await llm.generate(request, deadline);
    expect(result).toMatchObject({ provider: 'gemini', model: 'gemini-2.5-flash-lite', response: { text: 'hola' } });
    expect(llm.primaryModel).toBe('gemini-2.5-flash-lite');
    expect(llm.primaryName).toBe('gemini');
  });

  it('retries a 429 with exponential backoff and takes a quota slot for every attempt', async () => {
    const provider = new ScriptedProvider('gemini', 'm', [rateLimited(), rateLimited(), textResponse('ok')]);
    const { llm, sleeps, gate, deadline } = build([provider]);
    await llm.generate(request, deadline);
    expect(sleeps).toEqual([1000, 2000]);
    expect(gate.acquired).toBe(3);
  });

  it('honours the retry delay announced by the provider', async () => {
    const provider = new ScriptedProvider('gemini', 'm', [rateLimited(7_000), textResponse('ok')]);
    const { llm, sleeps, deadline } = build([provider]);
    await llm.generate(request, deadline);
    expect(sleeps).toEqual([7000]);
  });

  it('does not wait for a retry that would outlive the request deadline', async () => {
    const provider = new ScriptedProvider('gemini', 'm', [rateLimited(60_000)]);
    const { llm, sleeps, deadline } = build([provider]);
    await expect(llm.generate(request, deadline)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(sleeps).toEqual([]);
  });

  it('gives up after the retry budget and reports the provider as unavailable', async () => {
    const provider = new ScriptedProvider('gemini', 'm', [rateLimited(), rateLimited(), rateLimited()]);
    const { llm, deadline } = build([provider]);
    await expect(llm.generate(request, deadline)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(provider.requests).toHaveLength(3);
  });

  it('falls back to the next provider and skips the quota gate for local ones', async () => {
    const primary = new ScriptedProvider('gemini', 'm1', [new LlmProviderError('down', 'unavailable')], true);
    const fallback = new ScriptedProvider('ollama', 'm2', [textResponse('local answer')], false);
    const { llm, gate, deadline } = build([primary, fallback], { maxRetries: 0 });
    const result = await llm.generate(request, deadline);
    expect(result).toMatchObject({ provider: 'ollama', model: 'm2' });
    expect(gate.acquired).toBe(1);
  });

  it('treats a misconfigured provider (bad key) as unavailable and moves on', async () => {
    const primary = new ScriptedProvider('gemini', 'm1', [new LlmProviderError('invalid key', 'config')]);
    const fallback = new ScriptedProvider('ollama', 'm2', [textResponse('ok')], false);
    const { llm, deadline } = build([primary, fallback]);
    expect((await llm.generate(request, deadline)).provider).toBe('ollama');
    expect(primary.requests).toHaveLength(1);
  });

  it('does not hide a malformed request behind a fallback', async () => {
    const primary = new ScriptedProvider('gemini', 'm1', [new LlmProviderError('bad schema', 'bad_request')]);
    const fallback = new ScriptedProvider('ollama', 'm2', [textResponse('ok')], false);
    const { llm, deadline } = build([primary, fallback]);
    await expect(llm.generate(request, deadline)).rejects.toMatchObject({ kind: 'bad_request' });
    expect(fallback.requests).toHaveLength(0);
  });

  it('moves on when no quota slot becomes available in time', async () => {
    const gate = new FakeGate();
    gate.failWith = new GateTimeoutError(30_000);
    const primary = new ScriptedProvider('gemini', 'm1', [textResponse('never reached')]);
    const fallback = new ScriptedProvider('ollama', 'm2', [textResponse('local')], false);
    const { llm, deadline } = build([primary, fallback], { gate });
    expect((await llm.generate(request, deadline)).provider).toBe('ollama');
    expect(primary.requests).toHaveLength(0);
  });

  it('treats an open circuit as an outage without calling the provider', async () => {
    const breakers: CircuitBreakerFactory = {
      create: () => ({
        execute: async () => {
          throw new CircuitOpenError('gemini');
        },
      }),
    };
    const primary = new ScriptedProvider('gemini', 'm1', [textResponse('never')]);
    const { llm, deadline } = build([primary], { breakers });
    await expect(llm.generate(request, deadline)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(primary.requests).toHaveLength(0);
  });

  it('retries a breaker timeout like any other transient failure', async () => {
    let calls = 0;
    const breakers: CircuitBreakerFactory = {
      create: () => ({
        execute: async (task) => {
          if (++calls === 1) throw new CircuitTimeoutError('gemini');
          return task();
        },
      }),
    };
    const primary = new ScriptedProvider('gemini', 'm1', [textResponse('ok')]);
    const { llm, deadline } = build([primary], { breakers });
    expect((await llm.generate(request, deadline)).response.text).toBe('ok');
  });

  it('gives each provider its own breaker that ignores bad-request errors', async () => {
    const created: Array<{ name: string; ignorable: (error: unknown) => boolean }> = [];
    const breakers: CircuitBreakerFactory = {
      create: (name, ignorable) => {
        created.push({ name, ignorable });
        return { execute: (task) => task() };
      },
    };
    const providers = [
      new ScriptedProvider('gemini', 'm1', [textResponse('a'), textResponse('b')]),
      new ScriptedProvider('ollama', 'm2', [], false),
    ];
    const { llm, deadline } = build(providers, { breakers });
    await llm.generate(request, deadline);
    await llm.generate(request, deadline);
    expect(created.map(({ name }) => name)).toEqual(['gemini']);
    expect(created[0].ignorable(new LlmProviderError('x', 'bad_request'))).toBe(true);
    expect(created[0].ignorable(new LlmProviderError('x', 'unavailable'))).toBe(false);
  });

  it('fails fast when the deadline has already passed', async () => {
    const provider = new ScriptedProvider('gemini', 'm', [textResponse('late')]);
    const { llm } = build([provider]);
    await expect(llm.generate(request, 0)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(provider.requests).toHaveLength(0);
  });
});
