import type { SessionUser } from '../dtos/session-user';
import type { ToolDeclaration } from '../ports/llm-provider.port';
import type { ScoredChunk } from '../ports/vector-store.port';
import type { DataEvidence } from '../services/evidence-ledger';

export interface ToolContext {
  user: SessionUser;
  /** The caller's own `Authorization` header, forwarded so downstream services enforce the caller's permissions. */
  authorization: string;
}

export type ToolResult =
  | { kind: 'data'; data: Record<string, unknown>; evidence: DataEvidence }
  | { kind: 'chunks'; chunks: ScoredChunk[] };

export interface AgentTool {
  declaration: ToolDeclaration;
  /** Tools the caller cannot use are never declared to the model: fewer tokens and no attack surface. */
  isAvailableFor(user: SessionUser): boolean;
  execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
