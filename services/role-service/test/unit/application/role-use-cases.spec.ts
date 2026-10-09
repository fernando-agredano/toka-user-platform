import { AssignDefaultRoleUseCase } from '../../../src/application/use-cases/assign-default-role.use-case';
import { AssignRoleUseCase } from '../../../src/application/use-cases/assign-role.use-case';
import { CreateRoleUseCase } from '../../../src/application/use-cases/create-role.use-case';
import { GetUserAuthorizationUseCase } from '../../../src/application/use-cases/get-user-authorization.use-case';
import { GetUserRolesUseCase } from '../../../src/application/use-cases/get-user-roles.use-case';
import { ListRolesUseCase } from '../../../src/application/use-cases/list-roles.use-case';
import { RevokeRoleUseCase } from '../../../src/application/use-cases/revoke-role.use-case';
import { ADMIN_USER_ID, SeedRolesUseCase } from '../../../src/application/use-cases/seed-roles.use-case';
import { UpdateRolePermissionsUseCase } from '../../../src/application/use-cases/update-role-permissions.use-case';
import {
  InvalidPermissionError,
  LastAdminError,
  ProtectedRoleError,
  RoleAlreadyExistsError,
  RoleAssignmentNotFoundError,
  RoleNotFoundError,
} from '../../../src/domain/errors/domain-error';
import { RoleName } from '../../../src/domain/value-objects/role-name';
import { buildRole, InMemoryPermissionsCache, InMemoryRoleRepository } from '../support/fakes';

const actorId = '99999999-9999-4999-8999-999999999999';
const userId = '11111111-1111-4111-8111-111111111111';

let roles: InMemoryRoleRepository;
let cache: InMemoryPermissionsCache;

beforeEach(() => {
  roles = new InMemoryRoleRepository();
  cache = new InMemoryPermissionsCache();
});

describe('CreateRoleUseCase', () => {
  it('creates a role with normalized name and permissions and emits role.created with the actor', async () => {
    const view = await new CreateRoleUseCase(roles).execute({
      name: 'auditor',
      description: 'Reads audit',
      permissions: ['audit:read', 'audit:read'],
      actorId,
    });

    expect(view).toMatchObject({ name: 'AUDITOR', permissions: ['audit:read'] });
    expect(roles.savedEvents).toEqual([
      expect.objectContaining({ type: 'role.created', actor: { userId: actorId }, data: expect.objectContaining({ name: 'AUDITOR' }) }),
    ]);
  });

  it('rejects duplicates and unknown permissions without saving', async () => {
    const create = new CreateRoleUseCase(roles);
    await create.execute({ name: 'AUDITOR', description: '', permissions: [], actorId });

    await expect(create.execute({ name: 'auditor', description: '', permissions: [], actorId })).rejects.toThrow(RoleAlreadyExistsError);
    await expect(create.execute({ name: 'OTHER', description: '', permissions: ['x:y'], actorId })).rejects.toThrow(InvalidPermissionError);
    expect(roles.roles.size).toBe(1);
  });
});

describe('UpdateRolePermissionsUseCase', () => {
  it('replaces permissions, emits the event and invalidates the cache of every holder', async () => {
    const editor = buildRole('EDITOR', ['users:read']);
    roles.roles.set(editor.id, editor);
    roles.holders.set(editor.id, new Set(['u1', 'u2']));
    await cache.set('u1', { roles: [], permissions: [] });
    await cache.set('u2', { roles: [], permissions: [] });
    await cache.set('other', { roles: [], permissions: [] });

    const view = await new UpdateRolePermissionsUseCase(roles, cache).execute({
      roleId: editor.id,
      permissions: ['users:read', 'users:write'],
      actorId,
    });

    expect(view.permissions).toEqual(['users:read', 'users:write']);
    expect(roles.eventTypes()).toEqual(['role.permissions.updated']);
    expect([...cache.entries.keys()]).toEqual(['other']);
  });

  it('does nothing when permissions are unchanged', async () => {
    const editor = buildRole('EDITOR', ['users:read']);
    roles.roles.set(editor.id, editor);
    await new UpdateRolePermissionsUseCase(roles, cache).execute({ roleId: editor.id, permissions: ['users:read'], actorId });
    expect(roles.savedEvents).toHaveLength(0);
  });

  it('rejects unknown roles and protects ADMIN', async () => {
    const admin = buildRole('ADMIN', ['users:read']);
    roles.roles.set(admin.id, admin);
    const update = new UpdateRolePermissionsUseCase(roles, cache);

    await expect(update.execute({ roleId: 'missing', permissions: [], actorId })).rejects.toThrow(RoleNotFoundError);
    await expect(update.execute({ roleId: admin.id, permissions: [], actorId })).rejects.toThrow(ProtectedRoleError);
  });
});

