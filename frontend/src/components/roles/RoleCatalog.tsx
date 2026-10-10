import type { RoleView } from '@/@types/api';
import { useListRolesQuery } from '@/api/roles.api';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Skeleton } from '../ui/Skeleton';
import { PermissionTags } from './PermissionTags';

/** One segment per permission in the system; filled when the role grants it. */
const PermissionMeter = ({ role, allPermissions }: { role: RoleView; allPermissions: string[] }) => (
  <div>
    <div className="flex gap-1">
      {allPermissions.map((permission) => (
        <span
          key={permission}
          className={`h-1.5 flex-1 rounded-full ${role.permissions.includes(permission) ? 'bg-primary' : 'bg-line'}`}
        />
      ))}
    </div>
    <p className="mt-1.5 text-xs text-ink-muted">
      {role.permissions.length} de {allPermissions.length} permisos
    </p>
  </div>
);

export const RoleCatalog = () => {
  const { data: roles, isLoading, isError, refetch } = useListRolesQuery();

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-card py-10 text-center">
        <p className="text-sm text-ink-soft">No se pudieron cargar los roles.</p>
        <Button variant="secondary" onClick={refetch}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  const allPermissions = [...new Set(roles?.flatMap((role) => role.permissions))].sort();

  return (
    <ul className="grid shrink-0 gap-5 lg:grid-cols-3">
      {roles?.map((role) => (
        <li key={role.id} className="flex flex-col rounded-lg border border-line bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Icon name="roles" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold tracking-tight text-ink">{role.name}</h2>
              <p className="truncate text-xs text-ink-soft">{role.description || 'Sin descripción'}</p>
            </div>
          </div>
          <div className="mt-3.5">
            <PermissionMeter role={role} allPermissions={allPermissions} />
          </div>
          <div className="mt-3.5 border-t border-line pt-3.5">
            <PermissionTags permissions={role.permissions} compact />
          </div>
        </li>
      ))}
    </ul>
  );
};
