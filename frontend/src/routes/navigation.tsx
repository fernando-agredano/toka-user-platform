import type { IconName } from '@/components/ui/Icon';
import { AuditPage } from '@/pages/AuditPage';
import { McpPage } from '@/pages/McpPage';
import { RolesPage } from '@/pages/RolesPage';
import { UsersPage } from '@/pages/UsersPage';
import type { ReactNode } from 'react';

export interface NavItem {
  to: string;
  label: string;
  description: string;
  permission: string;
  icon: IconName;
  page: ReactNode;
}

// Single source for the sidebar, the home cards and the permission-guarded routes.
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/users',
    label: 'Usuarios',
    description: 'Consulta, crea y administra cuentas.',
    permission: 'users:read',
    icon: 'users',
    page: <UsersPage />,
  },
  {
    to: '/roles',
    label: 'Roles',
    description: 'Revisa roles y asígnalos a usuarios.',
    permission: 'roles:read',
    icon: 'roles',
    page: <RolesPage />,
  },
  {
    to: '/audit',
    label: 'Auditoría',
    description: 'Eventos del sistema y estadísticas.',
    permission: 'audit:read',
    icon: 'audit',
    page: <AuditPage />,
  },
  {
    to: '/mcp',
    label: 'Servidor MCP',
    description: 'Actividad de los asistentes y cómo conectarlos.',
    permission: 'audit:read',
    icon: 'plug',
    page: <McpPage />,
  },
];
