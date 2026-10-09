import { isAxiosError } from 'axios';
import type { ResilientHttpClient } from '@toka/common';
import { ToolExecutionError } from '../../domain/errors/tool-execution-error';
import { neutralizeText } from '../../domain/services/untrusted-text';
import type {
  AuditEventView,
  AuditGateway,
  AuditQuery,
  AuditStatsView,
  KnowledgeAnswer,
  KnowledgeGateway,
  Page,
  RoleView,
  RolesGateway,
  SearchUsersQuery,
  UserView,
  UsersGateway,
} from '../../application/ports/gateways.port';

/** Turns any HTTP failure into the few outcomes the assistant can act on, keeping our own RFC 7807 `detail`. */
async function translate<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      const { status, data } = error.response;
      const detail = typeof data?.detail === 'string' ? neutralizeText(data.detail, 300) : undefined;
      if (status === 401) throw new ToolExecutionError('unauthorized', 'The access token is invalid or expired; sign in again to get a new one.');
      if (status === 403) throw new ToolExecutionError('forbidden', detail ?? 'Your permissions do not allow this operation.');
      if (status === 404) throw new ToolExecutionError('not_found', detail ?? 'Resource not found.');
      if (status === 409) throw new ToolExecutionError('conflict', detail ?? 'The operation conflicts with the current state.');
      if (status === 429) throw new ToolExecutionError('rate_limited', detail ?? 'The platform is rate limiting this request; retry shortly.');
      if (status < 500) throw new ToolExecutionError('bad_request', detail ?? `The platform rejected the request (${status}).`);
    }
    // Timeouts, connection errors and an open breaker all mean the same to the assistant: try again later.
    throw new ToolExecutionError('unavailable', 'A platform service is temporarily unavailable; try again shortly.');
  }
}

function withQuery(path: string, params: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, String(value));
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

const segment = encodeURIComponent;

export class HttpUsersGateway implements UsersGateway {
  constructor(private readonly client: ResilientHttpClient) {}

  search(query: SearchUsersQuery, authorization: string): Promise<Page<UserView>> {
    return translate(() => this.client.get(withQuery('/api/users', query), { authorization }));
  }

  get(userId: string, authorization: string): Promise<UserView> {
    return translate(() => this.client.get(`/api/users/${segment(userId)}`, { authorization }));
  }

  me(authorization: string): Promise<UserView> {
    return translate(() => this.client.get('/api/users/me', { authorization }));
  }

  setActive(userId: string, active: boolean, authorization: string): Promise<UserView> {
    const action = active ? 'activate' : 'deactivate';
    return translate(() =>
      this.client.request({ method: 'POST', url: `/api/users/${segment(userId)}/${action}` }, { authorization }),
    );
  }
}

export class HttpRolesGateway implements RolesGateway {
  constructor(private readonly client: ResilientHttpClient) {}

  list(authorization: string): Promise<RoleView[]> {
    return translate(() => this.client.get('/api/roles', { authorization }));
  }

  rolesOfUser(userId: string, authorization: string): Promise<RoleView[]> {
    return translate(() => this.client.get(`/api/roles/users/${segment(userId)}`, { authorization }));
  }

  async assign(userId: string, roleId: string, authorization: string): Promise<void> {
    await translate(() =>
      this.client.request(
        { method: 'POST', url: `/api/roles/users/${segment(userId)}/assign`, data: { roleId } },
        { authorization },
      ),
    );
  }

  async revoke(userId: string, roleId: string, authorization: string): Promise<void> {
    await translate(() =>
      this.client.request(
        { method: 'DELETE', url: `/api/roles/users/${segment(userId)}/roles/${segment(roleId)}` },
        { authorization },
      ),
    );
  }
}

export class HttpAuditGateway implements AuditGateway {
  constructor(private readonly client: ResilientHttpClient) {}

  events(query: AuditQuery, authorization: string): Promise<Page<AuditEventView>> {
    return translate(() => this.client.get(withQuery('/api/audit', query), { authorization }));
  }

  stats(range: { from?: string; to?: string }, authorization: string): Promise<AuditStatsView> {
    return translate(() => this.client.get(withQuery('/api/audit/stats', range), { authorization }));
  }
}

export class HttpKnowledgeGateway implements KnowledgeGateway {
  constructor(private readonly client: ResilientHttpClient) {}

  ask(message: string, conversationId: string | undefined, authorization: string): Promise<KnowledgeAnswer> {
    return translate(() =>
      this.client.request({ method: 'POST', url: '/api/ai/chat', data: { message, conversationId } }, { authorization }),
    );
  }
}
