import { ChangeCredentialStatusUseCase } from '../../../src/application/use-cases/change-credential-status.use-case';
import { LogoutUseCase } from '../../../src/application/use-cases/logout.use-case';
import { RefreshUseCase } from '../../../src/application/use-cases/refresh.use-case';
import { ADMIN_USER_ID, SeedAdminUseCase } from '../../../src/application/use-cases/seed-admin.use-case';
import { Credential } from '../../../src/domain/entities/credential';
import { InvalidRefreshTokenError } from '../../../src/domain/errors/domain-error';
import { Email } from '../../../src/domain/value-objects/email';
import {
  FakePasswordHasher,
  FakeRefreshTokenStore,
  FakeTokenBlacklist,
  InMemoryCredentialRepository,
  buildSessionIssuer,
} from '../support/fakes';

const buildCredential = () =>
  Credential.create({ id: 'user-1', email: Email.create('ana@toka.mx'), passwordHash: 'hash' });

describe('RefreshUseCase', () => {
  let repository: InMemoryCredentialRepository;
  let refreshTokens: FakeRefreshTokenStore;
  let refresh: RefreshUseCase;

  beforeEach(async () => {
    repository = new InMemoryCredentialRepository();
    refreshTokens = new FakeRefreshTokenStore();
    refresh = new RefreshUseCase(repository, refreshTokens, buildSessionIssuer());
    await repository.save(buildCredential());
  });

  it('rotates the token: returns a new access + refresh token and invalidates the old one', async () => {
    const { token } = await refreshTokens.issue('user-1');

    const result = await refresh.execute({ refreshToken: token });

    expect(result).toMatchObject({ accessToken: 'access-for-user-1', user: { id: 'user-1' } });
    expect(result.refreshToken).not.toBe(token);
    await expect(refresh.execute({ refreshToken: token })).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('rejects unknown tokens', async () => {
    await expect(refresh.execute({ refreshToken: 'garbage' })).rejects.toThrow(InvalidRefreshTokenError);
  });

  it('revokes every session when the credential was deactivated', async () => {
    const first = await refreshTokens.issue('user-1');
    const second = await refreshTokens.issue('user-1');
    repository.items.get('user-1')!.deactivate();

    await expect(refresh.execute({ refreshToken: first.token })).rejects.toThrow(InvalidRefreshTokenError);
    expect(refreshTokens.active.has(second.token)).toBe(false);
  });
});

describe('LogoutUseCase', () => {
  it('blacklists the access token id until its expiration and revokes the refresh token', async () => {
    const blacklist = new FakeTokenBlacklist();
    const refreshTokens = new FakeRefreshTokenStore();
    const { token } = await refreshTokens.issue('user-1');

    await new LogoutUseCase(blacklist, refreshTokens).execute({ jti: 'jti-1', exp: 1_900_000_000, refreshToken: token });

    expect(blacklist.entries.get('jti-1')).toBe(1_900_000_000);
    expect(refreshTokens.active.has(token)).toBe(false);
  });

  it('works without a refresh cookie', async () => {
    const blacklist = new FakeTokenBlacklist();
    await new LogoutUseCase(blacklist, new FakeRefreshTokenStore()).execute({ jti: 'jti-2', exp: 1 });
    expect(blacklist.entries.has('jti-2')).toBe(true);
  });
});

describe('ChangeCredentialStatusUseCase', () => {
  let repository: InMemoryCredentialRepository;
  let refreshTokens: FakeRefreshTokenStore;
  let changeStatus: ChangeCredentialStatusUseCase;

  beforeEach(async () => {
    repository = new InMemoryCredentialRepository();
    refreshTokens = new FakeRefreshTokenStore();
    changeStatus = new ChangeCredentialStatusUseCase(repository, refreshTokens);
    await repository.save(buildCredential());
  });

  it('on deactivation, revokes all refresh tokens and disables the credential', async () => {
    const { token } = await refreshTokens.issue('user-1');
    await changeStatus.execute({ userId: 'user-1', active: false });
    expect(refreshTokens.active.has(token)).toBe(false);
    expect(repository.items.get('user-1')!.isActive).toBe(false);
  });

  it('on activation, re-enables the credential', async () => {
    await changeStatus.execute({ userId: 'user-1', active: false });
    await changeStatus.execute({ userId: 'user-1', active: true });
    expect(repository.items.get('user-1')!.isActive).toBe(true);
  });

  it('ignores unknown users (redelivered or out-of-order events)', async () => {
    await expect(changeStatus.execute({ userId: 'ghost', active: false })).resolves.toBeUndefined();
  });
});

describe('SeedAdminUseCase', () => {
  it('creates the admin with the fixed UUID once and emits no events', async () => {
    const repository = new InMemoryCredentialRepository();
    const seed = new SeedAdminUseCase(repository, new FakePasswordHasher());
    const input = { email: 'admin@toka.local', password: 'Admin123!' };

    await expect(seed.execute(input)).resolves.toBe(true);
    await expect(seed.execute(input)).resolves.toBe(false);

    expect(repository.items.get(ADMIN_USER_ID)!.email.value).toBe('admin@toka.local');
    expect(repository.items.size).toBe(1);
    expect(repository.savedEvents).toHaveLength(0);
  });
});
