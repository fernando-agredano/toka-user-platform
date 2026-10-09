import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePermissions } from '@/hooks/use-permissions';
import { NAV_ITEMS } from '@/routes/navigation';
import { Link } from 'react-router-dom';

export const HomePage = () => {
  const { can, user } = usePermissions();
  const visibleItems = NAV_ITEMS.filter((item) => can(item.permission));

  return (
    <>
      <PageHeader title="Bienvenido" description={`Sesión iniciada como ${user?.email}.`} />
      {visibleItems.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-soft">Tu cuenta aún no tiene permisos para usar ninguna sección.</p>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => (
            <Link key={item.to} to={item.to}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <h2 className="font-semibold text-ink">{item.label}</h2>
                <p className="mt-1 text-sm text-ink-soft">{item.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
};
