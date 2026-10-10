import type { AuditEntry } from '@/@types/api';
import { Icon } from '@/components/ui/Icon';
import { SkeletonList } from '@/components/ui/Skeleton';
import { eventLabel, toneOf } from '@/utils/audit-events';
import { formatRelativeTime } from '@/utils/format';
import { Link } from 'react-router-dom';
import { Panel } from '../ui/Panel';

const ROW_COUNT = 6;

interface RecentActivityProps {
  entries: AuditEntry[] | undefined;
  loading: boolean;
}

export const RecentActivity = ({ entries, loading }: RecentActivityProps) => (
  <Panel
    title="Actividad reciente"
    subtitle="Los últimos eventos del sistema"
    action={
      <Link
        to="/audit"
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        Ver todo
        <Icon name="arrowRight" className="h-4 w-4" />
      </Link>
    }
  >
    {loading ? (
      <SkeletonList count={ROW_COUNT} itemClassName="h-9 w-full" />
    ) : !entries?.length ? (
      <p className="text-sm text-ink-soft">Aún no hay actividad registrada.</p>
    ) : (
      <ul className="divide-y divide-line">
        {entries.map((entry) => (
          <li key={entry.eventId} className="flex items-center gap-3 py-3 text-sm">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneOf(entry.type) === 'danger' ? 'bg-danger' : 'bg-primary'}`}
            />
            <span className="font-medium text-ink">{eventLabel(entry.type)}</span>
            <span className="hidden truncate text-ink-soft sm:inline">{entry.source}</span>
            <time dateTime={entry.occurredAt} className="ml-auto shrink-0 text-xs text-ink-muted">
              {formatRelativeTime(entry.occurredAt)}
            </time>
          </li>
        ))}
      </ul>
    )}
  </Panel>
);
