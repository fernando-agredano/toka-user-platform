import { hasPermission } from '../dtos/session-user';
import { type RolesGateway, ToolGatewayError } from '../ports/service-gateways.port';
import type { AgentTool } from './agent-tool';

export function createGetUserRolesTool(roles: RolesGateway): AgentTool {
  return {
    declaration: {
      name: 'get_user_roles',
      description:
        'Obtiene los roles y permisos efectivos de un usuario. Si se omite userId, devuelve los del usuario actual. Para consultar a otra persona necesitas su id (obténlo con search_users).',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid', description: 'Id (UUID) del usuario. Omitir para el usuario actual.' },
        },
      },
    },
    isAvailableFor: () => true,
    async execute(args, context) {
      const userId = (args.userId as string | undefined) ?? context.user.userId;
      // Failing here avoids a downstream call that is certain to be rejected.
      if (userId !== context.user.userId && !hasPermission(context.user, 'roles:read')) {
        throw new ToolGatewayError('forbidden', 'roles:read is required to read other users');
      }
      const found = await roles.rolesOfUser(userId, context.authorization);
      const summary = found.map(({ name, permissions }) => ({ name, permissions }));
      const described = summary.map((role) => `${role.name} (permisos: ${role.permissions.join(', ') || 'ninguno'})`);
      return {
        kind: 'data',
        data: { userId, roles: summary },
        evidence: {
          title: 'Roles de usuario (get_user_roles)',
          source: 'role-service',
          snippet: `${summary.length} rol(es)`,
          text: `Roles del usuario ${userId}: ${described.join('; ') || 'ninguno'}`,
        },
      };
    },
  };
}
