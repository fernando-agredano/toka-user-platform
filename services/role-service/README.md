# role-service

Contexto **Authorization** (puerto interno `3003`, expuesto vía gateway en `/api/roles*`).

Gestiona roles, permisos y asignaciones por usuario. Es la fuente de verdad de "qué puede hacer cada usuario".

## Datos y dependencias

- **PostgreSQL `role_db`**: roles, permisos (`role_permissions`), asignaciones (`user_roles`) y `outbox_events`.
- **Redis**: caché de permisos `perms:{userId}` con TTL de 600 s.

## Roles semilla

| Rol | Permisos |
|---|---|
| `ADMIN` | todos (inmutable) |
| `MANAGER` | `users:read`, `users:write`, `roles:read`, `audit:read`, `ai:use` |
| `USER` | `ai:use` |

Invariante: nunca se puede quitar el último `ADMIN` (`FOR UPDATE` en el repositorio para cerrar la concurrencia).

## Endpoints principales

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/roles` | `roles:read` |
| POST | `/api/roles` | `roles:write` |
| PUT | `/api/roles/:id/permissions` | `roles:write` |
| GET | `/api/roles/users/:userId` | `roles:read` o el propio usuario |
| POST | `/api/roles/users/:userId/assign` | `roles:write` |
| DELETE | `/api/roles/users/:userId/roles/:roleId` | `roles:write` |
| GET | `/api/roles/internal/users/:userId/permissions` | interno (`x-internal-key`), bloqueado en el gateway |

## Eventos

- Publica `role.created`, `role.assigned`, `role.revoked`, `role.permissions.updated`.
- Consume `auth.user.registered` y asigna el rol `USER`.

## Estructura

```
src/
  domain/              Role, RoleName, Permission (catálogo), errores de dominio y puerto RoleRepository
  application/         casos de uso (crear, asignar, revocar, permisos, autorización, seed) y puertos
  infrastructure/      Prisma, Redis, consumer de auth.user.registered, seed de roles
  presentation/        RolesController e InternalAuthorizationController
```

## Tests

```bash
npm test -w services/role-service -- --coverage
```

Ver también [la guía DDD](../../docs/02-ddd-clean-architecture.md) (sección de invariantes).
