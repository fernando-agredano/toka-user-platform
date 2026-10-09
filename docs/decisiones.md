# Decisiones técnicas (ADRs cortos)

## Fase 2

### 1. Cliente Prisma generado por servicio
Con tres servicios Prisma en un monorepo, el cliente por defecto (`node_modules/.prisma/client`) se pisaría. Cada servicio genera el suyo en `services/<svc>/generated/prisma-client` (ignorado por git) y lo importa con ruta relativa. `npm run build` ejecuta `prisma generate` antes de `tsc`.

### 2. Outbox relay genérico en `@toka/common`
`OutboxRelayService` recibe un `OutboxDatabase` estructural (`$transaction`, `$queryRawUnsafe`, `$executeRawUnsafe`) en lugar de depender de un cliente Prisma concreto. Así auth, user y role reutilizan el mismo relay (`FOR UPDATE SKIP LOCKED`, cada 1 s) y solo definen su tabla `outbox_events` con las mismas columnas (`id, type, payload, created_at, published_at`).

### 3. Ampliaciones menores a `@toka/common`
Se añadieron `config/` (helpers de env), `bootstrap.ts` (`configureApp`: helmet, pipes, filtro, CORS, prefijo, shutdown hooks; evita repetir `main.ts` en 5 servicios) y `RedisModule` (dentro de `auth/`, porque el guard JWT lo necesita para la blacklist). Variable nueva opcional: `CORS_ORIGINS` (default `http://localhost:8080`).

### 4. Errores de dominio reconocidos por forma
El dominio no puede importar Nest ni `@toka/common`, así que `ProblemDetailsFilter` identifica un error de dominio por `code` (string) + `kind` (`validation | unauthorized | forbidden | not_found | conflict | too_many_requests | unavailable`) y lo mapea a HTTP.

### 5. Desvío del contrato: reactivación de credenciales (`auth.user-activated`)
CONTEXTO solo pide consumir `user.deactivated` (revocar refresh tokens). Sin más, un usuario desactivado podría volver a iniciar sesión. Se añadió `Credential.active`: `user.deactivated` revoca tokens y desactiva la credencial (login → 403); `user.activated` la reactiva, con una cola nueva `auth.user-activated`. **Fase 4**: incluirla en `rabbitmq/definitions.json`.

### 6. Colas: argumentos que deben coincidir
`BaseConsumer` declara su cola con `durable: true` y `x-dead-letter-exchange: toka.dlx`. Las definiciones de RabbitMQ (Fase 4) deben declarar las colas con exactamente esos argumentos, o el `assertQueue` fallará por `PRECONDITION_FAILED`. Reintentos: 3 intentos con espera creciente (reencolado con header `x-attempts`) y luego `nack` → DLX → `toka.dlq`.

### 7. Contratos asumidos con otros servicios (a respetar en Fase 3)
- `user.deactivated` / `user.activated`: `data.userId` con el id del usuario afectado.
- role-service `GET /api/roles/internal/users/:id/permissions` responde `{ roles: string[], permissions: string[] }` y, para un usuario sin asignaciones todavía, devuelve listas vacías (no 404): un login inmediatamente después del registro puede adelantarse al evento que asigna `USER`.
- `POST /api/auth/internal/credentials` (header `x-internal-key`): `{ email, password, firstName, lastName, userId? }` → `{ userId }`. También publica `auth.user.registered` (así role-service asigna `USER`); el consumidor de user-service debe ser idempotente si el perfil ya existe.

### 8. Refresh tokens y lockout
- Refresh opaco de 32 bytes; en Redis solo se guarda su SHA-256. Rotación en cada uso; si se presenta un token ya rotado se asume robo y se revocan todas las sesiones del usuario.
- El lockout cuenta por **email** (no por IP): frena la adivinación distribuida, con el trade-off de que alguien puede bloquear 15 min un email conocido.
- Login resuelve permisos (role-service/caché) *antes* de crear el refresh token, así un 503 no deja estado a medias. El fallback usa la caché `auth:permissions:{userId}` (TTL 1 h).

### 9. Límites conocidos
- Tras `user.deactivated`, los access tokens ya emitidos siguen válidos hasta 15 min (no hay índice jti→usuario para revocarlos).
- La invalidación de la caché de permisos de auth ante `role.*` (CONTEXTO §6) queda para la Fase 3, cuando existan esos eventos.
- Casos de uso y DTOs usan decoradores de Nest (`@Injectable`, class-validator) en `application/`; la regla "sin Nest" se aplica estrictamente solo a `domain/`.
- El workspace `frontend` se añadirá a `workspaces` en la Fase 6. Node local es 20; Docker usa 22 (`engines: >=20`).
