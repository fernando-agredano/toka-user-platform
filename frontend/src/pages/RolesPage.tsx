import { Page } from '@/components/layout/Page';
import { RoleCatalog } from '@/components/roles/RoleCatalog';
import { UserAssignments } from '@/components/roles/UserAssignments';
import { usePermissions } from '@/hooks/use-permissions';

export const RolesPage = () => {
  const { can } = usePermissions();

  return (
    <Page title="Roles" subtitle="Catálogo de roles y asignaciones por usuario" fill>
      <div className="flex min-h-0 flex-1 flex-col gap-8">
        <RoleCatalog />
        {can('users:read') && <UserAssignments />}
      </div>
    </Page>
  );
};
