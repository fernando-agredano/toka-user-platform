import { InvalidatePermissionsCacheUseCase } from '../../../src/application/use-cases/invalidate-permissions-cache.use-case';

describe('InvalidatePermissionsCacheUseCase', () => {
  const build = () => {
    const cache = { invalidateUser: jest.fn().mockResolvedValue(undefined), invalidateAll: jest.fn().mockResolvedValue(undefined) };
    return { cache, useCase: new InvalidatePermissionsCacheUseCase(cache) };
  };

  it('invalidates a single user when the event names one (role.assigned / role.revoked)', async () => {
    const { cache, useCase } = build();
    await useCase.execute({ userId: 'u1' });
    expect(cache.invalidateUser).toHaveBeenCalledWith('u1');
    expect(cache.invalidateAll).not.toHaveBeenCalled();
  });

  it('invalidates every cached user when the event has no user (role.permissions.updated)', async () => {
    const { cache, useCase } = build();
    await useCase.execute({});
    expect(cache.invalidateAll).toHaveBeenCalled();
    expect(cache.invalidateUser).not.toHaveBeenCalled();
  });
});
