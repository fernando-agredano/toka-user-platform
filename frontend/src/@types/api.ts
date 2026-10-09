export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  correlationId: string | null;
  errors?: string[];
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface SessionUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface Session {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface UserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RoleView {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  createdAt: string;
}

export interface AuditEntry {
  eventId: string;
  type: string;
  version: number;
  occurredAt: string;
  correlationId: string;
  source: string;
  actor: { userId: string | null; ip: string | null };
  data: Record<string, unknown>;
}

export interface AuditStats {
  from: string | null;
  to: string | null;
  total: number;
  byType: Array<{ type: string; count: number }>;
  failedLogins: number;
  lockedAccounts: number;
}

export interface AuditFilters {
  type?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

// AI contract (CONTEXTO.md §5), extended in phase 9 (docs/decisiones.md): sources carry the label the answer cites.
export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface AiSource {
  /** Label cited inside the answer: `S#` for documents, `D#` for tool data. */
  id: string;
  title?: string;
  section?: string;
  source?: string;
  score?: number;
  snippet?: string;
}

export interface ChatResponse {
  answer: string;
  conversationId?: string;
  sources: AiSource[];
  toolsUsed: string[];
  metrics: {
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    cached: boolean;
    provider?: string;
    model?: string;
  };
  quality: { score: number; checks: Record<string, boolean | number> };
}
