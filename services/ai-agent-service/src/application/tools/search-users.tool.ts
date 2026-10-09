import { hasPermission } from '../dtos/session-user';
import type { UsersGateway } from '../ports/service-gateways.port';
import type { AgentTool } from './agent-tool';

const DEFAULT_LIMIT = 10;

export function createSearchUsersTool(users: UsersGateway): AgentTool {
  return {
    declaration: {
      name: 'search_users',
      description:
        'Busca usuarios de la plataforma por nombre o correo y opcionalmente por estado. Devuelve id, nombre, apellido, correo y estado. Úsala para listar usuarios o para obtener el id de una persona antes de consultar sus roles.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Texto a buscar en nombre, apellido o correo. Omitir para listar sin filtro de texto.',
            maxLength: 100,
          },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'], description: 'Filtra por estado de la cuenta.' },
          page: { type: 'integer', minimum: 1, description: 'Página, empieza en 1. Por defecto 1.' },
          limit: { type: 'integer', minimum: 1, maximum: 20, description: 'Resultados por página. Por defecto 10.' },
        },
      },
    },
    isAvailableFor: (user) => hasPermission(user, 'users:read'),
    async execute(args, context) {
      const status = args.status as 'ACTIVE' | 'INACTIVE' | undefined;
      const result = await users.search(
        {
          search: args.query as string | undefined,
          status,
          page: (args.page as number | undefined) ?? 1,
          limit: (args.limit as number | undefined) ?? DEFAULT_LIMIT,
        },
        context.authorization,
      );
      const items = result.items.map(({ id, firstName, lastName, email, status: userStatus }) => ({
        id,
        firstName,
        lastName,
        email,
        status: userStatus,
      }));
      const truncated = result.total > (result.page - 1) * result.limit + items.length;
      const filters = [args.query ? `texto "${args.query as string}"` : '', status ? `estado ${status}` : ''].filter(Boolean);
      const people = items.map((user) => `${user.firstName} ${user.lastName} (${user.email}) estado ${user.status}`);
      return {
        kind: 'data',
        data: { items, page: result.page, total: result.total, truncated },
        evidence: {
          title: 'Usuarios (search_users)',
          source: 'user-service',
          snippet: `${items.length} de ${result.total} usuarios`,
          text: `Usuarios encontrados: ${result.total} en total${filters.length ? ` con ${filters.join(' y ')}` : ''}. ${people.join('; ')}`,
        },
      };
    },
  };
}
