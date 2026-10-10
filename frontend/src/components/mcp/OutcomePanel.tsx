import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { type McpOutcome, type McpSummary, OUTCOME_LABELS } from '@/utils/mcp-calls';

// Segment colors; every one is also named in the legend, so color is never the only cue.
const OUTCOME_COLORS: Record<McpOutcome, string> = {
  success: 'bg-primary',
  preview: 'bg-ink-muted',
  denied: 'bg-danger',
  rate_limited: 'bg-warning',
  error: 'bg-ink',
};

export const OutcomePanel = ({ summary, loading }: { summary: McpSummary; loading: boolean }) => (
  <Panel title="Resultado de las llamadas" subtitle="Cada llamada se audita, incluso las rechazadas">
    {loading ? (
      <Skeleton className="h-28 w-full" />
    ) : summary.count === 0 ? (
      <p className="text-sm text-ink-soft">Aún no hay llamadas registradas.</p>
    ) : (
      <div className="space-y-5">
        <div
          role="img"
          aria-label="Distribución de resultados"
          className="flex h-3 gap-0.5 overflow-hidden rounded-full"
        >
          {summary.byOutcome
            .filter(({ count }) => count > 0)
            .map(({ outcome, count }) => (
              <span
                key={outcome}
                className={`h-full first:rounded-l-full last:rounded-r-full ${OUTCOME_COLORS[outcome]}`}
                style={{ width: `${(count / summary.count) * 100}%` }}
              />
            ))}
        </div>
        <ul className="space-y-2.5">
          {summary.byOutcome.map(({ outcome, count }) => (
            <li key={outcome} className="flex items-center gap-2.5 text-sm">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${OUTCOME_COLORS[outcome]}`}
              />
              <span className="flex-1 text-ink-soft">{OUTCOME_LABELS[outcome]}</span>
              <span className="font-semibold tabular-nums text-ink">{count}</span>
              <span className="w-10 text-right text-xs tabular-nums text-ink-muted">
                {Math.round((count / summary.count) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </Panel>
);
