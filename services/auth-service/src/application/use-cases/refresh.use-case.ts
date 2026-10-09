import { Inject, Injectable } from '@nestjs/common';
import { InvalidRefreshTokenError } from '../../domain/errors/domain-error';
import { CREDENTIAL_REPOSITORY, CredentialRepository } from '../../domain/repositories/credential.repository';
import type { SessionWithRefresh } from '../dtos/auth.dtos';
import { REFRESH_TOKEN_STORE, RefreshTokenStore } from '../ports/ports';
import { SessionIssuer } from '../services/session-issuer';

@Injectable()
export class RefreshUseCase {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY) private readonly credentials: CredentialRepository,
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshTokens: RefreshTokenStore,
    private readonly sessions: SessionIssuer,
  ) {}

  async execute(input: { refreshToken: string }): Promise<SessionWithRefresh> {
    const { userId, next } = await this.refreshTokens.rotate(input.refreshToken);

    const credential = await this.credentials.findById(userId);
    if (!credential || !credential.isActive) {
      await this.refreshTokens.revokeAllForUser(userId);
      throw new InvalidRefreshTokenError();
    }

    const session = await this.sessions.issue(credential);
    return { ...session, refreshToken: next.token, refreshTtlSeconds: next.ttlSeconds };
  }
}
