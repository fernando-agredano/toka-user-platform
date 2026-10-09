import {
  InvalidPermissionError,
  InvalidRoleNameError,
  LastAdminError,
  ProtectedRoleError,
} from '../../../src/domain/errors/domain-error';
import { PERMISSION_CATALOG, parsePermissions } from '../../../src/domain/value-objects/permission';
import { RoleName } from '../../../src/domain/value-objects/role-name';
import { buildRole } from '../support/fakes';

describe('RoleName', () => {
  it('trims and uppercases', () => {
    expect(RoleName.create('  auditor_1 ').value).toBe('AUDITOR_1');
  });

  it.each(['', 'A', '1ADMIN', 'with space', 'x'.repeat(51), 'ñandú'])('rejects %p', (raw) => {
    expect(() => RoleName.create(raw)).toThrow(InvalidRoleNameError);
  });
});

describe('parsePermissions', () => {
  it('deduplicates and sorts', () => {
    expect(parsePermissions(['users:write', 'ai:use', 'users:write'])).toEqual(['ai:use', 'users:write']);
  });

  it('rejects permissions outside the catalog', () => {
    expect(() => parsePermissions(['users:read', 'users:delete'])).toThrow(InvalidPermissionError);
  });
});

describe('Role', () => {
  it('normalizes permissions and description on creation', () => {
    const role = buildRole('editor', ['users:write', 'users:read', 'users:read'], '  Edits users ');
    expect(role.name.value).toBe('EDITOR');
    expect(role.permissions).toEqual(['users:read', 'users:write']);
    expect(role.description).toBe('Edits users');
  });

  it('replaces permissions, reporting whether they changed', () => {
    const role = buildRole('EDITOR', ['users:read']);
    expect(role.replacePermissions(['users:read'])).toBe(false);
    expect(role.replacePermissions(['roles:read', 'users:read'])).toBe(true);
    expect(role.permissions).toEqual(['roles:read', 'users:read']);
    expect(() => role.replacePermissions(['bogus'])).toThrow(InvalidPermissionError);
    expect(role.permissions).toEqual(['roles:read', 'users:read']);
  });

  it('protects ADMIN permissions from modification', () => {
    const admin = buildRole('ADMIN', [...PERMISSION_CATALOG]);
    expect(admin.isAdmin).toBe(true);
    expect(() => admin.replacePermissions([])).toThrow(ProtectedRoleError);
  });

  it('refuses to revoke ADMIN from its last holder but allows it with more holders', () => {
    const admin = buildRole('ADMIN', [...PERMISSION_CATALOG]);
    expect(() => admin.assertRevocable(1)).toThrow(LastAdminError);
    expect(() => admin.assertRevocable(0)).toThrow(LastAdminError);
    expect(() => admin.assertRevocable(2)).not.toThrow();
  });

  it('allows revoking any other role from its last holder', () => {
    expect(() => buildRole('USER', ['ai:use']).assertRevocable(1)).not.toThrow();
  });
});
