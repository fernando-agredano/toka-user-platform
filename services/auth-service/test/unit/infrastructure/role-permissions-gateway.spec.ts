import { PermissionsUnavailableError } from '../../../src/domain/errors/domain-error';
import { RolePermissionsGateway } from '../../../src/infrastructure/http/role-permissions-gateway';

class FakeRedis {
  readonly store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.store.set(key, value);
    return 'OK' as const;
  }
}

describe('RolePermissionsGateway', () => {
  const authorization = { roles: ['ADMIN'], permissions: ['users:read'] };

  it('returns role-service data and caches it', async () => {
    const redis = new FakeRedis();
    const http = { get: jest.fn().mockResolvedValue({ ...authorization, extra: 'ignored' }) };
    const gateway = new RolePermissionsGateway(http as never, redis as never);

    await expect(gateway.getAuthorization('u1')).resolves.toEqual(authorization);
    expect(http.get).toHaveBeenCalledWith('/api/roles/internal/users/u1/permissions');
    expect(JSON.parse(redis.store.get('auth:permissions:u1')!)).toEqual(authorization);
  });

  it('falls back to the cached permissions when role-service fails', async () => {
    const redis = new FakeRedis();
    const http = { get: jest.fn().mockResolvedValueOnce(authorization).mockRejectedValueOnce(new Error('EOPENBREAKER')) };
    const gateway = new RolePermissionsGateway(http as never, redis as never);

    await gateway.getAuthorization('u1');
    await expect(gateway.getAuthorization('u1')).resolves.toEqual(authorization);
  });

  it('throws PermissionsUnavailableError (503) when role-service fails and nothing is cached', async () => {
    const http = { get: jest.fn().mockRejectedValue(new Error('timeout')) };
    const gateway = new RolePermissionsGateway(http as never, new FakeRedis() as never);

    await expect(gateway.getAuthorization('u1')).rejects.toThrow(PermissionsUnavailableError);
  });
});
