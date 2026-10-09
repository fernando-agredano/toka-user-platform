import type { Content, GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { LlmProviderError, type LlmRequest } from '../../../src/application/ports/llm-provider.port';
import {
  GeminiProvider,
  mapGeminiError,
  parseRetryAfterMs,
  toContents,
} from '../../../src/infrastructure/llm/gemini.provider';

const request = (overrides: Partial<LlmRequest> = {}): LlmRequest => ({
  systemPrompt: 'system prompt',
  messages: [{ role: 'user', text: 'hola' }],
  tools: [
    { name: 'search_users', description: 'busca', parameters: { type: 'object', properties: { query: { type: 'string' } } } },
  ],
  forbidTools: false,
  maxOutputTokens: 600,
  temperature: 0.2,
  topP: 0.9,
  thinkingBudget: 0,
  ...overrides,
});

function providerReturning(response: Partial<GenerateContentResponse> | Error) {
  const calls: GenerateContentParameters[] = [];
  const client = {
    models: {
      generateContent: async (params: GenerateContentParameters) => {
        calls.push(params);
        if (response instanceof Error) throw response;
        return response as GenerateContentResponse;
      },
    },
  };
  return { provider: new GeminiProvider(client, 'gemini-2.5-flash-lite'), calls };
}

describe('GeminiProvider', () => {
  it('sends the system prompt, sampling settings, thinking budget and tool declarations', async () => {
    const { provider, calls } = providerReturning({ candidates: [{ content: { role: 'model', parts: [{ text: 'hola' }] } }] });
    const controller = new AbortController();
    await provider.generate(request({ thinkingBudget: 512 }), { signal: controller.signal });

    const [{ model, config }] = calls;
    expect(model).toBe('gemini-2.5-flash-lite');
    expect(config).toMatchObject({
      systemInstruction: 'system prompt',
      maxOutputTokens: 600,
      temperature: 0.2,
      topP: 0.9,
      candidateCount: 1,
      thinkingConfig: { thinkingBudget: 512 },
      abortSignal: controller.signal,
    });
    const [declarations] = config?.tools as Array<{ functionDeclarations: unknown[] }>;
    expect(declarations.functionDeclarations[0]).toMatchObject({
      name: 'search_users',
      parametersJsonSchema: { type: 'object' },
    });
    expect(config?.toolConfig).toBeUndefined();
  });

  it('keeps tools declared but forbids calling them on the final round', async () => {
    const { provider, calls } = providerReturning({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });
    await provider.generate(request({ forbidTools: true }));
    expect(calls[0].config?.tools).toHaveLength(1);
    expect(calls[0].config?.toolConfig?.functionCallingConfig?.mode).toBe('NONE');
  });

  it('omits tool configuration when there are no tools', async () => {
    const { provider, calls } = providerReturning({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });
    await provider.generate(request({ tools: [], forbidTools: true }));
    expect(calls[0].config?.tools).toBeUndefined();
    expect(calls[0].config?.toolConfig).toBeUndefined();
  });

  it('extracts text, skips reasoning parts, reads tool calls and usage', async () => {
    const content: Content = {
      role: 'model',
      parts: [
        { text: 'internal reasoning', thought: true },
        { text: 'Respuesta ' },
        { text: 'final' },
        { functionCall: { name: 'search_users', args: { query: 'ana' } } },
      ],
    };
    const { provider } = providerReturning({
      candidates: [{ content }],
      usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 80, thoughtsTokenCount: 30, cachedContentTokenCount: 400 },
    });
    const result = await provider.generate(request());

    expect(result.text).toBe('Respuesta final');
    expect(result.toolCalls).toEqual([{ id: 'call_3', name: 'search_users', args: { query: 'ana' } }]);
    expect(result.usage).toEqual({ input: 1200, output: 80, thoughts: 30, cachedInput: 400, estimated: false });
    expect(result.raw).toBe(content);
  });

  it('returns empty text when the model produced nothing (e.g. blocked)', async () => {
    const { provider } = providerReturning({ candidates: [] });
    const result = await provider.generate(request());
    expect(result).toMatchObject({ text: '', toolCalls: [] });
    expect(result.usage.estimated).toBe(true);
  });

  it('translates SDK failures into provider errors', async () => {
    const failing = (status?: number, message = 'boom') => Object.assign(new Error(message), { status });
    await expect(providerReturning(failing(429, 'quota')).provider.generate(request())).rejects.toMatchObject({ kind: 'rate_limited' });
    await expect(providerReturning(failing(503)).provider.generate(request())).rejects.toMatchObject({ kind: 'unavailable' });
    await expect(providerReturning(failing(400)).provider.generate(request())).rejects.toBeInstanceOf(LlmProviderError);
  });
});

