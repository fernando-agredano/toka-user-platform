import { AssistantPage } from '@/pages/AssistantPage';
import { AuditPage } from '@/pages/AuditPage';
import { RolesPage } from '@/pages/RolesPage';
import { UsersPage } from '@/pages/UsersPage';
import type { ReactNode } from 'react';

export interface NavItem {
  to: string;
  label: string;
  description: string;
  permission: string;
  page: ReactNode;
}

// Single source for the sidebar, the home cards and the permission-guarded routes.
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/users',
    label: 'Usuarios',
    description: 'Consulta, crea y administra cuentas.',
    permission: 'users:read',
    page: <UsersPage />,
  },
  {
    to: '/roles',
    label: 'Roles',
    description: 'Revisa roles y asígnalos a usuarios.',
    permission: 'roles:read',
    page: <RolesPage />,
  },
  {
    to: '/audit',
    label: 'Auditoría',
    description: 'Eventos del sistema y estadísticas.',
    permission: 'audit:read',
    page: <AuditPage />,
  },
  {
    to: '/assistant',
    label: 'Asistente IA',
    description: 'Pregunta sobre usuarios, roles y políticas.',
    permission: 'ai:use',
    page: <AssistantPage />,
  },
];
