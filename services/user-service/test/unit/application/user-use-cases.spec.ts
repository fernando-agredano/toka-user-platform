import { ChangeUserStatusUseCase } from '../../../src/application/use-cases/change-user-status.use-case';
import { CreateUserUseCase } from '../../../src/application/use-cases/create-user.use-case';
import { GetUserUseCase } from '../../../src/application/use-cases/get-user.use-case';
import { ListUsersUseCase } from '../../../src/application/use-cases/list-users.use-case';
import { RegisterProfileUseCase } from '../../../src/application/use-cases/register-profile.use-case';
import { ADMIN_USER_ID, SeedAdminUseCase } from '../../../src/application/use-cases/seed-admin.use-case';
import { UpdateUserUseCase } from '../../../src/application/use-cases/update-user.use-case';
import {
  AuthServiceUnavailableError,
  EmailAlreadyExistsError,
  InvalidNameError,
  UserNotFoundError,
} from '../../../src/domain/errors/domain-error';
import { buildUser, FakeCredentialGateway, InMemoryUserCache, InMemoryUserRepository } from '../support/fakes';

const actorId = '99999999-9999-4999-8999-999999999999';
const newUser = { email: 'Luis@Toka.mx', password: 'Str0ng!Pass', firstName: ' Luis ', lastName: 'Gómez', actorId };

describe('CreateUserUseCase', () => {
  let users: InMemoryUserRepository;
  let credentials: FakeCredentialGateway;
  let create: CreateUserUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    credentials = new FakeCredentialGateway();
    create = new CreateUserUseCase(users, credentials);
  });

  it('provisions credentials with the new user id, saves the profile and emits user.created with the actor', async () => {
    const view = await create.execute(newUser);

    expect(credentials.created).toEqual([
      { userId: view.id, email: 'luis@toka.mx', password: 'Str0ng!Pass', firstName: 'Luis', lastName: 'Gómez' },
    ]);
    expect(users.items.get(view.id)?.status).toBe('ACTIVE');
    expect(users.savedEvents).toEqual([
      expect.objectContaining({ type: 'user.created', actor: { userId: actorId }, data: expect.objectContaining({ userId: view.id }) }),
    ]);
  });

  it('fails fast on a duplicate email without touching auth-service', async () => {
    users.items.set('x', buildUser({ id: 'x', email: 'luis@toka.mx' }));
    await expect(create.execute(newUser)).rejects.toThrow(EmailAlreadyExistsError);
    expect(credentials.created).toHaveLength(0);
  });

  it('validates names before provisioning credentials', async () => {
    await expect(create.execute({ ...newUser, firstName: '  ' })).rejects.toThrow(InvalidNameError);
    expect(credentials.created).toHaveLength(0);
  });

  it('does not save anything when auth-service fails', async () => {
    credentials.failWith = new AuthServiceUnavailableError();
    await expect(create.execute(newUser)).rejects.toThrow(AuthServiceUnavailableError);
    expect(users.items.size).toBe(0);
  });

  it('keeps the profile created concurrently by the auth.user.registered consumer and emits no duplicate event', async () => {
    credentials.onCreated = (credential) =>
      new RegisterProfileUseCase(users).execute({ ...credential });

    const view = await create.execute(newUser);

    expect(users.items.size).toBe(1);
    expect(users.eventTypes()).toEqual(['user.created']);
    expect(view.id).toBe(credentials.created[0].userId);
  });
});

describe('RegisterProfileUseCase', () => {
  it('creates an ACTIVE profile attributed to the registering user and is idempotent', async () => {
    const users = new InMemoryUserRepository();
    const register = new RegisterProfileUseCase(users);
    const input = { userId: 'u1', email: 'ana@toka.mx', firstName: 'Ana', lastName: 'López' };

    await register.execute(input);
    await register.execute({ ...input, firstName: 'Changed' });

    expect(users.items.size).toBe(1);
    expect(users.items.get('u1')?.firstName.value).toBe('Ana');
    expect(users.savedEvents).toEqual([expect.objectContaining({ type: 'user.created', actor: { userId: 'u1' } })]);
  });
});

describe('GetUserUseCase', () => {
  it('reads through the cache: first from the repository, then from the cache', async () => {
    const users = new InMemoryUserRepository();
    const cache = new InMemoryUserCache();
    const user = buildUser();
    users.items.set(user.id, user);
    const get = new GetUserUseCase(users, cache);
    const findById = jest.spyOn(users, 'findById');

    const first = await get.execute(user.id);
    const second = await get.execute(user.id);

    expect(second).toEqual(first);
    expect(findById).toHaveBeenCalledTimes(1);
    expect(cache.entries.has(user.id)).toBe(true);
  });

  it('throws UserNotFoundError and caches nothing for an unknown id', async () => {
    const cache = new InMemoryUserCache();
    await expect(new GetUserUseCase(new InMemoryUserRepository(), cache).execute('nope')).rejects.toThrow(UserNotFoundError);
    expect(cache.entries.size).toBe(0);
  });
});

