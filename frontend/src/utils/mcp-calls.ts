import type { AuditEntry } from '@/@types/api';
import type { BadgeTone } from '@/components/ui/Badge';

export const MCP_EVENT_TYPE = 'mcp.tool.invoked';

export type McpOutcome = 'success' | 'preview' | 'denied' | 'rate_limited' | 'error';

export const OUTCOMES: McpOutcome[] = ['success', 'preview', 'denied', 'rate_limited', 'error'];

export const OUTCOME_LABELS: Record<McpOutcome, string> = {
  success: 'Exitosa',
  preview: 'Vista previa',
  denied: 'Denegada',
  rate_limited: 'Límite alcanzado',
  error: 'Error',
};

export const OUTCOME_TONES: Record<McpOutcome, BadgeTone> = {
  success: 'success',
  preview: 'info',
  denied: 'danger',
  rate_limited: 'warning',
  error: 'danger',
};

export interface McpCall {
  id: string;
  occurredAt: string;
  tool: string;
  outcome: McpOutcome;
  durationMs: number;
  transport: string;
  userId: string | null;
}

const isOutcome = (value: unknown): value is McpOutcome => OUTCOMES.some((outcome) => outcome === value);

/** Reads an `mcp.tool.invoked` audit entry; returns null when its data does not have the expected shape. */
export const toMcpCall = (entry: AuditEntry): McpCall | null => {
  const { tool, outcome, durationMs, transport } = entry.data;
  if (typeof tool !== 'string' || !isOutcome(outcome)) return null;
  return {
    id: entry.eventId,
    occurredAt: entry.occurredAt,
    tool,
    outcome,
    durationMs: typeof durationMs === 'number' ? durationMs : 0,
    transport: typeof transport === 'string' ? transport : '—',
    userId: entry.actor.userId,
  };
};

export interface McpSummary {
  count: number;
  /** Share of calls that succeeded, 0-100; undefined without calls. */
  successRate: number | undefined;
  /** Calls refused by permissions or by the per-user rate limit. */
  blocked: number;
  averageDurationMs: number | undefined;
  byOutcome: Array<{ outcome: McpOutcome; count: number }>;
  byTool: Array<{ label: string; value: number }>;
}

export const summarizeMcpCalls = (calls: McpCall[]): McpSummary => {
  const outcomeCounts = new Map<McpOutcome, number>(OUTCOMES.map((outcome) => [outcome, 0]));
  const toolCounts = new Map<string, number>();
  let totalDuration = 0;

  for (const call of calls) {
    outcomeCounts.set(call.outcome, (outcomeCounts.get(call.outcome) ?? 0) + 1);
    toolCounts.set(call.tool, (toolCounts.get(call.tool) ?? 0) + 1);
    totalDuration += call.durationMs;
  }

  const count = calls.length;
  return {
    count,
    successRate: count ? Math.round(((outcomeCounts.get('success') ?? 0) / count) * 100) : undefined,
    blocked: (outcomeCounts.get('denied') ?? 0) + (outcomeCounts.get('rate_limited') ?? 0),
    averageDurationMs: count ? Math.round(totalDuration / count) : undefined,
    byOutcome: OUTCOMES.map((outcome) => ({ outcome, count: outcomeCounts.get(outcome) ?? 0 })),
    byTool: [...toolCounts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
  };
};
