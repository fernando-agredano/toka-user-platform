import type { IconName } from '@/components/ui/Icon';

const RESOURCES: Record<string, string> = {
  users: 'Usuarios',
  roles: 'Roles',
  audit: 'Auditoría',
  ai: 'Asistente IA',
};

const ACTIONS: Record<string, string> = { read: 'Lectura', write: 'Escritura', use: 'Uso' };
const SHORT_ACTIONS: Record<string, string> = { read: 'Leer', write: 'Editar', use: 'Usar' };

const RESOURCE_ICONS: Record<string, IconName> = {
  users: 'users',
  roles: 'roles',
  audit: 'audit',
  ai: 'assistant',
};

export interface PermissionGroup {
  resource: string;
  label: string;
  icon: IconName;
  actions: string[];
}

/** "users:read" + "users:write" -> { Usuarios: [Lectura, Escritura] }, in a stable resource order. */
export const groupPermissions = (permissions: string[], short = false): PermissionGroup[] => {
  const actionLabels = short ? SHORT_ACTIONS : ACTIONS;
  const byResource = new Map<string, string[]>();
  for (const permission of permissions) {
    const [resource = permission, action = ''] = permission.split(':');
    byResource.set(resource, [...(byResource.get(resource) ?? []), actionLabels[action] ?? action]);
  }
  const order = Object.keys(RESOURCES);
  return [...byResource.entries()]
    .map(([resource, actions]) => ({
      resource,
      label: RESOURCES[resource] ?? resource,
      icon: RESOURCE_ICONS[resource] ?? 'roles',
      actions,
    }))
    .sort((a, b) => order.indexOf(a.resource) - order.indexOf(b.resource));
};
