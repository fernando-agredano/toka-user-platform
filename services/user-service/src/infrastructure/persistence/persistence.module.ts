import { Global, Module } from '@nestjs/common';
import { OUTBOX_DB } from '@toka/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, { provide: OUTBOX_DB, useExisting: PrismaService }],
  exports: [PrismaService, OUTBOX_DB],
})
export class PersistenceModule {}
