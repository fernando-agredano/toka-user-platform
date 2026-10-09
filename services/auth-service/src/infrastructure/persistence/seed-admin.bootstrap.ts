import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SeedAdminUseCase } from '../../application/use-cases/seed-admin.use-case';
import { AUTH_CONFIG, AuthConfig } from '../config/auth-config';

@Injectable()
export class SeedAdminBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedAdminBootstrap.name);

  constructor(
    private readonly seedAdmin: SeedAdminUseCase,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.seedAdmin) return;
    const created = await this.seedAdmin.execute(this.config.seedAdmin);
    if (created) this.logger.log('Seeded admin credential');
  }
}
