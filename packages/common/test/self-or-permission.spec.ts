import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser, assertSelfOrPermission } from '../src';

const user = (overrides: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  userId: 'u1',
  email: 'a@b.co',
  roles: [],
  permissions: [],
  jti: 'j',
  exp: 0,
  ...overrides,
});

describe('assertSelfOrPermission', () => {
  it('allows the owner without any permission', () => {
    expect(() => assertSelfOrPermission(user({}), 'u1', 'users:read')).not.toThrow();
  });

  it('allows another user holding the permission', () => {
    expect(() => assertSelfOrPermission(user({ permissions: ['users:read'] }), 'u2', 'users:read')).not.toThrow();
  });

  it('rejects another user without the permission', () => {
    expect(() => assertSelfOrPermission(user({}), 'u2', 'users:read')).toThrow(ForbiddenException);
  });
});
