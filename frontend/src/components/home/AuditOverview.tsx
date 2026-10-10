import { useGetAuditStatsQuery, useSearchAuditQuery } from '@/api/audit.api';
import { EventTypeBars } from './EventTypeBars';
import { LoginDonut } from './LoginDonut';
import { RecentActivity } from './RecentActivity';

const RECENT_EVENTS = 6;

/** Charts and the activity feed; only mounted for users who can read the audit log. */
export const AuditOverview = () => {
  const stats = useGetAuditStatsQuery({});
  const recent = useSearchAuditQuery({ page: 1, limit: RECENT_EVENTS });

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <EventTypeBars byType={stats.data?.byType} loading={stats.isLoading} />
      </div>
      <LoginDonut byType={stats.data?.byType} loading={stats.isLoading} />
      <div className="xl:col-span-3">
        <RecentActivity entries={recent.data?.items} loading={recent.isLoading} />
      </div>
    </div>
  );
};
