import { readFileSync } from 'node:fs';
import { Global, Module } from '@nestjs/common';
import { resolve } from 'node:path';
import { intEnv, optionalEnv, requireEnv } from '@toka/common';
import { type AgentSettings, DEFAULT_AGENT_SETTINGS } from '../../application/ports/agent-settings';
import type { PricingTable } from '../../domain/services/cost-calculator';

export type LlmProviderKind = 'gemini' | 'ollama' | 'mock';
export type FallbackKind = LlmProviderKind | 'none';

export interface AiConfig {
  port: number;
  mongoUri: string;
  qdrantUrl: string;
  qdrantCollection: string;
  knowledgeDir: string;
  services: { users: string; roles: string; audit: string };
  llm: {
    provider: LlmProviderKind;
    fallback: FallbackKind;
    geminiApiKey: string;
    geminiModel: string;
    ollamaUrl: string;
    ollamaModel: string;
    /** Calls per minute shared by all replicas. */
    rpmLimit: number;
    gateMaxWaitMs: number;
    maxRetries: number;
    retryBaseDelayMs: number;
  };
  embedding: { model: string; dimensions: number; dtype: string; cacheDir: string };
  userRateLimitPerMinute: number;
  metricsRetentionDays: number;
  conversationTtlSeconds: number;
}

// Chosen with `npm run eval:retrieval` (see docs/decisiones.md): the English-only MiniLM ranked Spanish text worse
// and let out-of-domain questions score up to 0.50; this multilingual model has the same 384 dimensions.
export const DEFAULT_EMBEDDING_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
export const DEFAULT_EMBEDDING_DTYPE = 'q8';

// src/ and dist/ sit at the same depth, so the service root is three levels up in both.
const SERVICE_ROOT = resolve(__dirname, '../../..');

function kindEnv<T extends string>(name: string, allowed: readonly T[], fallback: T, env: NodeJS.ProcessEnv): T {
  const value = optionalEnv(name, fallback, env).toLowerCase();
  if (!(allowed as readonly string[]).includes(value)) throw new Error(`${name} must be one of: ${allowed.join(', ')}`);
  return value as T;
}

export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  return {
    port: intEnv('PORT', 3005, env),
    mongoUri: requireEnv('MONGO_URI', env),
    qdrantUrl: requireEnv('QDRANT_URL', env),
    qdrantCollection: optionalEnv('QDRANT_COLLECTION', 'knowledge_base', env),
    knowledgeDir: optionalEnv('KNOWLEDGE_DIR', resolve(SERVICE_ROOT, 'knowledge'), env),
    services: {
      users: requireEnv('USER_SERVICE_URL', env),
      roles: requireEnv('ROLE_SERVICE_URL', env),
      audit: requireEnv('AUDIT_SERVICE_URL', env),
    },
    llm: {
      provider: kindEnv('LLM_PROVIDER', ['gemini', 'ollama', 'mock'], 'gemini', env),
      fallback: kindEnv('LLM_FALLBACK_PROVIDER', ['gemini', 'ollama', 'mock', 'none'], 'none', env),
      geminiApiKey: optionalEnv('GEMINI_API_KEY', '', env),
      geminiModel: optionalEnv('GEMINI_MODEL', 'gemini-2.5-flash-lite', env),
      ollamaUrl: optionalEnv('OLLAMA_URL', 'http://ollama:11434', env),
      ollamaModel: optionalEnv('OLLAMA_MODEL', 'llama3.2:3b', env),
      rpmLimit: intEnv('LLM_RPM_LIMIT', 8, env),
      gateMaxWaitMs: intEnv('LLM_GATE_MAX_WAIT_MS', 8000, env),
      maxRetries: intEnv('LLM_MAX_RETRIES', 2, env),
      retryBaseDelayMs: intEnv('LLM_RETRY_BASE_DELAY_MS', 1000, env),
    },
    embedding: {
      model: optionalEnv('EMBEDDING_MODEL', DEFAULT_EMBEDDING_MODEL, env),
      dimensions: intEnv('EMBEDDING_DIMENSIONS', 384, env),
      dtype: optionalEnv('EMBEDDING_DTYPE', DEFAULT_EMBEDDING_DTYPE, env),
      cacheDir: optionalEnv('HF_CACHE_DIR', resolve(SERVICE_ROOT, '.cache'), env),
    },
    userRateLimitPerMinute: intEnv('AI_RATE_LIMIT_PER_MINUTE', 5, env),
    metricsRetentionDays: intEnv('AI_METRICS_RETENTION_DAYS', 90, env),
    conversationTtlSeconds: intEnv('AI_CONVERSATION_TTL_SECONDS', 86_400, env),
  };
}

export function loadAgentSettings(env: NodeJS.ProcessEnv = process.env): AgentSettings {
  const defaults = DEFAULT_AGENT_SETTINGS;
  const minScore = Number.parseFloat(optionalEnv('RAG_MIN_SCORE', String(defaults.rag.minScore), env));
  if (Number.isNaN(minScore)) throw new Error('RAG_MIN_SCORE must be a number');
  return {
    ...defaults,
    deadlineMs: intEnv('AI_DEADLINE_MS', defaults.deadlineMs, env),
    rag: { ...defaults.rag, minScore, topK: intEnv('RAG_TOP_K', defaults.rag.topK, env) },
  };
}

/** `LLM_PRICING_JSON` overrides the bundled table without rebuilding the image; both share the same format. */
export function loadPricing(env: NodeJS.ProcessEnv = process.env): PricingTable {
  const raw = env.LLM_PRICING_JSON || readFileSync(resolve(SERVICE_ROOT, 'config/llm-pricing.json'), 'utf8');
  const parsed = JSON.parse(raw) as { models?: PricingTable };
  if (!parsed.models) throw new Error('Pricing JSON must contain a "models" object');
  return parsed.models;
}

export const AI_CONFIG = Symbol('AI_CONFIG');

@Global()
@Module({
  providers: [{ provide: AI_CONFIG, useFactory: () => loadAiConfig() }],
  exports: [AI_CONFIG],
})
export class AiConfigModule {}
