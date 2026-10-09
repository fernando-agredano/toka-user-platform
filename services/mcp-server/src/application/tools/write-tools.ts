import { z } from 'zod';
import { resolveRole } from '../services/role-resolver';
import type { RolesGateway, UsersGateway } from '../ports/gateways.port';
import { DESTRUCTIVE, WRITE, type ToolDefinition, confirmationPreview, defineTool } from './tool-definition';
import { toUserSummary } from './read-tools';

const userId = z.string().uuid().describe('Id of the user (from search_users).');
const role = z.string().min(1).max(100).describe('Role name (for example MANAGER) or role id (from list_roles).');
const confirm = z
  .boolean()
  .optional()
  .describe('Must be true to execute. Without it the tool only returns a preview and changes nothing.');

export interface WriteToolDependencies {
  users: UsersGateway;
  roles: RolesGateway;
}

export function createWriteTools({ users, roles }: WriteToolDependencies): ToolDefinition[] {
  return [
    defineTool({
      name: 'assign_role',
      title: 'Assign role',
      description:
        'Grants a role to a user, which widens what that user can do. Requires roles:write and roles:read. The role-service rejects invalid or duplicate assignments.',
      inputSchema: { userId, role },
      annotations: WRITE,
      permissions: ['roles:write', 'roles:read'],
      async execute(args, caller) {
        const target = await resolveRole(roles, args.role, caller.authorization);
        await roles.assign(args.userId, target.id, caller.authorization);
        return { data: { assigned: true, userId: args.userId, role: target.name, grantedPermissions: target.permissions } };
      },
    }),
    defineTool({
      name: 'revoke_role',
      title: 'Revoke role',
      description:
        'DESTRUCTIVE. Removes a role from a user, which can lock them out of features. Requires confirm: true; without it returns a preview and changes nothing. The last ADMIN cannot be removed. Requires roles:write and roles:read.',
      inputSchema: { userId, role, confirm },
      annotations: DESTRUCTIVE,
      permissions: ['roles:write', 'roles:read'],
      async execute(args, caller) {
        const target = await resolveRole(roles, args.role, caller.authorization);
        if (args.confirm !== true) {
          const current = await roles.rolesOfUser(args.userId, caller.authorization);
          const holdsRole = current.some((assigned) => assigned.id === target.id);
          return confirmationPreview({
            action: 'revoke_role',
            userId: args.userId,
            role: target.name,
            userCurrentlyHasRole: holdsRole,
            currentRoles: current.map((assigned) => assigned.name),
            wouldRevokePermissions: target.permissions,
          });
        }
        await roles.revoke(args.userId, target.id, caller.authorization);
        return { data: { revoked: true, userId: args.userId, role: target.name } };
      },
    }),
    defineTool({
      name: 'activate_user',
      title: 'Activate user',
      description: 'Re-enables a deactivated user so they can sign in again. Requires users:write.',
      inputSchema: { userId },
      annotations: WRITE,
      permissions: ['users:write'],
      async execute({ userId: id }, caller) {
        const user = await users.setActive(id, true, caller.authorization);
        return { data: { activated: true, user: toUserSummary(user) } };
      },
    }),
    defineTool({
      name: 'deactivate_user',
      title: 'Deactivate user',
      description:
        'DESTRUCTIVE. Deactivates a user: they can no longer sign in and their sessions are revoked. Requires confirm: true; without it returns a preview and changes nothing. Requires users:write.',
      inputSchema: { userId, confirm },
      annotations: DESTRUCTIVE,
      permissions: ['users:write'],
      async execute({ userId: id, confirm: confirmed }, caller) {
        if (confirmed !== true) {
          const user = await users.get(id, caller.authorization);
          return confirmationPreview({
            action: 'deactivate_user',
            user: toUserSummary(user),
            effect:
              user.status === 'INACTIVE'
                ? 'The user is already INACTIVE; nothing would change.'
                : 'The user would become INACTIVE, could not sign in and all their refresh tokens would be revoked.',
          });
        }
        const user = await users.setActive(id, false, caller.authorization);
        return { data: { deactivated: true, user: toUserSummary(user) } };
      },
    }),
  ];
}
