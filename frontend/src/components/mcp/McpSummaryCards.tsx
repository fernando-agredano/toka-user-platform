import { StatCard } from '@/components/ui/StatCard';
import type { McpSummary } from '@/utils/mcp-calls';

interface McpSummaryCardsProps {
  totalCalls: number | undefined;
  summary: McpSummary;
  loading: boolean;
}

export const McpSummaryCards = ({ totalCalls, summary, loading }: McpSummaryCardsProps) => {
  const sample = `Últimas ${summary.count} llamadas`;
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Llamadas" value={totalCalls} isLoading={loading} icon="plug" hint="Total histórico" />
      <StatCard
        label="Exitosas"
        value={summary.successRate}
        suffix="%"
        isLoading={loading}
        icon="check"
        hint={sample}
      />
      <StatCard
        label="Bloqueadas"
        value={summary.blocked}
        isLoading={loading}
        icon="lock"
        hint="Permisos o límite"
      />
      <StatCard
        label="Duración media"
        value={summary.averageDurationMs}
        suffix=" ms"
        isLoading={loading}
        icon="clock"
        hint={sample}
      />
    </div>
  );
};