describe('toContents', () => {
  it('replays the provider’s own model turn untouched', () => {
    const raw: Content = { role: 'model', parts: [{ functionCall: { name: 'x', args: {} } }, { text: 'sig' }] };
    expect(toContents([{ role: 'model', raw }])).toEqual([raw]);
  });

  it('rebuilds a model turn from text and tool calls when there is no raw content', () => {
    const [content] = toContents([{ role: 'model', text: 'pensando', toolCalls: [{ id: '1', name: 'search_users', args: { query: 'a' } }] }]);
    expect(content).toEqual({
      role: 'model',
      parts: [{ text: 'pensando' }, { functionCall: { name: 'search_users', args: { query: 'a' } } }],
    });
  });

  it('packs the responses to one round of calls into a single user turn', () => {
    const contents = toContents([
      { role: 'user', text: 'q' },
      { role: 'model', toolCalls: [{ id: '1', name: 'a', args: {} }, { id: '2', name: 'b', args: {} }] },
      { role: 'tool', callId: '1', name: 'a', content: 'ra' },
      { role: 'tool', callId: '2', name: 'b', content: 'rb' },
      { role: 'user', text: 'next' },
    ]);
    expect(contents.map((content) => content.role)).toEqual(['user', 'model', 'user', 'user']);
    expect(contents[2].parts).toEqual([
      { functionResponse: { name: 'a', response: { output: 'ra' } } },
      { functionResponse: { name: 'b', response: { output: 'rb' } } },
    ]);
  });
});

describe('Gemini error mapping', () => {
  it('reads the retry delay from the error body or message', () => {
    expect(parseRetryAfterMs('{"error":{"details":[{"retryDelay":"34s"}]}}')).toBe(34_000);
    expect(parseRetryAfterMs('"retryDelay": "1.5s"')).toBe(1500);
    expect(parseRetryAfterMs('Please retry in 12.2s.')).toBe(12_200);
    expect(parseRetryAfterMs('no hint')).toBeUndefined();
  });

  it.each([
    [429, 'rate_limited'],
    [500, 'unavailable'],
    [503, 'unavailable'],
    [undefined, 'unavailable'],
    [400, 'bad_request'],
    [401, 'config'],
    [403, 'config'],
    [404, 'config'],
  ])('maps HTTP %s to %s', (status, kind) => {
    expect(mapGeminiError(Object.assign(new Error('x'), { status })).kind).toBe(kind);
  });

  it('maps aborts and timeouts to unavailable', () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const timeout = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    expect(mapGeminiError(abort).kind).toBe('unavailable');
    expect(mapGeminiError(timeout).kind).toBe('unavailable');
  });

  it('carries the announced retry delay on a 429', () => {
    const error = mapGeminiError(Object.assign(new Error('{"retryDelay":"20s"}'), { status: 429 }));
    expect(error.retryAfterMs).toBe(20_000);
    expect(error.retryable).toBe(true);
  });

  it('handles non-Error throwables', () => {
    expect(mapGeminiError('plain string').kind).toBe('unavailable');
  });
});
