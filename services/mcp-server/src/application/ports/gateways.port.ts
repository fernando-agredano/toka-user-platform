export interface UserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
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

export interface RoleView {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface AuditEventView {
  eventId: string;
  type: string;
  occurredAt: string;
  correlationId: string;
  source: string;
  actor: { userId: string | null; ip: string | null };
  data: Record<string, unknown>;
}

export interface AuditQuery {
  type?: string;
  actorId?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export interface AuditStatsView {
  from: string | null;
  to: string | null;
  total: number;
  byType: Array<{ type: string; count: number }>;
  failedLogins: number;
  lockedAccounts: number;
}

export interface KnowledgeAnswer {
  answer: string;
  conversationId: string;
  sources: unknown[];
  quality: { score: number };
}

/** Every method takes the caller's `Authorization` header; the owning service decides what they may do. */
export interface UsersGateway {
  search(query: SearchUsersQuery, authorization: string): Promise<Page<UserView>>;
  get(userId: string, authorization: string): Promise<UserView>;
  me(authorization: string): Promise<UserView>;
  setActive(userId: string, active: boolean, authorization: string): Promise<UserView>;
}

export interface RolesGateway {
  list(authorization: string): Promise<RoleView[]>;
  rolesOfUser(userId: string, authorization: string): Promise<RoleView[]>;
  assign(userId: string, roleId: string, authorization: string): Promise<void>;
  revoke(userId: string, roleId: string, authorization: string): Promise<void>;
}

export interface AuditGateway {
  events(query: AuditQuery, authorization: string): Promise<Page<AuditEventView>>;
  stats(range: { from?: string; to?: string }, authorization: string): Promise<AuditStatsView>;
}

export interface KnowledgeGateway {
  ask(message: string, conversationId: string | undefined, authorization: string): Promise<KnowledgeAnswer>;
}
