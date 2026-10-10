import { useSearchAuditQuery } from '@/api/audit.api';
import { Page } from '@/components/layout/Page';
import { McpCallsTable } from '@/components/mcp/McpCallsTable';
import { McpConnectCard } from '@/components/mcp/McpConnectCard';
import { McpSummaryCards } from '@/components/mcp/McpSummaryCards';
import { OutcomePanel } from '@/components/mcp/OutcomePanel';
import { ToolUsagePanel } from '@/components/mcp/ToolUsagePanel';
import { MCP_EVENT_TYPE, type McpCall, summarizeMcpCalls, toMcpCall } from '@/utils/mcp-calls';
import { useMemo } from 'react';

// The audit API has no aggregates per tool, so the breakdowns are computed over the latest calls.
const SAMPLE_SIZE = 100;

export const McpPage = () => {
  const { data, isLoading, isError, refetch } = useSearchAuditQuery({
    type: MCP_EVENT_TYPE,
    page: 1,
    limit: SAMPLE_SIZE,
  });
  const calls = useMemo(
    () => (data?.items ?? []).map(toMcpCall).filter((call): call is McpCall => call !== null),
    [data],
  );
  const summary = useMemo(() => summarizeMcpCalls(calls), [calls]);

  return (
    <Page
      title="Servidor MCP"
      subtitle="Asistentes de IA conectados a la plataforma con los permisos de cada usuario"
    >
      <div className="space-y-6">
        <McpSummaryCards totalCalls={data?.total} summary={summary} loading={isLoading} />
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="min-w-0 space-y-6">
            <div className="grid gap-6 min-[1400px]:grid-cols-2">
              <ToolUsagePanel summary={summary} loading={isLoading} />
              <OutcomePanel summary={summary} loading={isLoading} />
            </div>
            <McpCallsTable calls={calls} isLoading={isLoading} isError={isError} onRetry={refetch} />
          </div>
          <McpConnectCard />
        </div>
      </div>
    </Page>
  );
};
