import { Inject, Injectable } from '@nestjs/common';
import { CREDENTIAL_REPOSITORY, CredentialRepository } from '../../domain/repositories/credential.repository';
import { REFRESH_TOKEN_STORE, RefreshTokenStore } from '../ports/ports';

/** Reacts to user.deactivated / user.activated. Idempotent: unknown users are ignored. */
@Injectable()
export class ChangeCredentialStatusUseCase {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY) private readonly credentials: CredentialRepository,
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshTokens: RefreshTokenStore,
  ) {}

  async execute(input: { userId: string; active: boolean }): Promise<void> {
    if (!input.active) await this.refreshTokens.revokeAllForUser(input.userId);

    const credential = await this.credentials.findById(input.userId);
    if (!credential) return;

    if (input.active) credential.activate();
    else credential.deactivate();
    await this.credentials.save(credential);
  }
}
