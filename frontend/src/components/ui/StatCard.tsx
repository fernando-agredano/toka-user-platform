import { Icon, type IconName } from './Icon';
import { Skeleton } from './Skeleton';

interface StatCardProps {
  label: string;
  value: number | undefined;
  isLoading: boolean;
  icon: IconName;
  /** Appended to the value, e.g. "%" or " ms". */
  suffix?: string;
  /** Small caption under the value. */
  hint?: string;
}

export const StatCard = ({ label, value, isLoading, icon, suffix = '', hint }: StatCardProps) => (
  <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-card p-6">
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">{label}</p>
      {isLoading ? (
        <Skeleton className="mt-3 h-10 w-24" />
      ) : (
        <p className="mt-2 text-4xl font-bold leading-none text-ink">
          {value === undefined ? '—' : `${value.toLocaleString('es-MX')}${suffix}`}
        </p>
      )}
      {hint && <p className="mt-2 truncate text-xs text-ink-soft">{hint}</p>}
    </div>
    <Icon name={icon} className="h-9 w-9 shrink-0 text-primary" />
  </div>
);
