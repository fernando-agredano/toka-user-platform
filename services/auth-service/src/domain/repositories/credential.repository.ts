import type { Credential } from '../entities/credential';
import type { DomainEvent } from '../events/auth-events';
import type { Email } from '../value-objects/email';

export const CREDENTIAL_REPOSITORY = Symbol('CREDENTIAL_REPOSITORY');

export interface CredentialRepository {
  findById(id: string): Promise<Credential | null>;
  findByEmail(email: Email): Promise<Credential | null>;
  /**
   * Persists the credential together with the events it produced, atomically
   * (transactional outbox). Throws EmailAlreadyRegisteredError on a duplicate email.
   */
  save(credential: Credential, events?: DomainEvent[]): Promise<void>;
}
