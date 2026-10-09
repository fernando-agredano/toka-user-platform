import type { User, UserStatus } from '../entities/user';
import type { DomainEvent } from '../events/user-events';
import type { Email } from '../value-objects/email';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserListFilter {
  page: number;
  limit: number;
  /** Case-insensitive match on email, first name or last name. */
  search?: string;
  status?: UserStatus;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  list(filter: UserListFilter): Promise<{ items: User[]; total: number }>;
  /**
   * Upserts the user together with the events it produced, atomically (transactional outbox).
   * Throws EmailAlreadyExistsError when the email belongs to a different user.
   */
  save(user: User, events?: DomainEvent[]): Promise<void>;
}
