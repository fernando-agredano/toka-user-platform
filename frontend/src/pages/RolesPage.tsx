import type { UserView } from '@/@types/api';
import { RoleCatalog } from '@/components/roles/RoleCatalog';
import { UserRolesPanel } from '@/components/roles/UserRolesPanel';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { UserPicker } from '@/components/users/UserPicker';
import { usePermissions } from '@/hooks/use-permissions';
import { useState } from 'react';

export const RolesPage = () => {
  const { can } = usePermissions();
  const [selectedUser, setSelectedUser] = useState<UserView | null>(null);

  return (
    <>
      <PageHeader title="Roles" description="Catálogo de roles y asignaciones por usuario." />
      <div className="grid gap-6 xl:grid-cols-2">
        <RoleCatalog />
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink">Roles por usuario</h2>
          {can('users:read') ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
              <UserPicker selectedId={selectedUser?.id} onSelect={setSelectedUser} />
              {selectedUser ? (
                <UserRolesPanel key={selectedUser.id} user={selectedUser} />
              ) : (
                <p className="text-sm text-ink-soft">Selecciona un usuario para ver y modificar sus roles.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Necesitas el permiso users:read para buscar usuarios.</p>
          )}
        </Card>
      </div>
    </>
  );
};
