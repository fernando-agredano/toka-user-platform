import type { RoleView, UserView } from '@/@types/api';
import {
  useAssignRoleMutation,
  useGetUserRolesQuery,
  useListRolesQuery,
  useRevokeRoleMutation,
} from '@/api/roles.api';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { fullName } from '@/utils/format';
import { useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SelectField } from '../ui/Field';
import { Skeleton } from '../ui/Skeleton';

export const UserRolesPanel = ({ user }: { user: UserView }) => {
  const toast = useToast();
  const { can } = usePermissions();
  const canWrite = can('roles:write');

  const { data: userRoles, isLoading, isError, refetch } = useGetUserRolesQuery(user.id);
  const { data: allRoles } = useListRolesQuery();
  const [assignRole, { isLoading: isAssigning }] = useAssignRoleMutation();
  const [revokeRole, { isLoading: isRevoking }] = useRevokeRoleMutation();

  const [roleToAssign, setRoleToAssign] = useState('');
  const [roleToRevoke, setRoleToRevoke] = useState<RoleView | null>(null);

  const assignableRoles = allRoles?.filter((role) => !userRoles?.some((owned) => owned.id === role.id));

  const handleAssign = async () => {
    const result = await assignRole({ userId: user.id, roleId: roleToAssign });
    if ('error' in result) return;
    toast.success('Rol asignado.');
    setRoleToAssign('');
  };

  const handleRevoke = async () => {
    if (!roleToRevoke) return;
    const result = await revokeRole({ userId: user.id, roleId: roleToRevoke.id });
    if ('error' in result) return;
    toast.success(`Rol ${roleToRevoke.name} removido.`);
    setRoleToRevoke(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-ink">{fullName(user)}</h3>
        <p className="text-sm text-ink-soft">{user.email}</p>
      </div>

      {isLoading && <Skeleton className="h-8 w-48" />}
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
          <li key={role.id} className="flex items-center gap-1">
            <Badge>{role.name}</Badge>
            {canWrite && (
              <button
                type="button"
                aria-label={`Quitar rol ${role.name}`}
                className="text-xs text-ink-muted hover:text-danger"
                onClick={() => setRoleToRevoke(role)}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      {canWrite && assignableRoles && assignableRoles.length > 0 && (
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <SelectField
              label="Asignar rol"
              value={roleToAssign}
              onChange={(event) => setRoleToAssign(event.target.value)}
            >
              <option value="">Selecciona un rol…</option>
              {assignableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </SelectField>
          </div>
          <Button disabled={!roleToAssign} loading={isAssigning} onClick={handleAssign}>
            Asignar
          </Button>
        </div>
      )}

      {roleToRevoke && (
        <ConfirmDialog
          title="Quitar rol"
          message={`¿Quitar el rol ${roleToRevoke.name} a ${user.email}? Perderá los permisos asociados.`}
          confirmLabel="Quitar rol"
          destructive
          loading={isRevoking}
          onConfirm={handleRevoke}
          onCancel={() => setRoleToRevoke(null)}
        />
      )}
    </div>
  );
};
