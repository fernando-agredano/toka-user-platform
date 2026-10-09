import { Credential } from '../../../src/domain/entities/credential';
import type { DomainEvent } from '../../../src/domain/events/auth-events';
import { InvalidRefreshTokenError } from '../../../src/domain/errors/domain-error';
import type { CredentialRepository } from '../../../src/domain/repositories/credential.repository';
import type { Email } from '../../../src/domain/value-objects/email';
import type {
  AccessTokenIssuer,
  EventPublisherPort,
  LoginAttemptTracker,
  PasswordHasher,
  PermissionsProvider,
  RefreshTokenStore,
  TokenBlacklist,
} from '../../../src/application/ports/ports';
import { SessionIssuer } from '../../../src/application/services/session-issuer';

export class InMemoryCredentialRepository implements CredentialRepository {
  readonly items = new Map<string, Credential>();
  readonly savedEvents: DomainEvent[] = [];

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }

  async findByEmail(email: Email) {
    return [...this.items.values()].find((item) => item.email.equals(email)) ?? null;
  }

  async save(credential: Credential, events: DomainEvent[] = []) {
    this.items.set(credential.id, credential);
    this.savedEvents.push(...events);
  }
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string) {
    return `hashed:${plain}`;
  }

  async verify(hash: string, plain: string) {
    return hash === `hashed:${plain}`;
  }
}

export class FakeEventPublisher implements EventPublisherPort {
  readonly events: DomainEvent[] = [];

  async publish(event: DomainEvent) {
    this.events.push(event);
  }

  types() {
    return this.events.map((event) => event.type);
  }
}

export class FakeLoginAttemptTracker implements LoginAttemptTracker {
  private readonly failures = new Map<string, number>();

  constructor(private readonly maxAttempts = 5) {}

  async isLocked(email: string) {
    return (this.failures.get(email) ?? 0) >= this.maxAttempts;
  }

  async registerFailure(email: string) {
    const attempts = (this.failures.get(email) ?? 0) + 1;
    this.failures.set(email, attempts);
    return { attempts, justLocked: attempts === this.maxAttempts };
  }

  async reset(email: string) {
    this.failures.delete(email);
  }
}

export class FakeRefreshTokenStore implements RefreshTokenStore {
  readonly active = new Map<string, string>();
  private counter = 0;

  async issue(userId: string) {
    const token = `refresh-${++this.counter}`;
    this.active.set(token, userId);
    return { token, ttlSeconds: 604800 };
  }

  async rotate(token: string) {
    const userId = this.active.get(token);
    if (!userId) throw new InvalidRefreshTokenError();
    this.active.delete(token);
    return { userId, next: await this.issue(userId) };
  }

  async revoke(token: string) {
    this.active.delete(token);
  }

  async revokeAllForUser(userId: string) {
    for (const [token, owner] of this.active) if (owner === userId) this.active.delete(token);
  }
}

export class FakeTokenBlacklist implements TokenBlacklist {
  readonly entries = new Map<string, number>();

  async blacklist(jti: string, expiresAt: number) {
    this.entries.set(jti, expiresAt);
  }
}

export class FakePermissionsProvider implements PermissionsProvider {
  constructor(public authorization = { roles: ['USER'], permissions: ['ai:use'] }) {}

  async getAuthorization() {
    return this.authorization;
  }
}

export const fakeAccessTokenIssuer: AccessTokenIssuer = {
  async issue(claims) {
    return { token: `access-for-${claims.userId}`, expiresIn: 900 };
  },
};

export const buildSessionIssuer = (permissions: PermissionsProvider = new FakePermissionsProvider()) =>
  new SessionIssuer(permissions, fakeAccessTokenIssuer);
