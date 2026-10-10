import { Badge } from '@/components/ui/Badge';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { TableCard } from '@/components/ui/TableCard';
import { formatDateTime, formatRelativeTime, shortId } from '@/utils/format';
import { type McpCall, OUTCOME_LABELS, OUTCOME_TONES } from '@/utils/mcp-calls';

const VISIBLE_CALLS = 8;

const columns: Column<McpCall>[] = [
  {
    header: 'Cuándo',
    cell: (call) => (
      <time
        dateTime={call.occurredAt}
        title={formatDateTime(call.occurredAt)}
        className="whitespace-nowrap text-ink-soft"
      >
        {formatRelativeTime(call.occurredAt)}
      </time>
    ),
  },
  { header: 'Herramienta', cell: (call) => <span className="font-mono text-xs text-ink">{call.tool}</span> },
  {
    header: 'Resultado',
    cell: (call) => (
      <span className="whitespace-nowrap">
        <Badge tone={OUTCOME_TONES[call.outcome]}>{OUTCOME_LABELS[call.outcome]}</Badge>
      </span>
    ),
  },
  {
    header: 'Duración',
    className: 'text-right',
    cell: (call) => (
      <span className="whitespace-nowrap tabular-nums text-ink-soft">{call.durationMs} ms</span>
    ),
  },
  {
    header: 'Usuario',
    cell: (call) => (
      <span className="whitespace-nowrap font-mono text-xs text-ink-soft">
        {call.userId ? shortId(call.userId) : '—'}
      </span>
    ),
  },
];

interface McpCallsTableProps {
  calls: McpCall[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export const McpCallsTable = ({ calls, isLoading, isError, onRetry }: McpCallsTableProps) => (
  <TableCard
    toolbar={
      <div>
        <h2 className="text-base font-semibold text-ink">Últimas invocaciones</h2>
        <p className="mt-0.5 text-xs text-ink-soft">
          Las {VISIBLE_CALLS} llamadas más recientes de los asistentes
        </p>
      </div>
    }
  >
    <DataTable
      columns={columns}
      rows={calls.slice(0, VISIBLE_CALLS)}
      rowKey={(call) => call.id}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      emptyMessage="Aún no hay llamadas MCP. Conecta un asistente para empezar."
    />
  </TableCard>
);
