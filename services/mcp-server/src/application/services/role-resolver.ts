import { ToolExecutionError } from '../../domain/errors/tool-execution-error';
import type { RoleView, RolesGateway } from '../ports/gateways.port';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Assistants think in role names ("MANAGER"), the API in ids: accept either and resolve against the catalog. */
export async function resolveRole(roles: RolesGateway, nameOrId: string, authorization: string): Promise<RoleView> {
  const catalog = await roles.list(authorization);
  const wanted = nameOrId.trim();
  const match = catalog.find((role) => (UUID.test(wanted) ? role.id === wanted.toLowerCase() : role.name === wanted.toUpperCase()));
  if (!match) {
    throw new ToolExecutionError('bad_request', `Unknown role "${wanted}". Available roles: ${catalog.map((role) => role.name).join(', ')}`);
  }
  return match;
}
