export const USERS_GATEWAY = Symbol('USERS_GATEWAY');
export const ROLES_GATEWAY = Symbol('ROLES_GATEWAY');
export const AUDIT_GATEWAY = Symbol('AUDIT_GATEWAY');

export type GatewayErrorKind = 'forbidden' | 'not_found' | 'bad_request' | 'unavailable';

/** A downstream failure translated to what the agent can reason about, whatever HTTP client produced it. */
export class ToolGatewayError extends Error {
  constructor(
    readonly kind: GatewayErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ToolGatewayError';
  }
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface SearchUsersQuery {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  page: number;
  limit: number;
}

export interface RoleSummary {
  name: string;
  permissions: string[];
}

export interface AuditStats {
  from: string | null;
  to: string | null;
  total: number;
  byType: Array<{ type: string; count: number }>;
  failedLogins: number;
  lockedAccounts: number;
}

/** Every call carries the caller's own `Authorization` header: the downstream service enforces their permissions. */
export interface UsersGateway {
  search(query: SearchUsersQuery, authorization: string): Promise<Page<UserSummary>>;
}

export interface RolesGateway {
  rolesOfUser(userId: string, authorization: string): Promise<RoleSummary[]>;
}

export interface AuditGateway {
  stats(range: { from?: string; to?: string }, authorization: string): Promise<AuditStats>;
}
