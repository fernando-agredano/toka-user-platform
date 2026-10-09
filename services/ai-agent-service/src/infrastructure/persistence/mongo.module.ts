import { Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import mongoose, { Connection, type Model } from 'mongoose';
import { loadAiConfig } from '../config/ai-config';
import { type ConversationDocument, createConversationModel } from './conversation.model';
import { type MetricDocument, createMetricModel } from './metric.model';

export const MONGO_CONNECTION = Symbol('MONGO_CONNECTION');
export const METRIC_MODEL = Symbol('METRIC_MODEL');
export const CONVERSATION_MODEL = Symbol('CONVERSATION_MODEL');

@Injectable()
class MongoShutdown implements OnModuleDestroy {
  constructor(@Inject(MONGO_CONNECTION) private readonly connection: Connection) {}

  onModuleDestroy(): Promise<void> {
    return this.connection.close();
  }
}

@Global()
@Module({
  providers: [
    { provide: MONGO_CONNECTION, useFactory: () => mongoose.createConnection(loadAiConfig().mongoUri).asPromise() },
    {
      provide: METRIC_MODEL,
      inject: [MONGO_CONNECTION],
      useFactory: async (connection: Connection): Promise<Model<MetricDocument>> => {
        const model = createMetricModel(connection, loadAiConfig().metricsRetentionDays);
        await model.init();
        return model;
      },
    },
    {
      provide: CONVERSATION_MODEL,
      inject: [MONGO_CONNECTION],
      useFactory: async (connection: Connection): Promise<Model<ConversationDocument>> => {
        const model = createConversationModel(connection, loadAiConfig().conversationTtlSeconds);
        await model.init();
        return model;
      },
    },
    MongoShutdown,
  ],
  exports: [MONGO_CONNECTION, METRIC_MODEL, CONVERSATION_MODEL],
})
export class MongoModule {}
