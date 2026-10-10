import { AuditOverview } from '@/components/home/AuditOverview';
import { FeatureCard } from '@/components/home/FeatureCard';
import { Page } from '@/components/layout/Page';
import { Card } from '@/components/ui/Card';
import { useHomeMetrics } from '@/hooks/use-home-metrics';
import { usePermissions } from '@/hooks/use-permissions';
import { NAV_ITEMS } from '@/routes/navigation';

export const HomePage = () => {
  const { can } = usePermissions();
  const metrics = useHomeMetrics();
  const visibleItems = NAV_ITEMS.filter((item) => can(item.permission));

  return (
    <Page title="Inicio" subtitle="Resumen de la plataforma">
      <div className="space-y-8">
        {visibleItems.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">
              Tu cuenta aún no tiene permisos para usar ninguna sección.
            </p>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {visibleItems.map((item) => (
              <FeatureCard key={item.to} item={item} metric={metrics[item.to]} />
            ))}
          </div>
        )}
        {can('audit:read') && <AuditOverview />}
      </div>
    </Page>
  );
};
