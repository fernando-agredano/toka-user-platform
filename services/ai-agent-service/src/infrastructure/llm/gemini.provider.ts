import {
  type Content,
  FunctionCallingConfigMode,
  type GenerateContentConfig,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';
import {
  type GenerateOptions,
  type LlmMessage,
  type LlmProvider,
  LlmProviderError,
  type LlmRequest,
  type LlmResponse,
} from '../../application/ports/llm-provider.port';

/** The slice of the SDK client this adapter uses, so tests can inject a fake instead of calling the network. */
export interface GeminiClient {
  models: { generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> };
}

const RETRY_DELAY = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/;
const RETRY_IN = /retry in (\d+(?:\.\d+)?)s/i;

export function parseRetryAfterMs(message: string): number | undefined {
  const seconds = RETRY_DELAY.exec(message)?.[1] ?? RETRY_IN.exec(message)?.[1];
  return seconds ? Math.ceil(Number(seconds) * 1000) : undefined;
}

export function mapGeminiError(error: unknown): LlmProviderError {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return new LlmProviderError('Gemini request timed out', 'unavailable');
  }
  const status = (error as { status?: number }).status;
  if (status === 429) return new LlmProviderError(message, 'rate_limited', parseRetryAfterMs(message));
  if (status === undefined || status >= 500) return new LlmProviderError(message, 'unavailable');
  if (status === 400) return new LlmProviderError(message, 'bad_request');
  return new LlmProviderError(message, 'config');
}

// Gemini matches function responses to calls by name and order, so call ids are not sent.
export function toContents(messages: LlmMessage[]): Content[] {
  const contents: Content[] = [];
  for (const message of messages) {
    if (message.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: message.text }] });
    } else if (message.role === 'model') {
      contents.push(
        message.raw
          ? (message.raw as Content)
          : {
              role: 'model',
              parts: [
                ...(message.text ? [{ text: message.text }] : []),
                ...(message.toolCalls ?? []).map((call) => ({ functionCall: { name: call.name, args: call.args } })),
              ],
            },
      );
    } else {
      const part = { functionResponse: { name: message.name, response: { output: message.content } } };
      const last = contents[contents.length - 1];
      // Several responses to one round of calls must travel in a single turn.
      if (last?.role === 'user' && last.parts?.every((existing) => existing.functionResponse)) last.parts.push(part);
      else contents.push({ role: 'user', parts: [part] });
    }
  }
  return contents;
}

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  readonly rateLimited = true;

  constructor(
    private readonly client: GeminiClient,
    readonly model: string,
  ) {}

  async generate(request: LlmRequest, options: GenerateOptions = {}): Promise<LlmResponse> {
    const config: GenerateContentConfig = {
      systemInstruction: request.systemPrompt,
      maxOutputTokens: request.maxOutputTokens,
      temperature: request.temperature,
      topP: request.topP,
      candidateCount: 1,
      thinkingConfig: { thinkingBudget: request.thinkingBudget },
      abortSignal: options.signal,
      ...(request.tools.length > 0 && {
        tools: [
          {
            functionDeclarations: request.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parametersJsonSchema: tool.parameters,
            })),
          },
        ],
        ...(request.forbidTools && {
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.NONE } },
        }),
      }),
    };

    let response: GenerateContentResponse;
    try {
      response = await this.client.models.generateContent({
        model: this.model,
        contents: toContents(request.messages),
        config,
      });
    } catch (error) {
      throw mapGeminiError(error);
    }

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const usage = response.usageMetadata;
    return {
      text: parts
        .filter((part) => typeof part.text === 'string' && !part.thought)
        .map((part) => part.text)
        .join(''),
      toolCalls: parts.flatMap((part, index) =>
        part.functionCall
          ? [{ id: part.functionCall.id ?? `call_${index}`, name: part.functionCall.name ?? '', args: part.functionCall.args ?? {} }]
          : [],
      ),
      usage: {
        input: usage?.promptTokenCount ?? 0,
        output: usage?.candidatesTokenCount ?? 0,
        thoughts: usage?.thoughtsTokenCount ?? 0,
        cachedInput: usage?.cachedContentTokenCount ?? 0,
        estimated: usage === undefined,
      },
      raw: candidate?.content,
    };
  }
}
