import type { RoleView, UserView } from '@/@types/api';
import { useGetUserRolesQuery, useListRolesQuery, useRevokeRoleMutation } from '@/api/roles.api';
import { useConfirm } from '@/hooks/use-confirm';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { fullName } from '@/utils/format';
import { useState } from 'react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Skeleton } from '../ui/Skeleton';
import { AssignRolePanel } from './AssignRolePanel';
import { PermissionTags } from './PermissionTags';

const RoleTag = ({ role, onRemove }: { role: RoleView; onRemove?: () => void }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-page py-1 pl-3.5 pr-1.5 text-sm font-medium text-ink">
    {role.name}
    {onRemove ? (
      <button
        type="button"
        aria-label={`Quitar rol ${role.name}`}
        onClick={onRemove}
        className="flex h-5 w-5 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
      >
        <Icon name="x" className="h-3.5 w-3.5" />
      </button>
    ) : (
      <span className="w-2" />
    )}
  </span>
);

export const UserRoleDetail = ({ user }: { user: UserView }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = usePermissions();
  const canWrite = can('roles:write');

  const { data: userRoles, isLoading, isError, refetch } = useGetUserRolesQuery(user.id);
  const { data: allRoles } = useListRolesQuery();
  const [revokeRole] = useRevokeRoleMutation();
  const [isAssigning, setIsAssigning] = useState(false);

  const assignableRoles = allRoles?.filter((role) => !userRoles?.some((owned) => owned.id === role.id)) ?? [];
  const effectivePermissions = [...new Set(userRoles?.flatMap((role) => role.permissions))];

  const handleRevoke = async (role: RoleView) => {
    const confirmed = await confirm({
      title: 'Quitar rol',
      message: `${user.email} perderá el rol ${role.name} y los permisos que este le da.`,
      confirmLabel: 'Quitar rol',
      destructive: true,
    });
    if (!confirmed) return;
    const result = await revokeRole({ userId: user.id, roleId: role.id });
    if ('error' in result) return;
    toast.success(`${role.name} se quitó a ${user.email}.`, 'Rol removido');
  };

  const idlePanelMessage = !canWrite
    ? 'No tienes permiso para modificar roles.'
    : assignableRoles.length === 0
      ? 'Este usuario ya tiene todos los roles disponibles.'
      : 'Pulsa «Agregar rol» para elegir uno y ver los permisos que otorga antes de asignarlo.';

  return (
    <div className="grid min-h-0 gap-5 lg:grid-cols-2">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-card">
        <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-line px-6 py-5">
          <Avatar name={fullName(user)} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-ink">{fullName(user)}</h2>
            <p className="truncate text-sm text-ink-soft">{user.email}</p>
          </div>
          <Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'} withDot>
            {user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-6">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">
                Roles asignados
                {userRoles && <span className="ml-2 font-normal text-ink-muted">{userRoles.length}</span>}
              </h3>
              {canWrite && assignableRoles.length > 0 && (
                <Button variant="secondary" disabled={isAssigning} onClick={() => setIsAssigning(true)}>
                  <Icon name="plus" className="h-4 w-4" />
                  Agregar rol
                </Button>
              )}
            </div>
            {isLoading && <Skeleton className="h-8 w-56" />}
            {isError && (
              <div className="space-y-3">
                <p className="text-sm text-ink-soft">No se pudieron cargar los roles del usuario.</p>
                <Button variant="secondary" onClick={refetch}>
                  Reintentar
                </Button>
              </div>
            )}
            {userRoles?.length === 0 && <p className="text-sm text-ink-soft">Este usuario no tiene roles.</p>}
            <ul className="flex flex-wrap gap-2">
              {userRoles?.map((role) => (
                <li key={role.id}>
                  <RoleTag role={role} onRemove={canWrite ? () => handleRevoke(role) : undefined} />
                </li>
              ))}
            </ul>
          </div>

          {effectivePermissions.length > 0 && (
            <div>
              <h3 className="mb-4 text-sm font-semibold text-ink">Permisos efectivos</h3>
              <PermissionTags permissions={effectivePermissions} />
            </div>
          )}
        </div>
      </section>

      {isAssigning ? (
        <AssignRolePanel
          user={user}
          assignableRoles={assignableRoles}
          onClose={() => setIsAssigning(false)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-card px-8 text-center">
          <Icon name="roles" className="h-9 w-9 text-ink-muted" />
          <p className="text-sm font-medium text-ink">Agregar un rol</p>
          <p className="max-w-xs text-sm text-ink-soft">{idlePanelMessage}</p>
        </div>
      )}
    </div>
  );
};
