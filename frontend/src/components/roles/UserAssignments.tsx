import type { UserView } from '@/@types/api';
import { useState } from 'react';
import { Icon } from '../ui/Icon';
import { UserPicker } from '../users/UserPicker';
import { UserRoleDetail } from './UserRoleDetail';

/** Master-detail bounded by the available height: each side scrolls on its own. */
export const UserAssignments = () => {
  const [selectedUser, setSelectedUser] = useState<UserView | null>(null);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4" aria-labelledby="assignments-title">
      <div>
        <h2 id="assignments-title" className="text-base font-bold text-ink">
          Asignaciones por usuario
        </h2>
        <p className="text-sm text-ink-soft">Elige un usuario para ver y modificar sus roles.</p>
      </div>
      <div className="grid min-h-[22rem] flex-1 gap-5 lg:min-h-0 lg:grid-cols-[20rem_1fr]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-card">
          <UserPicker selectedId={selectedUser?.id} onSelect={setSelectedUser} />
        </div>
        {selectedUser ? (
          <UserRoleDetail key={selectedUser.id} user={selectedUser} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-card px-6 text-center">
            <Icon name="users" className="h-9 w-9 text-ink-muted" />
            <p className="text-sm font-medium text-ink">Selecciona un usuario</p>
            <p className="max-w-xs text-sm text-ink-soft">
              Verás sus roles y permisos, y podrás agregar o quitar roles.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
