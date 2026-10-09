export type DomainErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'too_many_requests'
  | 'unavailable';

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly kind: DomainErrorKind;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidEmailError extends DomainError {
  readonly code = 'invalid-email';
  readonly kind = 'validation';
  constructor() {
    super('Email address is not valid');
  }
}

export class InvalidNameError extends DomainError {
  readonly code = 'invalid-name';
  readonly kind = 'validation';
}

export class UserNotFoundError extends DomainError {
  readonly code = 'user-not-found';
  readonly kind = 'not_found';
  constructor() {
    super('User not found');
  }
}

export class EmailAlreadyExistsError extends DomainError {
  readonly code = 'email-already-exists';
  readonly kind = 'conflict';
  constructor() {
    super('A user with this email already exists');
  }
}

/** auth-service refused the credentials (e.g. weak password). The message is its own validation detail. */
export class CredentialsRejectedError extends DomainError {
  readonly code = 'credentials-rejected';
  readonly kind = 'validation';
}

export class AuthServiceUnavailableError extends DomainError {
  readonly code = 'auth-service-unavailable';
  readonly kind = 'unavailable';
  constructor() {
    super('Credential provisioning is temporarily unavailable');
  }
}
