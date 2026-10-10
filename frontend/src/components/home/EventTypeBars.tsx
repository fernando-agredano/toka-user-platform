import type { AuditStats } from '@/@types/api';
import { BarList } from '@/components/ui/BarList';
import { SkeletonList } from '@/components/ui/Skeleton';
import { eventLabel } from '@/utils/audit-events';
import { Panel } from '../ui/Panel';

const MAX_BARS = 6;

interface EventTypeBarsProps {
  byType: AuditStats['byType'] | undefined;
  loading: boolean;
}

export const EventTypeBars = ({ byType, loading }: EventTypeBarsProps) => {
  const rows = [...(byType ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_BARS)
    .map(({ type, count }) => ({ label: eventLabel(type), value: count }));

  return (
    <Panel title="Eventos por tipo" subtitle="Los tipos más frecuentes del registro de auditoría">
      {loading ? (
        <SkeletonList count={MAX_BARS} itemClassName="h-6 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-soft">Aún no hay eventos registrados.</p>
      ) : (
        <BarList rows={rows} />
      )}
    </Panel>
  );
};
