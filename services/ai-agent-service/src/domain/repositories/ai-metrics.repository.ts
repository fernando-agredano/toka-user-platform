import type { DateRange, MetricsSummary, QueryMetric } from '../entities/query-metric';

export const AI_METRICS_REPOSITORY = Symbol('AI_METRICS_REPOSITORY');

export interface AiMetricsRepository {
  record(metric: QueryMetric): Promise<void>;
  summarize(range: DateRange): Promise<MetricsSummary>;
}
