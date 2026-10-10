import type { BadgeTone } from '@/components/ui/Badge';

const EVENT_LABELS: Record<string, string> = {
  'auth.user.registered': 'Usuario registrado',
  'auth.login.succeeded': 'Inicio de sesión',
  'auth.login.failed': 'Inicio de sesión fallido',
  'auth.login.locked': 'Cuenta bloqueada',
  'user.created': 'Usuario creado',
  'user.updated': 'Usuario actualizado',
  'user.activated': 'Usuario activado',
  'user.deactivated': 'Usuario desactivado',
  'role.created': 'Rol creado',
  'role.assigned': 'Rol asignado',
  'role.revoked': 'Rol revocado',
  'role.permissions.updated': 'Permisos actualizados',
  'ai.query.completed': 'Consulta al asistente',
  'mcp.tool.invoked': 'Herramienta MCP',
};

export const eventLabel = (type: string): string => EVENT_LABELS[type] ?? type;

export const toneOf = (type: string): BadgeTone => {
  if (type.includes('failed') || type.includes('locked') || type.includes('deactivated')) return 'danger';
  if (type.includes('succeeded') || type.includes('created') || type.includes('registered')) return 'success';
  return 'info';
};
