import type { RoleView, UserView } from '@/@types/api';
import { useAssignRoleMutation } from '@/api/roles.api';
import { useToast } from '@/hooks/use-toast';
import { fullName } from '@/utils/format';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { PermissionTags } from './PermissionTags';

interface AssignRolePanelProps {
  user: UserView;
  assignableRoles: RoleView[];
  /** Called after assigning or when the admin cancels. */
  onClose: () => void;
}

/** Role picker shown beside the user's details: choose a role, preview its permissions, assign it. */
export const AssignRolePanel = ({ user, assignableRoles, onClose }: AssignRolePanelProps) => {
  const toast = useToast();
  const [assignRole, { isLoading }] = useAssignRoleMutation();
  const [selectedId, setSelectedId] = useState('');
  const selectedRole = assignableRoles.find((role) => role.id === selectedId);

  const handleAssign = async () => {
    if (!selectedRole) return;
    const result = await assignRole({ userId: user.id, roleId: selectedRole.id });
    if ('error' in result) return;
    toast.success(`${selectedRole.name} se asignó a ${user.email}.`, 'Rol asignado');
    onClose();
  };

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-card">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-6 py-5">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-ink">Agregar rol</h3>
          <p className="text-sm text-ink-soft">Elige el rol que tendrá {fullName(user)}.</p>
        </div>
        <button
          type="button"
          aria-label="Cancelar"
          onClick={onClose}
          className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-primary-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
        <fieldset className="space-y-2.5">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Roles disponibles
          </legend>
          {assignableRoles.map((role) => {
            const selected = role.id === selectedId;
            return (
              <label
                key={role.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
                  selected ? 'border-primary bg-primary-soft' : 'border-line hover:border-primary'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={role.id}
                  checked={selected}
                  onChange={() => setSelectedId(role.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    selected ? 'bg-primary text-white' : 'bg-page text-primary'
                  }`}
                >
                  <Icon name="roles" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-bold text-ink">{role.name}</span>
                    <span className="text-xs text-ink-muted">{role.permissions.length} permisos</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-soft">
                    {role.description || 'Sin descripción'}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected ? 'border-primary bg-primary text-white' : 'border-line'
                  }`}
                >
                  {selected && <Icon name="check" className="h-3.5 w-3.5" />}
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="rounded-lg border border-line p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {selectedRole ? `Permisos que otorga ${selectedRole.name}` : 'Permisos'}
          </p>
          {selectedRole ? (
            <PermissionTags permissions={selectedRole.permissions} compact />
          ) : (
            <p className="text-sm text-ink-soft">Selecciona un rol para ver qué permisos otorga.</p>
          )}
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-line p-4">
        <Button variant="secondary" size="lg" onClick={onClose}>
          Cancelar
        </Button>
        <Button size="lg" disabled={!selectedId} loading={isLoading} onClick={handleAssign}>
          Asignar rol
        </Button>
      </div>
    </section>
  );
};
