import type { AuditStats } from '@/@types/api';
import { Skeleton } from '@/components/ui/Skeleton';
import { Panel } from '../ui/Panel';

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENT_GAP = 3;

const countOf = (byType: AuditStats['byType'], type: string) =>
  byType.find((item) => item.type === type)?.count ?? 0;

interface LoginDonutProps {
  byType: AuditStats['byType'] | undefined;
  loading: boolean;
}

export const LoginDonut = ({ byType, loading }: LoginDonutProps) => {
  const succeeded = countOf(byType ?? [], 'auth.login.succeeded');
  const failed = countOf(byType ?? [], 'auth.login.failed');
  const total = succeeded + failed;
  const segments = [
    { label: 'Exitosos', count: succeeded, color: 'var(--color-primary)' },
    { label: 'Fallidos', count: failed, color: 'var(--color-danger)' },
  ].filter((segment) => segment.count > 0);

  let offset = 0;
  const arcs = segments.map((segment) => {
    const length = (segment.count / total) * CIRCUMFERENCE;
    const gap = segments.length > 1 ? SEGMENT_GAP : 0;
    const arc = { ...segment, dash: Math.max(length - gap, 0), offset };
    offset += length;
    return arc;
  });

  return (
    <Panel title="Inicios de sesión" subtitle="Resultado de todos los intentos">
      {loading ? (
        <Skeleton className="mx-auto h-40 w-40 rounded-full" />
      ) : total === 0 ? (
        <p className="text-sm text-ink-soft">Aún no hay inicios de sesión registrados.</p>
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div className="relative h-40 w-40">
            <svg
              viewBox="0 0 120 120"
              role="img"
              aria-label={`${succeeded} inicios de sesión exitosos y ${failed} fallidos`}
              className="h-full w-full -rotate-90"
            >
              <circle
                cx="60"
                cy="60"
                r={RADIUS}
                fill="none"
                stroke="var(--color-primary-soft)"
                strokeWidth="12"
              />
              {arcs.map((arc) => (
                <circle
                  key={arc.label}
                  cx="60"
                  cy="60"
                  r={RADIUS}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth="12"
                  strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
                  strokeDashoffset={-arc.offset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold leading-none text-ink">
                {Math.round((succeeded / total) * 100)}%
              </span>
              <span className="mt-1 text-xs text-ink-soft">exitosos</span>
            </div>
          </div>
          <ul className="flex w-full justify-center gap-6 text-sm">
            {[
              { label: 'Exitosos', count: succeeded, color: 'bg-primary' },
              { label: 'Fallidos', count: failed, color: 'bg-danger' },
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-2">
                <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                <span className="text-ink-soft">{item.label}</span>
                <span className="font-semibold tabular-nums text-ink">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
};
