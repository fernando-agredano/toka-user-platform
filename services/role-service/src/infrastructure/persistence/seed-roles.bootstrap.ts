import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SeedRolesUseCase } from '../../application/use-cases/seed-roles.use-case';

/** Runs in OnModuleInit, before consumers subscribe (OnApplicationBootstrap), so the USER role exists for the first event. */
@Injectable()
export class SeedRolesBootstrap implements OnModuleInit {
  private readonly logger = new Logger(SeedRolesBootstrap.name);

  constructor(private readonly seedRoles: SeedRolesUseCase) {}

  async onModuleInit(): Promise<void> {
    await this.seedRoles.execute();
    this.logger.log('Seed roles ensured');
  }
}
