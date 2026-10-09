import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SeedAdminUseCase } from '../../application/use-cases/seed-admin.use-case';
import { USER_CONFIG, UserConfig } from '../config/user-config';

@Injectable()
export class SeedAdminBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedAdminBootstrap.name);

  constructor(
    private readonly seedAdmin: SeedAdminUseCase,
    @Inject(USER_CONFIG) private readonly config: UserConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.seedAdminEmail) return;
    const created = await this.seedAdmin.execute({ email: this.config.seedAdminEmail });
    if (created) this.logger.log('Seeded admin profile');
  }
}
