import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InternalApiKeyGuard, JwtAuthGuard, PermissionsGuard, Permissions, Roles } from '../src/auth/guards';
import type { AuthenticatedUser } from '../src/auth/authenticated-user';
import type { JwtVerifier } from '../src/auth/jwt-verifier.service';

const buildContext = (request: Record<string, unknown>, handler = () => undefined, classRef = class {}) =>
  ({
    getHandler: () => handler,
    getClass: () => classRef,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const buildRequest = (headers: Record<string, string> = {}, user?: AuthenticatedUser) => ({
  header: (name: string) => headers[name.toLowerCase()],
  user,
});

const user: AuthenticatedUser = {
  userId: 'u1',
  email: 'a@toka.local',
  roles: ['USER'],
  permissions: ['ai:use'],
  jti: 'jti-1',
  exp: 9999999999,
};

describe('JwtAuthGuard', () => {
  it('rejects requests without a bearer token', async () => {
    const guard = new JwtAuthGuard({ verify: jest.fn() } as unknown as JwtVerifier);
    await expect(guard.canActivate(buildContext(buildRequest()))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects non-bearer schemes', async () => {
    const guard = new JwtAuthGuard({ verify: jest.fn() } as unknown as JwtVerifier);
    const request = buildRequest({ authorization: 'Basic abc' });
    await expect(guard.canActivate(buildContext(request))).rejects.toThrow('Missing bearer token');
  });

  it('attaches the verified user to the request on a valid token', async () => {
    const verify = jest.fn().mockResolvedValue(user);
    const guard = new JwtAuthGuard({ verify } as unknown as JwtVerifier);
    const request = buildRequest({ authorization: 'Bearer tok' });

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('tok');
    expect(request.user).toEqual(user);
  });

  it('maps verifier failures to a generic 401', async () => {
    const verify = jest.fn().mockRejectedValue(new Error('Token has been revoked'));
    const guard = new JwtAuthGuard({ verify } as unknown as JwtVerifier);
    const request = buildRequest({ authorization: 'Bearer tok' });

    await expect(guard.canActivate(buildContext(request))).rejects.toThrow('Invalid or expired token');
  });
});

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  class Controller {}

  it('allows routes without role or permission metadata', () => {
    const handler = () => undefined;
    expect(guard.canActivate(buildContext(buildRequest(), handler, Controller))).toBe(true);
  });

  it('requires an authenticated user when metadata is present', () => {
    const handler = () => undefined;
    Roles('ADMIN')(handler as never);
    expect(() => guard.canActivate(buildContext(buildRequest(), handler, Controller))).toThrow(UnauthorizedException);
  });

  it('accepts when the user holds any of the listed roles', () => {
    const handler = () => undefined;
    Roles('ADMIN', 'USER')(handler as never);
    const request = buildRequest({}, user);
    expect(guard.canActivate(buildContext(request, handler, Controller))).toBe(true);
  });

  it('rejects when none of the listed roles match', () => {
    const handler = () => undefined;
    Roles('ADMIN')(handler as never);
    expect(() => guard.canActivate(buildContext(buildRequest({}, user), handler, Controller))).toThrow(
      ForbiddenException,
    );
  });

  it('requires every listed permission', () => {
    const handler = () => undefined;
    Permissions('ai:use', 'users:read')(handler as never);
    expect(() => guard.canActivate(buildContext(buildRequest({}, user), handler, Controller))).toThrow(
      ForbiddenException,
    );
  });

  it('combines role and permission checks', () => {
    const handler = () => undefined;
    Roles('USER')(handler as never);
    Permissions('ai:use')(handler as never);
    expect(guard.canActivate(buildContext(buildRequest({}, user), handler, Controller))).toBe(true);
  });

  it('reads class-level metadata when the handler has none', () => {
    Roles('ADMIN')(Controller as never);
    const handler = () => undefined;
    expect(() => guard.canActivate(buildContext(buildRequest({}, user), handler, Controller))).toThrow(
      ForbiddenException,
    );
  });
});

describe('InternalApiKeyGuard', () => {
  const originalKey = process.env.INTERNAL_API_KEY;

  beforeEach(() => {
    process.env.INTERNAL_API_KEY = 'secret-key';
  });

  afterAll(() => {
    process.env.INTERNAL_API_KEY = originalKey;
  });

  it('accepts the matching x-internal-key header', () => {
    const guard = new InternalApiKeyGuard();
    const request = buildRequest({ 'x-internal-key': 'secret-key' });
    expect(guard.canActivate(buildContext(request))).toBe(true);
  });

  it('rejects a missing header', () => {
    const guard = new InternalApiKeyGuard();
    expect(() => guard.canActivate(buildContext(buildRequest()))).toThrow('Invalid internal key');
  });

  it('rejects a key of a different length without comparing contents', () => {
    const guard = new InternalApiKeyGuard();
    expect(() => guard.canActivate(buildContext(buildRequest({ 'x-internal-key': 'short' })))).toThrow(
      'Invalid internal key',
    );
  });

  it('rejects a key of the same length but different value', () => {
    const guard = new InternalApiKeyGuard();
    expect(() => guard.canActivate(buildContext(buildRequest({ 'x-internal-key': 'secret-kex' })))).toThrow(
      'Invalid internal key',
    );
  });
});
