import { useListRolesQuery } from '@/api/roles.api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';

export const RoleCatalog = () => {
  const { data: roles, isLoading, isError, refetch } = useListRolesQuery();

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-ink">Catálogo de roles</h2>
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}
      {isError && (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">No se pudieron cargar los roles.</p>
          <Button variant="secondary" onClick={refetch}>
            Reintentar
          </Button>
        </div>
      )}
      <ul className="space-y-4">
        {roles?.map((role) => (
          <li key={role.id} className="rounded-sm border border-line p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold text-ink">{role.name}</h3>
              <span className="text-xs text-ink-soft">{role.permissions.length} permisos</span>
            </div>
            {role.description && <p className="mt-1 text-sm text-ink-soft">{role.description}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {role.permissions.map((permission) => (
                <Badge key={permission}>{permission}</Badge>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};
