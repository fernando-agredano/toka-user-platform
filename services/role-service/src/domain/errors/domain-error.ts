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

export class InvalidRoleNameError extends DomainError {
  readonly code = 'invalid-role-name';
  readonly kind = 'validation';
  constructor() {
    super('Role name must be 2-50 characters: letters, digits or underscores, starting with a letter');
  }
}

export class InvalidPermissionError extends DomainError {
  readonly code = 'invalid-permission';
  readonly kind = 'validation';
  constructor(permission: string) {
    super(`Unknown permission: ${permission}`);
  }
}

export class RoleNotFoundError extends DomainError {
  readonly code = 'role-not-found';
  readonly kind = 'not_found';
  constructor() {
    super('Role not found');
  }
}

export class RoleAlreadyExistsError extends DomainError {
  readonly code = 'role-already-exists';
  readonly kind = 'conflict';
  constructor() {
    super('A role with this name already exists');
  }
}

export class RoleAssignmentNotFoundError extends DomainError {
  readonly code = 'role-assignment-not-found';
  readonly kind = 'not_found';
  constructor() {
    super('The user does not hold this role');
  }
}

export class ProtectedRoleError extends DomainError {
  readonly code = 'protected-role';
  readonly kind = 'forbidden';
  constructor() {
    super('The ADMIN role permissions cannot be modified');
  }
}

export class LastAdminError extends DomainError {
  readonly code = 'last-admin';
  readonly kind = 'conflict';
  constructor() {
    super('The last ADMIN cannot be removed');
  }
}
