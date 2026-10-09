import { Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import type { LlmProvider } from '../../application/ports/llm-provider.port';
import type { AiConfig, LlmProviderKind } from '../config/ai-config';
import { GeminiProvider } from './gemini.provider';
import { MockProvider } from './mock.provider';
import { OllamaProvider } from './ollama.provider';

const logger = new Logger('LlmProviders');

function createProvider(kind: LlmProviderKind, llm: AiConfig['llm']): LlmProvider {
  if (kind === 'ollama') return new OllamaProvider(llm.ollamaUrl, llm.ollamaModel);
  if (kind === 'gemini') {
    if (llm.geminiApiKey) return new GeminiProvider(new GoogleGenAI({ apiKey: llm.geminiApiKey }), llm.geminiModel);
    logger.warn('GEMINI_API_KEY is empty: starting with MockProvider (answers are extractive, not generated)');
  }
  return new MockProvider();
}

/** Primary provider first, then the optional fallback; duplicates (e.g. both resolving to the mock) are dropped. */
export function createLlmChain(llm: AiConfig['llm']): LlmProvider[] {
  const chain = [createProvider(llm.provider, llm)];
  if (llm.fallback !== 'none') {
    const fallback = createProvider(llm.fallback, llm);
    if (!chain.some((provider) => provider.name === fallback.name)) chain.push(fallback);
  }
  return chain;
}
