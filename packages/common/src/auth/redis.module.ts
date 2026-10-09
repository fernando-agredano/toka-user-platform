import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { requireEnv } from '../config/env';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

class RedisLifecycle implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}

@Global()
@Module({
  providers: [{ provide: REDIS_CLIENT, useFactory: () => new Redis(requireEnv('REDIS_URL')) }, RedisLifecycle],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
