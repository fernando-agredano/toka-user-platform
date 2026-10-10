import type { UserView } from '@/@types/api';
import { useActivateUserMutation, useDeactivateUserMutation, useListUsersQuery } from '@/api/users.api';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { Icon } from '@/components/ui/Icon';
import { Pagination } from '@/components/ui/Pagination';
import { TableCard } from '@/components/ui/TableCard';
import { CreateUserModal } from '@/components/users/CreateUserModal';
import { EditUserModal } from '@/components/users/EditUserModal';
import { PAGE_SIZE_OPTIONS, type StatusFilter, UsersToolbar } from '@/components/users/UsersToolbar';
import { useConfirm } from '@/hooks/use-confirm';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { formatDate, fullName } from '@/utils/format';
import { useState } from 'react';

export const UsersPage = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = usePermissions();
  const canWrite = can('users:write');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0] ?? 10);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput);
  const [status, setStatus] = useState<StatusFilter>('');

  const [isCreating, setIsCreating] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserView | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useListUsersQuery({
    page,
    limit: pageSize,
    search: search || undefined,
    status: status || undefined,
  });
  const [activateUser] = useActivateUserMutation();
  const [deactivateUser] = useDeactivateUserMutation();

  const resetToFirstPage =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const toggleStatus = async (user: UserView) => {
    const willDeactivate = user.status === 'ACTIVE';
    const confirmed = await confirm({
      title: willDeactivate ? 'Desactivar usuario' : 'Activar usuario',
      message: willDeactivate
        ? `${user.email} no podrá iniciar sesión y se revocarán sus sesiones activas.`
        : `${user.email} podrá volver a iniciar sesión.`,
      confirmLabel: willDeactivate ? 'Desactivar' : 'Activar',
      destructive: willDeactivate,
    });
    if (!confirmed) return;
    const result = await (willDeactivate ? deactivateUser : activateUser)(user.id);
    if ('error' in result) return;
    toast.success(`${fullName(user)} fue ${willDeactivate ? 'desactivado' : 'activado'}.`);
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
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Editar a ${fullName(user)}`}
                  onClick={() => setUserToEdit(user)}
                >
                  <Icon name="pencil" className="h-4 w-4" />
                  Editar
                </Button>
                {user.status === 'ACTIVE' ? (
                  <Button
                    variant="dangerOutline"
                    size="sm"
                    aria-label={`Desactivar a ${fullName(user)}`}
                    onClick={() => toggleStatus(user)}
                  >
                    <Icon name="userX" className="h-4 w-4" />
                    Desactivar
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Activar a ${fullName(user)}`}
                    onClick={() => toggleStatus(user)}
                  >
                    <Icon name="userCheck" className="h-4 w-4" />
                    Activar
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <Page title="Usuarios" subtitle="Cuentas registradas en la plataforma">
      <div className="space-y-5">
        {canWrite && (
          <div className="flex justify-end">
            <Button onClick={() => setIsCreating(true)}>
              <Icon name="plus" className="h-4 w-4" />
              Nuevo usuario
            </Button>
          </div>
        )}
        <TableCard
          toolbar={
            <UsersToolbar
              search={searchInput}
              status={status}
              pageSize={pageSize}
              onSearchChange={resetToFirstPage(setSearchInput)}
              onStatusChange={resetToFirstPage(setStatus)}
              onPageSizeChange={resetToFirstPage(setPageSize)}
              onClear={() => {
                setSearchInput('');
                setStatus('');
                setPage(1);
              }}
            />
          }
        >
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
              limit={pageSize}
              total={data.total}
              onPageChange={setPage}
              disabled={isFetching}
            />
          )}
        </TableCard>
      </div>

      {isCreating && <CreateUserModal onClose={() => setIsCreating(false)} />}
      {userToEdit && <EditUserModal user={userToEdit} onClose={() => setUserToEdit(null)} />}
    </Page>
  );
};
