# auth-service

Contexto **Identity & Access** (puerto interno `3001`, expuesto vía gateway en `/api/auth/*`).

Registra credenciales, emite y rota tokens JWT RS256, revoca sesiones y publica las llaves públicas (JWKS) que usan los demás servicios para validar tokens sin llamar a auth en cada petición.

## Datos y dependencias

- **PostgreSQL `auth_db`**: credenciales (argon2) y `outbox_events`.
- **Redis**: refresh tokens, blacklist de `jti`, contador de intentos fallidos (lockout) y caché de permisos.
- **role-service** (REST, con breaker): permisos en el login. Si no responde, usa la caché; sin caché responde `503`.

## Endpoints principales

| Método | Ruta | Auth |
|---|---|---|
| POST | `/api/auth/register` | público |
| POST | `/api/auth/login` | público |
| POST | `/api/auth/refresh` | cookie `refresh_token` |
| POST | `/api/auth/logout` | JWT |
| GET | `/api/auth/.well-known/jwks.json` | público |

## Eventos

- Publica `auth.user.registered`, `auth.login.succeeded`, `auth.login.failed`, `auth.login.locked`.
- Consume `user.deactivated` (revoca los refresh tokens del usuario) y `role.*` (invalida la caché de permisos).

## Estructura

```
src/
  domain/              Credential, Password, Email, eventos y puerto CredentialRepository
  application/         casos de uso (register, login, refresh, logout, ...) y puertos
  infrastructure/      Prisma, Redis, argon2, jose, cliente HTTP a role-service, consumers
  presentation/        AuthController y controlador interno de credenciales
```

## Tests

```bash
npm test -w services/auth-service -- --coverage
```

Ver también [la guía DDD](../../docs/02-ddd-clean-architecture.md) y [decisiones](../../docs/decisiones.md) (Fase 2).
