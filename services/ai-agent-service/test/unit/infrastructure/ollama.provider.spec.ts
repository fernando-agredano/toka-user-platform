import type { LlmRequest } from '../../../src/application/ports/llm-provider.port';
import { OllamaProvider } from '../../../src/infrastructure/llm/ollama.provider';

const request = (overrides: Partial<LlmRequest> = {}): LlmRequest => ({
  systemPrompt: 'sys',
  messages: [
    { role: 'user', text: 'hola' },
    { role: 'model', toolCalls: [{ id: '1', name: 'search_users', args: { query: 'a' } }] },
    { role: 'tool', callId: '1', name: 'search_users', content: 'resultado' },
  ],
  tools: [{ name: 'search_users', description: 'busca', parameters: { type: 'object' } }],
  forbidTools: false,
  maxOutputTokens: 300,
  temperature: 0.2,
  topP: 0.9,
  thinkingBudget: 0,
  ...overrides,
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function providerWith(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { provider: new OllamaProvider('http://ollama:11434', 'llama3.2:3b', fetcher), calls };
}

describe('OllamaProvider', () => {
  it('maps the conversation, tools and sampling options to the chat API', async () => {
    const { provider, calls } = providerWith(() => jsonResponse({ message: { content: 'hola' }, prompt_eval_count: 50, eval_count: 7 }));
    const result = await provider.generate(request());

    expect(calls[0].url).toBe('http://ollama:11434/api/chat');
    expect(calls[0].body).toMatchObject({
      model: 'llama3.2:3b',
      stream: false,
      options: { temperature: 0.2, top_p: 0.9, num_predict: 300 },
    });
    expect(calls[0].body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: '', tool_calls: [{ function: { name: 'search_users', arguments: { query: 'a' } } }] },
      { role: 'tool', tool_name: 'search_users', content: 'resultado' },
    ]);
    expect(calls[0].body.tools).toHaveLength(1);
    expect(result).toMatchObject({ text: 'hola', usage: { input: 50, output: 7, estimated: false } });
  });

  it('does not offer tools on the final round, since Ollama cannot forbid them', async () => {
    const { provider, calls } = providerWith(() => jsonResponse({ message: { content: 'ok' } }));
    await provider.generate(request({ forbidTools: true }));
    expect(calls[0].body.tools).toBeUndefined();
  });

  it('reads tool calls and marks usage as estimated when counts are missing', async () => {
    const { provider } = providerWith(() =>
      jsonResponse({ message: { content: '', tool_calls: [{ function: { name: 'search_users', arguments: { query: 'x' } } }] } }),
    );
    const result = await provider.generate(request());
    expect(result.toolCalls).toEqual([{ id: 'call_0', name: 'search_users', args: { query: 'x' } }]);
    expect(result.usage.estimated).toBe(true);
  });

  it.each([
    [400, 'bad_request'],
    [404, 'config'],
    [429, 'unavailable'],
    [500, 'unavailable'],
  ])('maps HTTP %s to %s', async (status, kind) => {
    const { provider } = providerWith(() => jsonResponse({}, status));
    await expect(provider.generate(request())).rejects.toMatchObject({ kind });
  });

  it('reports an unreachable server as unavailable', async () => {
    const { provider } = providerWith(() => {
      throw new Error('connect ECONNREFUSED');
    });
    await expect(provider.generate(request())).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('is not subject to the shared provider quota', () => {
    expect(providerWith(() => jsonResponse({})).provider.rateLimited).toBe(false);
  });
});
