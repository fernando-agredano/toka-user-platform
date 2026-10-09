import type { AuditEntry, AuditFilters, AuditStats, Page } from '@/@types/api';
import { api } from './api';

type AuditSearchParams = AuditFilters & { page: number; limit: number };
type AuditStatsParams = Pick<AuditFilters, 'from' | 'to'>;

export const auditApi = api.injectEndpoints({
  endpoints: (build) => ({
    searchAudit: build.query<Page<AuditEntry>, AuditSearchParams>({
      query: (params) => ({ url: 'audit', params }),
    }),
    getAuditStats: build.query<AuditStats, AuditStatsParams>({
      query: (params) => ({ url: 'audit/stats', params }),
    }),
  }),
});

export const { useSearchAuditQuery, useGetAuditStatsQuery } = auditApi;
