export const AGENT_SETTINGS = Symbol('AGENT_SETTINGS');

export interface AgentSettings {
  responseCacheTtlSeconds: number;
  /** Total time budget of one chat request; once spent, the agent degrades instead of failing. */
  deadlineMs: number;
  /** Rounds in which the model may call tools; the next call is forced to answer. */
  maxToolRounds: number;
  maxToolExecutions: number;
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  rag: {
    candidateLimit: number;
    minScore: number;
    topK: number;
    maxPerSection: number;
    maxContextTokens: number;
    embeddingCacheTtlSeconds: number;
  };
  /** Degraded mode only answers with fragments at least this relevant; below it, a 503 is more honest. */
  degradedMinScore: number;
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  responseCacheTtlSeconds: 3600,
  deadlineMs: 25_000,
  maxToolRounds: 2,
  maxToolExecutions: 4,
  maxOutputTokens: 600,
  temperature: 0.2,
  topP: 0.9,
  rag: {
    candidateLimit: 8,
    minScore: 0.35,
    topK: 4,
    maxPerSection: 2,
    maxContextTokens: 1200,
    embeddingCacheTtlSeconds: 86_400,
  },
  degradedMinScore: 0.45,
};
