import type { UserCache, CredentialGateway, NewCredential } from '../../../src/application/ports/ports';
import type { UserView } from '../../../src/application/dtos/user.dtos';
import { User } from '../../../src/domain/entities/user';
import type { DomainEvent } from '../../../src/domain/events/user-events';
import { EmailAlreadyExistsError } from '../../../src/domain/errors/domain-error';
import type { UserListFilter, UserRepository } from '../../../src/domain/repositories/user.repository';
import { Email } from '../../../src/domain/value-objects/email';
import { PersonName } from '../../../src/domain/value-objects/person-name';

export class InMemoryUserRepository implements UserRepository {
  readonly items = new Map<string, User>();
  readonly savedEvents: DomainEvent[] = [];

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }

  async findByEmail(email: Email) {
    return [...this.items.values()].find((item) => item.email.equals(email)) ?? null;
  }

  async list({ page, limit, search, status }: UserListFilter) {
    const needle = search?.toLowerCase();
    const matching = [...this.items.values()].filter(
      (user) =>
        (!status || user.status === status) &&
        (!needle || [user.email.value, user.firstName.value, user.lastName.value].some((v) => v.toLowerCase().includes(needle))),
    );
    return { items: matching.slice((page - 1) * limit, page * limit), total: matching.length };
  }

  async save(user: User, events: DomainEvent[] = []) {
    const clash = await this.findByEmail(user.email);
    if (clash && clash.id !== user.id) throw new EmailAlreadyExistsError();
    this.items.set(user.id, user);
    this.savedEvents.push(...events);
  }

  eventTypes() {
    return this.savedEvents.map((event) => event.type);
  }
}

export class InMemoryUserCache implements UserCache {
  readonly entries = new Map<string, UserView>();

  async get(userId: string) {
    return this.entries.get(userId) ?? null;
  }

  async set(user: UserView) {
    this.entries.set(user.id, user);
  }

  async invalidate(userId: string) {
    this.entries.delete(userId);
  }
}

export class FakeCredentialGateway implements CredentialGateway {
  readonly created: NewCredential[] = [];
  failWith?: Error;
  /** Runs once the credential is "created", to simulate a concurrent consumer. */
  onCreated?: (credential: NewCredential) => Promise<void>;

  async create(credential: NewCredential) {
    if (this.failWith) throw this.failWith;
    this.created.push(credential);
    await this.onCreated?.(credential);
  }
}

export const buildUser = (overrides: { id?: string; email?: string; firstName?: string; lastName?: string } = {}) =>
  User.create({
    id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
    email: Email.create(overrides.email ?? 'ana@toka.mx'),
    firstName: PersonName.create(overrides.firstName ?? 'Ana', 'firstName'),
    lastName: PersonName.create(overrides.lastName ?? 'López', 'lastName'),
  });
