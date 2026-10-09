import { Inject, Injectable } from '@nestjs/common';
import { InvalidDateRangeError } from '../../domain/errors/domain-error';
import type { MetricsSummary } from '../../domain/entities/query-metric';
import { AI_METRICS_REPOSITORY, type AiMetricsRepository } from '../../domain/repositories/ai-metrics.repository';

@Injectable()
export class GetMetricsUseCase {
  constructor(@Inject(AI_METRICS_REPOSITORY) private readonly metrics: AiMetricsRepository) {}

  execute(query: { from?: string; to?: string }): Promise<MetricsSummary> {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to) throw new InvalidDateRangeError();
    return this.metrics.summarize({ from, to });
  }
}
