# user-service

Contexto **User Management** (puerto interno `3002`, expuesto vía gateway en `/api/users*`).

Gestiona el perfil de usuario: alta, edición, activación y desactivación. Es dueño de los datos personales; las credenciales viven en auth-service.

## Datos y dependencias

- **PostgreSQL `user_db`**: perfiles y `outbox_events`.
- **Redis**: caché `user:{id}` con TTL de 300 s, invalidada en cada escritura.
- **auth-service** (REST, con breaker): crea las credenciales cuando un admin da de alta un usuario.

## Endpoints principales

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/users?page&limit&search&status` | `users:read` |
| GET | `/api/users/me` | autenticado |
| GET | `/api/users/:id` | `users:read` o el propio usuario |
| POST | `/api/users` | `users:write` |
| PATCH | `/api/users/:id` | `users:write` o el propio usuario (solo nombres) |
| POST | `/api/users/:id/deactivate` · `/activate` | `users:write` |

## Eventos

- Publica `user.created`, `user.updated`, `user.deactivated`, `user.activated`.
- Consume `auth.user.registered` y crea el perfil (estado `ACTIVE`).

## Estructura

```
src/
  domain/              User, Email, PersonName, eventos y puerto UserRepository
  application/         casos de uso (create, get, list, update, change status, register profile) y puertos
  infrastructure/      Prisma, Redis, cliente a auth-service, consumer de auth.user.registered
  presentation/        UsersController
```

## Tests

```bash
npm test -w services/user-service -- --coverage
```

Ver también [la guía DDD](../../docs/02-ddd-clean-architecture.md), en particular el recorrido completo de `CreateUserUseCase`.
