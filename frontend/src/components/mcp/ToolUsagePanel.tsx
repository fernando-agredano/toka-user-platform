import { BarList } from '@/components/ui/BarList';
import { Panel } from '@/components/ui/Panel';
import { SkeletonList } from '@/components/ui/Skeleton';
import type { McpSummary } from '@/utils/mcp-calls';

const MAX_BARS = 6;

export const ToolUsagePanel = ({ summary, loading }: { summary: McpSummary; loading: boolean }) => (
  <Panel title="Herramientas más usadas" subtitle={`Últimas ${summary.count} llamadas`}>
    {loading ? (
      <SkeletonList count={MAX_BARS} itemClassName="h-6 w-full" />
    ) : summary.byTool.length === 0 ? (
      <p className="text-sm text-ink-soft">Aún no hay llamadas registradas.</p>
    ) : (
      <BarList rows={summary.byTool.slice(0, MAX_BARS)} />
    )}
  </Panel>
);
