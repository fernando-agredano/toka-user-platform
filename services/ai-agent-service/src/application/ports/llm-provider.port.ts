import type { TokenUsage } from '../../domain/services/cost-calculator';

export interface JsonSchema {
  type: 'object' | 'string' | 'integer' | 'number' | 'boolean';
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: string[];
  format?: 'uuid' | 'date-time';
  minimum?: number;
  maximum?: number;
  maxLength?: number;
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type LlmMessage =
  | { role: 'user'; text: string }
  /** `raw` is the provider's own representation, replayed verbatim (some providers need opaque reasoning signatures back). */
  | { role: 'model'; text?: string; toolCalls?: ToolCall[]; raw?: unknown }
  | { role: 'tool'; callId: string; name: string; content: string };

export interface LlmRequest {
  systemPrompt: string;
  messages: LlmMessage[];
  tools: ToolDeclaration[];
  /** Keep the tools declared (the history may contain calls) but forbid new ones. */
  forbidTools: boolean;
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  thinkingBudget: number;
}

export interface LlmUsage extends TokenUsage {
  /** True when the provider reported no counts and they were approximated from text length. */
  estimated: boolean;
}

export interface LlmResponse {
  text: string;
  toolCalls: ToolCall[];
  usage: LlmUsage;
  raw?: unknown;
}

export interface GenerateOptions {
  signal?: AbortSignal;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  /** Whether calls count against the shared provider quota (RPM). Local providers do not. */
  readonly rateLimited: boolean;
  generate(request: LlmRequest, options?: GenerateOptions): Promise<LlmResponse>;
}

export type LlmErrorKind = 'rate_limited' | 'unavailable' | 'config' | 'bad_request';

/** The only error a provider adapter throws, so the resilience layer never inspects SDK-specific shapes. */
export class LlmProviderError extends Error {
  constructor(
    message: string,
    readonly kind: LlmErrorKind,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }

  get retryable(): boolean {
    return this.kind === 'rate_limited' || this.kind === 'unavailable';
  }
}

export const LLM_CHAIN = Symbol('LLM_CHAIN');
