# Política de roles y permisos

- **Responsable:** Equipo de Seguridad de la Información
- **Versión:** 1.3
- **Última revisión:** 2026-09-15
- **Aplica a:** todos los usuarios de Toka User Platform

## Objetivo

Definir cómo se otorgan, revisan y retiran los accesos dentro de la plataforma. El modelo es de control de acceso basado en roles (RBAC): los usuarios no reciben permisos sueltos, reciben roles, y cada rol agrupa un conjunto de permisos.

## Catálogo de permisos

La plataforma reconoce exactamente seis permisos. No existen permisos fuera de este catálogo y no se pueden crear permisos nuevos desde la interfaz.

| Permiso | Qué permite |
|---|---|
| `users:read` | Consultar el directorio de usuarios, buscar y ver el perfil de cualquier usuario. |
| `users:write` | Crear usuarios, editar sus datos, desactivarlos y reactivarlos. |
| `roles:read` | Ver el catálogo de roles y los roles asignados a cualquier usuario. |
| `roles:write` | Crear roles, cambiar sus permisos, asignar y quitar roles a usuarios. |
| `audit:read` | Consultar el registro de auditoría, sus estadísticas y las métricas del asistente IA. |
| `ai:use` | Usar el Asistente IA. |

Todo usuario autenticado puede, sin permisos adicionales, ver y editar su propio nombre y apellido, y consultar sus propios roles.

## Roles predefinidos

| Rol | Permisos | Para quién |
|---|---|---|
| `ADMIN` | Los seis permisos del catálogo. | Administradores de la plataforma. Número reducido de personas. |
| `MANAGER` | `users:read`, `users:write`, `roles:read`, `audit:read`, `ai:use` | Responsables de área que gestionan el alta y baja de su equipo. |
| `USER` | `ai:use` | Cualquier persona registrada. Es el rol por defecto. |

Un `MANAGER` puede ver los roles de los usuarios, pero **no puede asignarlos ni quitarlos**: eso requiere `roles:write`, que solo tiene `ADMIN`. Esta separación evita que una misma persona pueda darse más privilegios a sí misma.

## Asignación automática al registrarse

Cuando una persona se registra desde la pantalla pública de registro, o cuando un administrador la da de alta, recibe automáticamente el rol `USER`. La asignación es asíncrona y suele completarse en uno o dos segundos. Si justo después del registro el usuario ve que su sesión no tiene permisos, debe cerrar sesión y volver a entrar.

## Cómo solicitar un rol adicional

1. El usuario solicita el rol a su responsable directo indicando el motivo y la duración prevista.
2. El responsable envía la solicitud a un administrador de la plataforma.
3. Un `ADMIN` asigna el rol desde **Roles → Roles por usuario**.
4. El usuario debe **cerrar sesión y volver a iniciarla** para que el nuevo permiso aparezca en su sesión. Los permisos viajan dentro del token de acceso, que dura 15 minutos; hasta que se renueve, el cambio puede no reflejarse.

El Asistente IA no puede asignar roles ni aprobar solicitudes.

## Retiro de roles

- Los roles se retiran cuando la persona cambia de puesto, termina el proyecto que lo justificaba o deja la organización.
- Quitar un rol no cierra la sesión activa; el permiso deja de estar disponible cuando el token de acceso se renueva (como máximo 15 minutos).
- Si se necesita cortar el acceso de inmediato, se debe **desactivar al usuario**: la desactivación revoca todas sus sesiones.

## Regla del último administrador

La plataforma no permite quitar el rol `ADMIN` al último usuario que lo tiene. El intento se rechaza con un error de conflicto. Para retirar a un administrador, primero hay que asignar `ADMIN` a otra persona.

## Roles personalizados

Un `ADMIN` puede crear roles adicionales (por ejemplo, `AUDITOR` con solo `audit:read`) desde la sección de roles. Los nombres de rol se escriben en mayúsculas, sin espacios. Los permisos de un rol personalizado deben elegirse del catálogo anterior.

## Principio de mínimo privilegio y revisión periódica

- Se asigna el rol con menos permisos que permita hacer el trabajo.
- Cada trimestre, los responsables de área revisan los roles de su equipo usando la sección de auditoría y solicitan el retiro de los que ya no se usen.
- Todas las asignaciones y retiros quedan registrados en auditoría con los eventos `role.assigned` y `role.revoked`, incluyendo quién hizo el cambio.
