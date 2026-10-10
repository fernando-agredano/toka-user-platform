import { useGetAuditStatsQuery } from '@/api/audit.api';
import { useListRolesQuery } from '@/api/roles.api';
import { useListUsersQuery } from '@/api/users.api';
import { MCP_EVENT_TYPE } from '@/utils/mcp-calls';
import { usePermissions } from './use-permissions';

export interface HomeMetric {
  value: number | undefined;
  label: string;
  loading: boolean;
}

/** Live counters for the home cards, keyed by route. Sections the user cannot read are never requested. */
export const useHomeMetrics = (): Record<string, HomeMetric> => {
  const { can } = usePermissions();
  const users = useListUsersQuery({ page: 1, limit: 1 }, { skip: !can('users:read') });
  const roles = useListRolesQuery(undefined, { skip: !can('roles:read') });
  const audit = useGetAuditStatsQuery({}, { skip: !can('audit:read') });

  const mcpCalls = audit.data?.byType.find(({ type }) => type === MCP_EVENT_TYPE)?.count;

  return {
    '/users': { value: users.data?.total, label: 'usuarios', loading: users.isLoading },
    '/roles': { value: roles.data?.length, label: 'roles', loading: roles.isLoading },
    '/audit': { value: audit.data?.total, label: 'eventos', loading: audit.isLoading },
    '/mcp': { value: audit.data ? (mcpCalls ?? 0) : undefined, label: 'llamadas', loading: audit.isLoading },
  };
};
