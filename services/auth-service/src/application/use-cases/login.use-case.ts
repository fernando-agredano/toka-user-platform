import { Inject, Injectable } from '@nestjs/common';
import { ClientContext, loginFailed, loginLocked, loginSucceeded } from '../../domain/events/auth-events';
import {
  AccountDisabledError,
  AccountLockedError,
  InvalidCredentialsError,
} from '../../domain/errors/domain-error';
import { CREDENTIAL_REPOSITORY, CredentialRepository } from '../../domain/repositories/credential.repository';
import { Email } from '../../domain/value-objects/email';
import type { SessionWithRefresh } from '../dtos/auth.dtos';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
  LOGIN_ATTEMPT_TRACKER,
  LoginAttemptTracker,
  PASSWORD_HASHER,
  PasswordHasher,
  REFRESH_TOKEN_STORE,
  RefreshTokenStore,
} from '../ports/ports';
import { SessionIssuer } from '../services/session-issuer';

export interface LoginInput extends ClientContext {
  email: string;
  password: string;
}

@Injectable()
export class LoginUseCase {
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(CREDENTIAL_REPOSITORY) private readonly credentials: CredentialRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(LOGIN_ATTEMPT_TRACKER) private readonly attempts: LoginAttemptTracker,
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshTokens: RefreshTokenStore,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly sessions: SessionIssuer,
  ) {}

  async execute(input: LoginInput): Promise<SessionWithRefresh> {
    const email = Email.create(input.email);
    if (await this.attempts.isLocked(email.value)) throw new AccountLockedError();

    const credential = await this.credentials.findByEmail(email);
    const passwordMatches = await this.verifyPassword(credential?.passwordHash, input.password);
    if (!credential || !passwordMatches) {
      await this.registerFailure(email.value, credential?.id ?? null, input);
      throw new InvalidCredentialsError();
    }
    if (!credential.isActive) throw new AccountDisabledError();

    // Resolve permissions before consuming state, so a role-service outage (503) leaves nothing half-done.
    const session = await this.sessions.issue(credential);
    const refresh = await this.refreshTokens.issue(credential.id);
    await this.attempts.reset(email.value);
    await this.events.publish(loginSucceeded(credential.id, email.value, input));

    return { ...session, refreshToken: refresh.token, refreshTtlSeconds: refresh.ttlSeconds };
  }

  /** Unknown emails still pay for a hash verification, so response time does not reveal which emails exist. */
  private async verifyPassword(hash: string | undefined, plain: string): Promise<boolean> {
    this.dummyHash ??= this.hasher.hash('timing-equalizer');
    const passwordMatches = await this.hasher.verify(hash ?? (await this.dummyHash), plain);
    return hash !== undefined && passwordMatches;
  }

  private async registerFailure(email: string, userId: string | null, client: ClientContext): Promise<void> {
    const { justLocked } = await this.attempts.registerFailure(email);
    await this.events.publish(loginFailed(email, userId, client));
    if (justLocked) await this.events.publish(loginLocked(email, userId, client));
  }
}
