import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import type { HomeMetric } from '@/hooks/use-home-metrics';
import type { NavItem } from '@/routes/navigation';
import { Link } from 'react-router-dom';

interface FeatureCardProps {
  item: Pick<NavItem, 'to' | 'label' | 'description' | 'icon'>;
  metric?: HomeMetric;
}

export const FeatureCard = ({ item, metric }: FeatureCardProps) => {
  const showMetric = metric && (metric.loading || metric.value !== undefined);

  return (
    <Link
      to={item.to}
      className="group flex flex-col rounded-lg border border-line bg-card p-5 transition duration-200 hover:border-primary hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-start justify-between gap-4">
        <Icon name={item.icon} className="h-8 w-8 text-primary" />
        {showMetric && (
          <div className="text-right">
            {metric.loading ? (
              <Skeleton className="ml-auto h-9 w-16" />
            ) : (
              <p className="text-4xl font-bold leading-none text-ink">{metric.value}</p>
            )}
            <p className="mt-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
              {metric.label}
            </p>
          </div>
        )}
      </div>
      <h2 className="mt-6 text-xl font-semibold text-ink">{item.label}</h2>
      <p className="mt-1 flex-1 text-sm text-ink-soft">{item.description}</p>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        Abrir sección
        <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
};