describe('AssignRoleUseCase', () => {
  it('assigns the role, emits role.assigned and invalidates the user cache', async () => {
    const manager = buildRole('MANAGER', ['users:read']);
    roles.roles.set(manager.id, manager);
    await cache.set(userId, { roles: [], permissions: [] });

    await new AssignRoleUseCase(roles, cache).execute({ userId, roleId: manager.id, actorId });

    expect(await roles.findByUser(userId)).toHaveLength(1);
    expect(roles.savedEvents).toEqual([
      expect.objectContaining({ type: 'role.assigned', data: { userId, roleId: manager.id, roleName: 'MANAGER' } }),
    ]);
    expect(cache.entries.size).toBe(0);
  });

  it('is idempotent and rejects unknown roles', async () => {
    const manager = buildRole('MANAGER');
    roles.roles.set(manager.id, manager);
    const assign = new AssignRoleUseCase(roles, cache);

    await assign.execute({ userId, roleId: manager.id, actorId });
    await assign.execute({ userId, roleId: manager.id, actorId });
    await expect(assign.execute({ userId, roleId: 'missing', actorId })).rejects.toThrow(RoleNotFoundError);

    expect(roles.eventTypes()).toEqual(['role.assigned']);
  });
});

describe('AssignDefaultRoleUseCase', () => {
  it('assigns USER on behalf of the system (no actor)', async () => {
    const user = buildRole('USER', ['ai:use']);
    roles.roles.set(user.id, user);

    await new AssignDefaultRoleUseCase(roles, new AssignRoleUseCase(roles, cache)).execute(userId);

    expect(roles.savedEvents).toEqual([expect.objectContaining({ type: 'role.assigned', actor: { userId: null } })]);
  });

  it('throws when the USER role is missing, so the consumer retries instead of dropping the event', async () => {
    await expect(new AssignDefaultRoleUseCase(roles, new AssignRoleUseCase(roles, cache)).execute(userId)).rejects.toThrow(
      RoleNotFoundError,
    );
  });
});

describe('RevokeRoleUseCase', () => {
  it('revokes the role, emits role.revoked and invalidates the cache', async () => {
    const manager = buildRole('MANAGER');
    roles.roles.set(manager.id, manager);
    roles.holders.set(manager.id, new Set([userId]));
    await cache.set(userId, { roles: [], permissions: [] });

    await new RevokeRoleUseCase(roles, cache).execute({ userId, roleId: manager.id, actorId });

    expect(await roles.findByUser(userId)).toHaveLength(0);
    expect(roles.eventTypes()).toEqual(['role.revoked']);
    expect(cache.entries.size).toBe(0);
  });

  it('rejects unknown roles and roles the user does not hold', async () => {
    const manager = buildRole('MANAGER');
    roles.roles.set(manager.id, manager);
    const revoke = new RevokeRoleUseCase(roles, cache);

    await expect(revoke.execute({ userId, roleId: 'missing', actorId })).rejects.toThrow(RoleNotFoundError);
    await expect(revoke.execute({ userId, roleId: manager.id, actorId })).rejects.toThrow(RoleAssignmentNotFoundError);
  });

  it('refuses to remove the last ADMIN but allows it once another admin exists', async () => {
    const admin = buildRole('ADMIN', ['users:read']);
    roles.roles.set(admin.id, admin);
    roles.holders.set(admin.id, new Set([userId]));
    const revoke = new RevokeRoleUseCase(roles, cache);

    await expect(revoke.execute({ userId, roleId: admin.id, actorId })).rejects.toThrow(LastAdminError);
    expect(roles.savedEvents).toHaveLength(0);

    roles.holders.get(admin.id)!.add('second-admin');
    await revoke.execute({ userId, roleId: admin.id, actorId });
    expect([...roles.holders.get(admin.id)!]).toEqual(['second-admin']);
  });
});

