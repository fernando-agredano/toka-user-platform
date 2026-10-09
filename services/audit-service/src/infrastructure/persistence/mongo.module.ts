import { Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import mongoose, { Connection } from 'mongoose';
import { loadAuditConfig } from '../config/audit-config';
import { createAuditLogModel } from './audit-log.model';

export const MONGO_CONNECTION = Symbol('MONGO_CONNECTION');
export const AUDIT_LOG_MODEL = Symbol('AUDIT_LOG_MODEL');

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
    {
      provide: MONGO_CONNECTION,
      useFactory: () => mongoose.createConnection(loadAuditConfig().mongoUri).asPromise(),
    },
    {
      provide: AUDIT_LOG_MODEL,
      inject: [MONGO_CONNECTION],
      // autoIndex builds the unique eventId index before the consumer starts, which idempotency relies on.
      useFactory: async (connection: Connection) => {
        const model = createAuditLogModel(connection, loadAuditConfig().retentionDays);
        await model.init();
        return model;
      },
    },
    MongoShutdown,
  ],
  exports: [MONGO_CONNECTION, AUDIT_LOG_MODEL],
})
export class MongoModule {}
