import {
  type GenerateOptions,
  type LlmMessage,
  type LlmProvider,
  LlmProviderError,
  type LlmRequest,
  type LlmResponse,
} from '../../application/ports/llm-provider.port';

interface OllamaChatResponse {
  message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> };
  prompt_eval_count?: number;
  eval_count?: number;
}

type OllamaMessage = Record<string, unknown>;

function toOllamaMessages(systemPrompt: string, messages: LlmMessage[]): OllamaMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    ...messages.map((message): OllamaMessage => {
      if (message.role === 'user') return { role: 'user', content: message.text };
      if (message.role === 'tool') return { role: 'tool', tool_name: message.name, content: message.content };
      return {
        role: 'assistant',
        content: message.text ?? '',
        ...(message.toolCalls && {
          tool_calls: message.toolCalls.map((call) => ({ function: { name: call.name, arguments: call.args } })),
        }),
      };
    }),
  ];
}

export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama';
  readonly rateLimited = false;

  constructor(
    private readonly baseUrl: string,
    readonly model: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async generate(request: LlmRequest, options: GenerateOptions = {}): Promise<LlmResponse> {
    const body = {
      model: this.model,
      stream: false,
      messages: toOllamaMessages(request.systemPrompt, request.messages),
      // Ollama has no "forbid tools" mode, so the tools are simply not offered on the final round.
      ...(request.tools.length > 0 &&
        !request.forbidTools && {
          tools: request.tools.map((tool) => ({
            type: 'function',
            function: { name: tool.name, description: tool.description, parameters: tool.parameters },
          })),
        }),
      options: { temperature: request.temperature, top_p: request.topP, num_predict: request.maxOutputTokens },
    };

    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: options.signal,
      });
    } catch (error) {
      throw new LlmProviderError(`Ollama unreachable: ${(error as Error).message}`, 'unavailable');
    }

    if (!response.ok) {
      const detail = `Ollama responded ${response.status}`;
      if (response.status === 400) throw new LlmProviderError(detail, 'bad_request');
      if (response.status >= 500 || response.status === 429) throw new LlmProviderError(detail, 'unavailable');
      throw new LlmProviderError(detail, 'config');
    }

    const data = (await response.json()) as OllamaChatResponse;
    return {
      text: data.message?.content ?? '',
      toolCalls: (data.message?.tool_calls ?? []).map((call, index) => ({
        id: `call_${index}`,
        name: call.function.name,
        args: call.function.arguments ?? {},
      })),
      usage: {
        input: data.prompt_eval_count ?? 0,
        output: data.eval_count ?? 0,
        thoughts: 0,
        cachedInput: 0,
        estimated: data.prompt_eval_count === undefined,
      },
    };
  }
}
