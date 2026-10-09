import type { UserStatus, UserView } from '@/@types/api';
import { useActivateUserMutation, useDeactivateUserMutation, useListUsersQuery } from '@/api/users.api';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { SelectField, TextField } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { CreateUserModal } from '@/components/users/CreateUserModal';
import { EditUserModal } from '@/components/users/EditUserModal';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { formatDate, fullName } from '@/utils/format';
import { useState } from 'react';

const PAGE_SIZE = 10;

export const UsersPage = () => {
  const toast = useToast();
  const { can } = usePermissions();
  const canWrite = can('users:write');

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput);
  const [status, setStatus] = useState<UserStatus | ''>('');

  const [isCreating, setIsCreating] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserView | null>(null);
  const [userToToggle, setUserToToggle] = useState<UserView | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useListUsersQuery({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    status: status || undefined,
  });
  const [activateUser, { isLoading: isActivating }] = useActivateUserMutation();
  const [deactivateUser, { isLoading: isDeactivating }] = useDeactivateUserMutation();

  const confirmToggle = async () => {
    if (!userToToggle) return;
    const willDeactivate = userToToggle.status === 'ACTIVE';
    const result = await (willDeactivate ? deactivateUser : activateUser)(userToToggle.id);
    if ('error' in result) return;
    toast.success(`Usuario ${willDeactivate ? 'desactivado' : 'activado'}.`);
    setUserToToggle(null);
  };

  const columns: Column<UserView>[] = [
    {
      header: 'Usuario',
      cell: (user) => (
        <div className="flex items-center gap-3">
          <Avatar name={fullName(user)} />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{fullName(user)}</p>
            <p className="truncate text-xs text-ink-soft">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Estado',
      cell: (user) => (
        <Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'} withDot>
          {user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    { header: 'Alta', cell: (user) => <span className="text-ink-soft">{formatDate(user.createdAt)}</span> },
    ...(canWrite
      ? [
          {
            header: 'Acciones',
            className: 'text-right',
            cell: (user: UserView) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" onClick={() => setUserToEdit(user)}>
                  Editar
                </Button>
                <Button variant="ghost" onClick={() => setUserToToggle(user)}>
                  {user.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Cuentas registradas en la plataforma."
        actions={canWrite && <Button onClick={() => setIsCreating(true)}>Nuevo usuario</Button>}
      />
      <Card>
        <div className="mb-4 grid gap-4 sm:grid-cols-[1fr_12rem]">
          <TextField
            label="Buscar"
            placeholder="Nombre o correo"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(1);
            }}
          />
          <SelectField
            label="Estado"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as UserStatus | '');
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
          </SelectField>
        </div>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(user) => user.id}
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          emptyMessage="No hay usuarios que coincidan con la búsqueda."
        />
        {data && (
          <Pagination
            page={page}
            limit={PAGE_SIZE}
            total={data.total}
            onPageChange={setPage}
            disabled={isFetching}
          />
        )}
      </Card>

      {isCreating && <CreateUserModal onClose={() => setIsCreating(false)} />}
      {userToEdit && <EditUserModal user={userToEdit} onClose={() => setUserToEdit(null)} />}
      {userToToggle && (
        <ConfirmDialog
          title={userToToggle.status === 'ACTIVE' ? 'Desactivar usuario' : 'Activar usuario'}
          message={
            userToToggle.status === 'ACTIVE'
              ? `${userToToggle.email} no podrá iniciar sesión y se revocarán sus sesiones activas.`
              : `${userToToggle.email} podrá volver a iniciar sesión.`
          }
          confirmLabel={userToToggle.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
          destructive={userToToggle.status === 'ACTIVE'}
          loading={isActivating || isDeactivating}
          onConfirm={confirmToggle}
          onCancel={() => setUserToToggle(null)}
        />
      )}
    </>
  );
};
