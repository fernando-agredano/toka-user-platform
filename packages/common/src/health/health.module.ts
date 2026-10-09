import { Controller, DynamicModule, Get, Inject, Module, ModuleMetadata } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorFunction,
  TerminusModule,
} from '@nestjs/terminus';

const HEALTH_CHECKS = Symbol('HEALTH_CHECKS');

/** Builds a Terminus indicator from any async probe (e.g. `SELECT 1`, `PING`). */
export const createPingIndicator =
  (name: string, probe: () => Promise<unknown>): HealthIndicatorFunction =>
  async () => {
    try {
      await probe();
      return { [name]: { status: 'up' } };
    } catch (error) {
      throw new HealthCheckError(`${name} check failed`, {
        [name]: { status: 'down', message: error instanceof Error ? error.message : 'unreachable' },
      });
    }
  };

@Controller('health')
class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(HEALTH_CHECKS) private readonly checks: HealthIndicatorFunction[],
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check(this.checks);
  }
}

export interface HealthModuleOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: unknown[];
  useFactory: (...deps: never[]) => HealthIndicatorFunction[];
}

@Module({})
export class HealthModule {
  static registerAsync(options: HealthModuleOptions): DynamicModule {
    return {
      module: HealthModule,
      imports: [TerminusModule, ...(options.imports ?? [])],
      controllers: [HealthController],
      providers: [
        { provide: HEALTH_CHECKS, useFactory: options.useFactory, inject: (options.inject ?? []) as never[] },
      ],
    };
  }
}
