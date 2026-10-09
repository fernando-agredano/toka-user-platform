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

export class InvalidPasswordError extends DomainError {
  readonly code = 'invalid-password';
  readonly kind = 'validation';
}

export class EmailAlreadyRegisteredError extends DomainError {
  readonly code = 'email-already-registered';
  readonly kind = 'conflict';
  constructor() {
    super('Email is already registered');
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = 'invalid-credentials';
  readonly kind = 'unauthorized';
  constructor() {
    super('Invalid email or password');
  }
}

export class AccountLockedError extends DomainError {
  readonly code = 'account-locked';
  readonly kind = 'too_many_requests';
  constructor() {
    super('Too many failed login attempts. Try again later');
  }
}

export class AccountDisabledError extends DomainError {
  readonly code = 'account-disabled';
  readonly kind = 'forbidden';
  constructor() {
    super('Account is disabled');
  }
}

export class InvalidRefreshTokenError extends DomainError {
  readonly code = 'invalid-refresh-token';
  readonly kind = 'unauthorized';
  constructor() {
    super('Refresh token is invalid or expired');
  }
}

export class PermissionsUnavailableError extends DomainError {
  readonly code = 'permissions-unavailable';
  readonly kind = 'unavailable';
  constructor() {
    super('Authorization data is temporarily unavailable');
  }
}
