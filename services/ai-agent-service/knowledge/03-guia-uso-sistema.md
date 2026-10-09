# Guía de uso de Toka User Platform

- **Responsable:** Equipo de Producto
- **Versión:** 1.1
- **Última revisión:** 2026-10-01

## Qué es la plataforma

Toka User Platform centraliza la gestión de usuarios, sus roles y permisos, el registro de auditoría de todo lo que ocurre en el sistema y un Asistente IA que responde dudas sobre políticas y sobre los datos que cada persona tiene permiso de ver.

Cada sección del menú solo aparece si tu sesión tiene el permiso necesario. Si no ves una sección, no tienes ese permiso (consulta la política de roles y permisos).

## Crear una cuenta e iniciar sesión

1. En la pantalla de inicio de sesión, elige **Crear cuenta**.
2. Escribe nombre, apellido, correo y una contraseña que cumpla la política de contraseñas.
3. Al terminar, vuelve a la pantalla de inicio de sesión y entra con tu correo y contraseña.

Las cuentas nuevas reciben el rol `USER`, que solo da acceso al Asistente IA y a tu propio perfil.

## Inicio

La página de inicio muestra un acceso directo a cada sección que tienes disponible.

## Usuarios (requiere `users:read`)

- **Buscar:** el buscador filtra por nombre o correo mientras escribes.
- **Filtrar por estado:** `Activo` o `Inactivo`.
- **Paginación:** 20 usuarios por página por defecto.

Con `users:write` además puedes:

- **Crear usuario:** botón **Nuevo usuario**. Se piden nombre, apellido, correo y contraseña inicial. El usuario recibe el rol `USER`.
- **Editar:** solo se pueden cambiar nombre y apellido. El correo no se puede modificar.
- **Desactivar:** el usuario deja de poder iniciar sesión y se cierran todas sus sesiones activas. Se pide confirmación.
- **Reactivar:** devuelve el acceso. El usuario debe iniciar sesión de nuevo.

Desactivar no borra al usuario ni su historial de auditoría. La plataforma no permite eliminar usuarios definitivamente.

## Roles (requiere `roles:read`)

- **Catálogo de roles:** lista de roles con sus permisos.
- **Roles por usuario:** elige un usuario para ver sus roles.

Con `roles:write` además puedes asignar un rol a un usuario o quitárselo. Recuerda que el último `ADMIN` no se puede quitar y que el usuario debe volver a iniciar sesión para ver el cambio.

## Auditoría (requiere `audit:read`)

- **Filtros:** tipo de evento, usuario que realizó la acción y rango de fechas.
- **Tarjetas de estadísticas:** total de eventos, inicios de sesión fallidos y eventos por tipo en el rango elegido.

Tipos de evento más comunes:

| Evento | Significado |
|---|---|
| `auth.user.registered` | Se creó una credencial (registro o alta por administrador). |
| `auth.login.succeeded` / `auth.login.failed` | Inicio de sesión correcto / fallido. |
| `auth.login.locked` | Cuenta bloqueada por intentos fallidos. |
| `user.created` / `user.updated` | Alta o edición de un perfil. |
| `user.deactivated` / `user.activated` | Desactivación o reactivación. |
| `role.assigned` / `role.revoked` | Asignación o retiro de rol. |
| `role.created` / `role.permissions.updated` | Alta de rol o cambio de sus permisos. |
| `ai.query.completed` | Consulta al Asistente IA (solo métricas, nunca el texto de la pregunta). |

Los registros de auditoría se conservan **365 días**.

## Asistente IA (requiere `ai:use`)

El asistente responde en español sobre:

- Las políticas de la plataforma (roles, contraseñas, uso, soporte), citando el documento de donde sale la respuesta.
- Datos del sistema **que tú ya puedes ver**: por ejemplo, un `MANAGER` puede pedir "usuarios inactivos" o "resumen de auditoría de esta semana". Un `USER` no puede, porque no tiene esos permisos.

Cada respuesta muestra las fuentes consultadas, las herramientas usadas, la latencia, los tokens, el costo estimado y una puntuación de calidad.

Límites:

- **5 preguntas por minuto** por usuario. Si lo superas, espera unos segundos.
- Mensajes de hasta 2000 caracteres.
- El asistente **no ejecuta acciones**: no crea usuarios, no asigna roles ni desactiva cuentas. Solo consulta.
- Si en un momento de alta demanda el modelo no está disponible, el asistente responde en **modo degradado** mostrando los fragmentos de documentación más relevantes sin redactar una respuesta.

## Cerrar sesión

Usa **Cerrar sesión** en el menú de usuario. Cerrar la pestaña no cierra la sesión: se mantiene hasta 7 días mientras no cierres sesión.
