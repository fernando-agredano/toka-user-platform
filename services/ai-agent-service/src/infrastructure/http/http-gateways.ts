import { isAxiosError } from 'axios';
import type { ResilientHttpClient } from '@toka/common';
import {
  type AuditGateway,
  type AuditStats,
  type Page,
  type RoleSummary,
  type RolesGateway,
  type SearchUsersQuery,
  ToolGatewayError,
  type UserSummary,
  type UsersGateway,
} from '../../application/ports/service-gateways.port';

/** Translates any HTTP failure into the few outcomes the agent can reason about. */
async function translate<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      const { status } = error.response;
      if (status === 401 || status === 403) throw new ToolGatewayError('forbidden', `Downstream responded ${status}`);
      if (status === 404) throw new ToolGatewayError('not_found', 'Downstream responded 404');
      if (status < 500) throw new ToolGatewayError('bad_request', `Downstream responded ${status}`);
    }
    // Timeouts, connection errors and an open breaker all mean the same to the agent: try again later.
    throw new ToolGatewayError('unavailable', error instanceof Error ? error.message : 'Downstream unavailable');
  }
}

function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, String(value));
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export class HttpUsersGateway implements UsersGateway {
  constructor(private readonly client: ResilientHttpClient) {}

  search(query: SearchUsersQuery, authorization: string): Promise<Page<UserSummary>> {
    return translate(() =>
      this.client.get<Page<UserSummary>>(withQuery('/api/users', { ...query }), { authorization }),
    );
  }
}

export class HttpRolesGateway implements RolesGateway {
  constructor(private readonly client: ResilientHttpClient) {}

  rolesOfUser(userId: string, authorization: string): Promise<RoleSummary[]> {
    return translate(() => this.client.get<RoleSummary[]>(`/api/roles/users/${encodeURIComponent(userId)}`, { authorization }));
  }
}

export class HttpAuditGateway implements AuditGateway {
  constructor(private readonly client: ResilientHttpClient) {}

  stats(range: { from?: string; to?: string }, authorization: string): Promise<AuditStats> {
    return translate(() => this.client.get<AuditStats>(withQuery('/api/audit/stats', range), { authorization }));
  }
}
