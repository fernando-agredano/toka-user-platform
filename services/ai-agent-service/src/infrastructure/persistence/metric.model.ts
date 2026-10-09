import { Connection, type Model, Schema } from 'mongoose';
import type { QueryMetric } from '../../domain/entities/query-metric';

export type MetricDocument = QueryMetric;

const SECONDS_PER_DAY = 86_400;

export function createMetricModel(connection: Connection, retentionDays: number): Model<MetricDocument> {
  // `strict: false` keeps the nested latency/tokens/quality objects exactly as the domain defines them.
  const schema = new Schema<MetricDocument>(
    {
      requestId: { type: String, required: true, unique: true },
      userId: { type: String, required: true, index: true },
      createdAt: { type: Date, required: true },
      provider: { type: String, required: true },
      cached: { type: Boolean, required: true },
      llmCalls: { type: Number, required: true },
    },
    { collection: 'ai_metrics', versionKey: false, strict: false },
  );
  schema.index({ createdAt: 1 }, retentionDays > 0 ? { expireAfterSeconds: retentionDays * SECONDS_PER_DAY } : {});
  return connection.model<MetricDocument>('AiMetric', schema);
}
