import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '@toka/common';
import type { UserAuthorization } from '../../application/dtos/role.dtos';
import { GetUserAuthorizationUseCase } from '../../application/use-cases/get-user-authorization.use-case';

/** Service-to-service only: the gateway hides every internal route from outside. */
@Controller('internal/users')
@UseGuards(InternalApiKeyGuard)
export class InternalAuthorizationController {
  constructor(private readonly getAuthorization: GetUserAuthorizationUseCase) {}

  @Get(':userId/permissions')
  permissions(@Param('userId', ParseUUIDPipe) userId: string): Promise<UserAuthorization> {
    return this.getAuthorization.execute(userId);
  }
}