describe('ListUsersUseCase', () => {
  it('returns the paginated envelope with filters applied', async () => {
    const users = new InMemoryUserRepository();
    users.items.set('1', buildUser({ id: '1', email: 'ana@toka.mx' }));
    users.items.set('2', buildUser({ id: '2', email: 'beto@toka.mx', firstName: 'Beto' }));
    const inactive = buildUser({ id: '3', email: 'carla@toka.mx', firstName: 'Carla' });
    inactive.deactivate();
    users.items.set('3', inactive);
    const list = new ListUsersUseCase(users);

    const page = await list.execute({ page: 1, limit: 1, search: 'TOKA' });
    expect(page).toMatchObject({ page: 1, limit: 1, total: 3 });
    expect(page.items).toHaveLength(1);

    const onlyInactive = await list.execute({ page: 1, limit: 10, status: 'INACTIVE' });
    expect(onlyInactive.items.map((user) => user.email)).toEqual(['carla@toka.mx']);
  });
});

describe('UpdateUserUseCase', () => {
  let users: InMemoryUserRepository;
  let cache: InMemoryUserCache;
  let update: UpdateUserUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    cache = new InMemoryUserCache();
    update = new UpdateUserUseCase(users, cache);
    users.items.set(buildUser().id, buildUser());
  });

  it('updates the names, emits user.updated and invalidates the cache', async () => {
    const id = buildUser().id;
    await cache.set({ id } as never);

    const view = await update.execute({ userId: id, firstName: ' Anita ', actorId });

    expect(view.firstName).toBe('Anita');
    expect(users.savedEvents).toEqual([expect.objectContaining({ type: 'user.updated', actor: { userId: actorId } })]);
    expect(cache.entries.has(id)).toBe(false);
  });

  it('does nothing when the values are unchanged', async () => {
    await update.execute({ userId: buildUser().id, firstName: 'Ana', actorId });
    expect(users.savedEvents).toHaveLength(0);
  });

  it('rejects an unknown user and an empty name', async () => {
    await expect(update.execute({ userId: 'nope', actorId })).rejects.toThrow(UserNotFoundError);
    await expect(update.execute({ userId: buildUser().id, lastName: '', actorId })).rejects.toThrow(InvalidNameError);
  });
});

describe('ChangeUserStatusUseCase', () => {
  let users: InMemoryUserRepository;
  let cache: InMemoryUserCache;
  let change: ChangeUserStatusUseCase;
  const id = buildUser().id;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    cache = new InMemoryUserCache();
    change = new ChangeUserStatusUseCase(users, cache);
    users.items.set(id, buildUser());
  });

  it('deactivates then activates, emitting one event per real transition and invalidating the cache', async () => {
    await cache.set({ id } as never);

    expect((await change.execute({ userId: id, active: false, actorId })).status).toBe('INACTIVE');
    expect(cache.entries.has(id)).toBe(false);
    expect((await change.execute({ userId: id, active: true, actorId })).status).toBe('ACTIVE');

    expect(users.eventTypes()).toEqual(['user.deactivated', 'user.activated']);
    expect(users.savedEvents[0]).toMatchObject({ data: { userId: id }, actor: { userId: actorId } });
  });

  it('is idempotent: repeating a transition emits nothing', async () => {
    await change.execute({ userId: id, active: false, actorId });
    await change.execute({ userId: id, active: false, actorId });
    await change.execute({ userId: id, active: true, actorId });
    await change.execute({ userId: id, active: true, actorId });
    expect(users.eventTypes()).toEqual(['user.deactivated', 'user.activated']);
  });

  it('rejects an unknown user', async () => {
    await expect(change.execute({ userId: 'nope', active: false, actorId })).rejects.toThrow(UserNotFoundError);
  });
});

describe('SeedAdminUseCase', () => {
  it('creates the admin profile with the fixed id once, without events', async () => {
    const users = new InMemoryUserRepository();
    const seed = new SeedAdminUseCase(users);

    expect(await seed.execute({ email: 'admin@toka.local' })).toBe(true);
    expect(await seed.execute({ email: 'admin@toka.local' })).toBe(false);

    expect(users.items.get(ADMIN_USER_ID)?.email.value).toBe('admin@toka.local');
    expect(users.savedEvents).toHaveLength(0);
  });
});
