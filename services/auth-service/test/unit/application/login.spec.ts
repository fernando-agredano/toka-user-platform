import { LoginUseCase } from '../../../src/application/use-cases/login.use-case';
import {
  AccountDisabledError,
  AccountLockedError,
  InvalidCredentialsError,
  PermissionsUnavailableError,
} from '../../../src/domain/errors/domain-error';
import { Credential } from '../../../src/domain/entities/credential';
import { Email } from '../../../src/domain/value-objects/email';
import {
  FakeEventPublisher,
  FakeLoginAttemptTracker,
  FakePasswordHasher,
  FakePermissionsProvider,
  FakeRefreshTokenStore,
  InMemoryCredentialRepository,
  buildSessionIssuer,
} from '../support/fakes';

const client = { ip: '10.0.0.1', userAgent: 'jest' };
const credentials = { email: 'ana@toka.mx', password: 'Str0ng!Pass', ...client };

describe('LoginUseCase', () => {
  let repository: InMemoryCredentialRepository;
  let events: FakeEventPublisher;
  let refreshTokens: FakeRefreshTokenStore;
  let permissions: FakePermissionsProvider;
  let login: LoginUseCase;
  let credential: Credential;

  beforeEach(async () => {
    repository = new InMemoryCredentialRepository();
    events = new FakeEventPublisher();
    refreshTokens = new FakeRefreshTokenStore();
    permissions = new FakePermissionsProvider({ roles: ['MANAGER'], permissions: ['users:read'] });
    login = new LoginUseCase(
      repository,
      new FakePasswordHasher(),
      new FakeLoginAttemptTracker(),
      refreshTokens,
      events,
      buildSessionIssuer(permissions),
    );
    credential = Credential.create({
      id: 'user-1',
      email: Email.create('ana@toka.mx'),
      passwordHash: 'hashed:Str0ng!Pass',
    });
    await repository.save(credential);
  });

  it('returns the session with roles/permissions and a refresh token, and emits auth.login.succeeded', async () => {
    const result = await login.execute(credentials);

    expect(result).toMatchObject({
      accessToken: 'access-for-user-1',
      expiresIn: 900,
      refreshToken: 'refresh-1',
      user: { id: 'user-1', email: 'ana@toka.mx', roles: ['MANAGER'], permissions: ['users:read'] },
    });
    expect(events.events).toEqual([
      expect.objectContaining({
        type: 'auth.login.succeeded',
        actor: { userId: 'user-1', ip: '10.0.0.1' },
        data: { userId: 'user-1', email: 'ana@toka.mx', userAgent: 'jest' },
      }),
    ]);
  });

  it('never leaks the password into emitted events', async () => {
    await login.execute(credentials);
    await expect(login.execute({ ...credentials, password: 'Wrong!Pass1' })).rejects.toThrow();
    expect(JSON.stringify(events.events)).not.toContain('Str0ng');
    expect(JSON.stringify(events.events)).not.toContain('Wrong');
  });

  it('rejects a wrong password with a generic error and emits auth.login.failed', async () => {
    await expect(login.execute({ ...credentials, password: 'Wrong!Pass1' })).rejects.toThrow(InvalidCredentialsError);
    expect(events.types()).toEqual(['auth.login.failed']);
    expect(refreshTokens.active.size).toBe(0);
  });

  it('rejects an unknown email with the same error as a wrong password', async () => {
    await expect(login.execute({ ...credentials, email: 'ghost@toka.mx' })).rejects.toThrow(
      new InvalidCredentialsError().message,
    );
    expect(events.events[0]).toMatchObject({ type: 'auth.login.failed', actor: { userId: null } });
  });

  it('locks the account on the 5th failure, emits auth.login.locked once, then refuses even the right password', async () => {
    const wrong = { ...credentials, password: 'Wrong!Pass1' };
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(login.execute(wrong)).rejects.toThrow(InvalidCredentialsError);
    }
    expect(events.types().filter((type) => type === 'auth.login.locked')).toHaveLength(1);
    expect(events.types().at(-1)).toBe('auth.login.locked');

    await expect(login.execute(credentials)).rejects.toThrow(AccountLockedError);
    expect(events.types().filter((type) => type === 'auth.login.failed')).toHaveLength(5);
  });

  it('resets the failure counter after a successful login', async () => {
    const wrong = { ...credentials, password: 'Wrong!Pass1' };
    for (let attempt = 0; attempt < 4; attempt++) await expect(login.execute(wrong)).rejects.toThrow();
    await login.execute(credentials);
    for (let attempt = 0; attempt < 4; attempt++) await expect(login.execute(wrong)).rejects.toThrow(InvalidCredentialsError);
  });

  it('refuses a disabled account only after the password is verified', async () => {
    credential.deactivate();
    await expect(login.execute(credentials)).rejects.toThrow(AccountDisabledError);
    await expect(login.execute({ ...credentials, password: 'Wrong!Pass1' })).rejects.toThrow(InvalidCredentialsError);
  });

  it('fails with 503-type error and creates no refresh token when permissions are unavailable', async () => {
    permissions.getAuthorization = async () => {
      throw new PermissionsUnavailableError();
    };
    await expect(login.execute(credentials)).rejects.toThrow(PermissionsUnavailableError);
    expect(refreshTokens.active.size).toBe(0);
    expect(events.events).toHaveLength(0);
  });
});
