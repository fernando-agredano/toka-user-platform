import { Inject, Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { DateRange, MetricsSummary, QueryMetric } from '../../domain/entities/query-metric';
import type { AiMetricsRepository } from '../../domain/repositories/ai-metrics.repository';
import type { MetricDocument } from './metric.model';
import { METRIC_MODEL } from './mongo.module';

interface Totals {
  requests: number;
  cached: number;
  degraded: number;
  inputTokens: number;
  outputTokens: number;
  thoughtsTokens: number;
  costUsd: number;
  savedCostUsd: number;
  avgQuality: number;
  latency: number[];
}

interface LlmTotals {
  llmLatency: number[];
}

interface ProviderTotals {
  _id: { provider: string; model: string };
  requests: number;
  costUsd: number;
}

// Mongoose 8's typings predate MongoDB 7's $percentile accumulator, so the stage is typed by hand.
const percentile = (field: string) =>
  ({ $percentile: { input: field, p: [0.5, 0.95], method: 'approximate' } }) as unknown as { $sum: number };
const round = (value: number | undefined): number => Math.round(value ?? 0);
const round6 = (value: number | undefined): number => Math.round((value ?? 0) * 1e6) / 1e6;

@Injectable()
export class MongoMetricsRepository implements AiMetricsRepository {
  constructor(@Inject(METRIC_MODEL) private readonly model: Model<MetricDocument>) {}

  async record(metric: QueryMetric): Promise<void> {
    await this.model.create(metric);
  }

  async summarize(range: DateRange): Promise<MetricsSummary> {
    const createdAt = { ...(range.from && { $gte: range.from }), ...(range.to && { $lte: range.to }) };
    const match = Object.keys(createdAt).length > 0 ? { createdAt } : {};

    // $percentile (MongoDB 7+) computes p50/p95 in the database instead of loading every metric.
    const [facets] = await this.model.aggregate<{ totals: Totals[]; llm: LlmTotals[]; providers: ProviderTotals[] }>([
      { $match: match },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                requests: { $sum: 1 },
                cached: { $sum: { $cond: ['$cached', 1, 0] } },
                degraded: { $sum: { $cond: ['$degraded', 1, 0] } },
                inputTokens: { $sum: '$tokens.input' },
                outputTokens: { $sum: '$tokens.output' },
                thoughtsTokens: { $sum: '$tokens.thoughts' },
                costUsd: { $sum: '$costUsd' },
                savedCostUsd: { $sum: '$savedCostUsd' },
                avgQuality: { $avg: '$quality.score' },
                latency: percentile('$latency.totalMs'),
              },
            },
          ],
          llm: [
            { $match: { llmCalls: { $gt: 0 } } },
            { $group: { _id: null, llmLatency: percentile('$latency.llmMs') } },
          ],
          providers: [
            {
              $group: {
                _id: { provider: '$provider', model: '$model' },
                requests: { $sum: 1 },
                costUsd: { $sum: '$costUsd' },
              },
            },
            { $sort: { requests: -1 } },
          ],
        },
      },
    ]);

    const totals = facets.totals[0];
    const [p50, p95] = totals?.latency ?? [];
    const [llmP50, llmP95] = facets.llm[0]?.llmLatency ?? [];
    const requests = totals?.requests ?? 0;

    return {
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
      requests,
      cacheHitRate: requests > 0 ? Math.round(((totals?.cached ?? 0) / requests) * 1000) / 1000 : 0,
      degradedRate: requests > 0 ? Math.round(((totals?.degraded ?? 0) / requests) * 1000) / 1000 : 0,
      latencyMs: { p50: round(p50), p95: round(p95) },
      llmLatencyMs: { p50: round(llmP50), p95: round(llmP95) },
      tokens: {
        input: totals?.inputTokens ?? 0,
        output: totals?.outputTokens ?? 0,
        thoughts: totals?.thoughtsTokens ?? 0,
      },
      costUsd: { total: round6(totals?.costUsd), savedByCache: round6(totals?.savedCostUsd) },
      avgQualityScore: Math.round((totals?.avgQuality ?? 0) * 100) / 100,
      byProvider: facets.providers.map((entry) => ({
        provider: entry._id.provider,
        model: entry._id.model,
        requests: entry.requests,
        costUsd: round6(entry.costUsd),
      })),
    };
  }
}