describe('GetUserAuthorizationUseCase', () => {
  it('returns role names and the sorted union of permissions, then serves from cache', async () => {
    const manager = buildRole('MANAGER', ['users:read', 'ai:use']);
    const user = buildRole('USER', ['ai:use']);
    for (const role of [manager, user]) {
      roles.roles.set(role.id, role);
      roles.holders.set(role.id, new Set([userId]));
    }
    const get = new GetUserAuthorizationUseCase(roles, cache);
    const findByUser = jest.spyOn(roles, 'findByUser');

    const expected = { roles: ['MANAGER', 'USER'], permissions: ['ai:use', 'users:read'] };
    expect(await get.execute(userId)).toEqual(expected);
    expect(await get.execute(userId)).toEqual(expected);
    expect(findByUser).toHaveBeenCalledTimes(1);
  });

  it('returns empty lists without caching them for a user with no assignments yet', async () => {
    const get = new GetUserAuthorizationUseCase(roles, cache);
    expect(await get.execute(userId)).toEqual({ roles: [], permissions: [] });
    expect(cache.entries.size).toBe(0);
  });
});

describe('ListRolesUseCase and GetUserRolesUseCase', () => {
  it('map roles to views', async () => {
    const manager = buildRole('MANAGER', ['users:read']);
    roles.roles.set(manager.id, manager);
    roles.holders.set(manager.id, new Set([userId]));

    expect(await new ListRolesUseCase(roles).execute()).toEqual([expect.objectContaining({ name: 'MANAGER' })]);
    expect(await new GetUserRolesUseCase(roles).execute(userId)).toEqual([expect.objectContaining({ id: manager.id })]);
    expect(await new GetUserRolesUseCase(roles).execute('nobody')).toEqual([]);
  });
});

describe('SeedRolesUseCase', () => {
  it('creates ADMIN (all permissions), MANAGER and USER and makes the seed admin an ADMIN, without events', async () => {
    await new SeedRolesUseCase(roles).execute();

    const byName = async (name: string) => roles.findByName(RoleName.create(name));
    expect((await byName('ADMIN'))?.permissions).toHaveLength(6);
    expect((await byName('MANAGER'))?.permissions).toEqual(['ai:use', 'audit:read', 'roles:read', 'users:read', 'users:write']);
    expect((await byName('USER'))?.permissions).toEqual(['ai:use']);
    expect((await roles.findByUser(ADMIN_USER_ID)).map((role) => role.name.value)).toEqual(['ADMIN']);
    expect(roles.savedEvents).toHaveLength(0);
  });

  it('is idempotent and never overwrites roles edited since the first boot', async () => {
    const seed = new SeedRolesUseCase(roles);
    await seed.execute();
    const manager = (await roles.findByName(RoleName.create('MANAGER')))!;
    manager.replacePermissions(['ai:use']);

    await seed.execute();

    expect(roles.roles.size).toBe(3);
    expect((await roles.findByName(RoleName.create('MANAGER')))?.permissions).toEqual(['ai:use']);
    expect(roles.holders.get((await roles.findByName(RoleName.create('ADMIN')))!.id)?.size).toBe(1);
  });

  it('tolerates losing the creation race against another replica', async () => {
    jest.spyOn(roles, 'save').mockImplementationOnce(async () => {
      throw new RoleAlreadyExistsError();
    });
    await expect(new SeedRolesUseCase(roles).execute()).resolves.toBeUndefined();
  });
});
