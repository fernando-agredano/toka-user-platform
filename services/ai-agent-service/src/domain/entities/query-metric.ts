import type { QualityChecks } from '../services/quality-evaluator';
import type { TokenUsage } from '../services/cost-calculator';

export interface LatencyBreakdown {
  totalMs: number;
  queueWaitMs: number;
  embedMs: number;
  retrievalMs: number;
  llmMs: number;
  toolsMs: number;
}

/** One document per chat request. It deliberately stores no question or answer text (PII). */
export interface QueryMetric {
  requestId: string;
  correlationId: string | null;
  userId: string;
  conversationId: string;
  createdAt: Date;
  provider: string;
  model: string;
  promptVersion: string;
  kbVersion: string;
  latency: LatencyBreakdown;
  tokens: TokenUsage & { estimated: boolean };
  costUsd: number;
  /** Cost avoided by serving the answer from cache. */
  savedCostUsd: number;
  pricingKnown: boolean;
  cached: boolean;
  degraded: boolean;
  llmCalls: number;
  toolsUsed: string[];
  sourcesCount: number;
  topScore: number | null;
  quality: { score: number; checks: QualityChecks };
  injectionSuspected: boolean;
}

export interface Percentiles {
  p50: number;
  p95: number;
}

export interface MetricsSummary {
  from: string | null;
  to: string | null;
  requests: number;
  cacheHitRate: number;
  degradedRate: number;
  latencyMs: Percentiles;
  /** Only requests that actually called the LLM. */
  llmLatencyMs: Percentiles;
  tokens: { input: number; output: number; thoughts: number };
  costUsd: { total: number; savedByCache: number };
  avgQualityScore: number;
  byProvider: Array<{ provider: string; model: string; requests: number; costUsd: number }>;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}
