import { Inject, Injectable } from '@nestjs/common';
import type { Credential } from '../../domain/entities/credential';
import type { Session } from '../dtos/auth.dtos';
import {
  ACCESS_TOKEN_ISSUER,
  AccessTokenIssuer,
  PERMISSIONS_PROVIDER,
  PermissionsProvider,
} from '../ports/ports';

/** Builds the access token + user snapshot shared by login and refresh. */
@Injectable()
export class SessionIssuer {
  constructor(
    @Inject(PERMISSIONS_PROVIDER) private readonly permissions: PermissionsProvider,
    @Inject(ACCESS_TOKEN_ISSUER) private readonly accessTokens: AccessTokenIssuer,
  ) {}

  async issue(credential: Credential): Promise<Session> {
    const { roles, permissions } = await this.permissions.getAuthorization(credential.id);
    const email = credential.email.value;
    const { token, expiresIn } = await this.accessTokens.issue({ userId: credential.id, email, roles, permissions });
    return { accessToken: token, expiresIn, user: { id: credential.id, email, roles, permissions } };
  }
}
