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

## Fase 3

### 10. Creación de usuario por admin: credenciales primero, perfil después
`POST /api/users` valida el email contra la BD local (falla rápido), crea las credenciales en auth (`/internal/credentials`, sin reintentos al no ser idempotente) y luego guarda el perfil + `user.created`. Si el guardado falla, auth ya publicó `auth.user.registered` y el consumidor de user-service crea el perfil (autocuración). Si el consumidor gana la carrera, `CreateUserUseCase` conserva su perfil y no emite `user.created` dos veces.

### 11. Mutaciones idempotentes sin evento espurio
`User.deactivate/activate/updateProfile` y `Role.replacePermissions` devuelven si el estado cambió; solo entonces se guarda y se publica el evento. Así reintentos de HTTP o de consumidores no ensucian la auditoría. Re-asignar un rol ya asignado es no-op; quitar uno no asignado devuelve 404.

### 12. Último ADMIN: pre-chequeo en el caso de uso + recheck bajo lock
`Role.assertRevocable(holders)` es la regla de dominio. El caso de uso la comprueba (fallo rápido y testeable) y `PrismaRoleRepository.revoke` la repite dentro de una transacción con `SELECT … FOR UPDATE` sobre la fila del rol, de modo que dos revocaciones concurrentes no pueden dejar el sistema sin admin. Verificado contra Postgres real.

### 13. Catálogo cerrado de permisos y ADMIN inmutable
Los permisos válidos son los de CONTEXTO §5 (`users:read|write`, `roles:read|write`, `audit:read`, `ai:use`); un typo en un rol falla con 400 en vez de conceder nada en silencio. Los permisos de `ADMIN` no se pueden modificar (403), para que nadie se auto-bloquee. Añadir permisos nuevos requiere tocar `PERMISSION_CATALOG`. Los nombres de rol se normalizan a mayúsculas (`^[A-Z][A-Z0-9_]{1,49}$`) y son inmutables.

### 14. Permisos: relación en tabla propia y caché sin vacíos
`role_permissions(role_id, permission)` en lugar de un array, para poder consultar y mantener integridad referencial. `GET /internal/users/:id/permissions` devuelve listas vacías (no 404) sin asignaciones; ese resultado **no se cachea** (`perms:{userId}`, TTL 600 s), porque el rol `USER` se asigna de forma asíncrona tras el registro y un vacío cacheado retrasaría los permisos hasta 10 min. La caché se invalida al asignar/revocar (usuario) y al cambiar permisos de un rol (todos sus titulares).

### 15. Semillas sin eventos y orden de arranque
Role-service siembra `ADMIN/MANAGER/USER` y la asignación del admin fijo en `OnModuleInit` (antes de que los consumidores se suscriban en `OnApplicationBootstrap`), para que el primer `auth.user.registered` encuentre el rol `USER`. Nunca pisa roles existentes y tolera réplicas concurrentes (probado con dos seeds en paralelo). User-service siembra el perfil admin (`SEED_ADMIN_EMAIL`, añadido al compose). Ninguna semilla emite eventos, igual que en auth.

### 16. Desvío del contrato: consumer de auth para `role.*`
CONTEXTO §6 pide que auth invalide su caché de permisos ante `role.*`. Se añadió la cola `auth.role-changed` (routing keys `role.assigned`, `role.revoked`, `role.permissions.updated`; `role.created` no afecta a nadie). Con `userId` borra solo ese usuario; sin él (`permissions.updated`) hace `SCAN` + `DEL` de `auth:permissions:*`. Trade-off: tras un cambio de roles no se puede puentear una caída de role-service con permisos antiguos (login → 503), que es lo seguro. **Fase 4**: añadir `auth.role-changed` a `rabbitmq/definitions.json`.

### 17. Utilidad compartida y duplicación consciente
`assertSelfOrPermission` (endpoints «propio o permiso») vive en `@toka/common` porque la usan user y role. `DomainError`, `outbox-record`, `PrismaService` y `PersistenceModule` se replican por servicio (como en auth): el dominio no puede importar `@toka/common` y cada servicio genera su propio cliente Prisma.

### 18. Límites conocidos
- role-service no valida que `userId` exista (no tiene datos de usuarios): asignar roles a un UUID inexistente crea una fila huérfana inocua.
- PATCH de usuario solo cambia `firstName/lastName`; cambiar el email requeriría sincronizar auth y queda fuera de alcance.
- Caché `user:{id}` e invalidación son best-effort: tras `deactivate` otra réplica puede servir hasta una lectura previa a la invalidación (TTL 300 s como cota).

## Fase 4

### 19. Audit-service: idempotencia en dos capas y redacción defensiva
El consumidor `audit.all` (binding `#`) hereda la deduplicación por `eventId` en Redis de `BaseConsumer`, pero la fuente de verdad es el índice único `eventId` en Mongo: un duplicado (código 11000) se trata como éxito (`insert` devuelve `false`). Así sigue siendo idempotente aunque Redis pierda datos. `createAuditEntry` redacta claves sensibles (`password`, `token`, `authorization`…) a cualquier profundidad como defensa en profundidad, aunque los productores ya no las envíen.

### 20. Audit-service: modelo de lectura (CQRS) y retención
Solo escribe un servicio (el consumidor) y solo lee la API; las entradas son inmutables. Índices: `eventId` único, `(type, occurredAt)`, `occurredAt`, `(actor.userId, occurredAt)`. TTL opcional con `AUDIT_RETENTION_DAYS` (default 365, `0` lo desactiva). Cambiar el valor en una colección con índice TTL existente exige recrear el índice. `/api/audit/stats` devuelve `total`, `byType`, `failedLogins` y `lockedAccounts`. Un rango `from > to` responde 400. Mongoose se usa directo (sin `@nestjs/mongoose`) para no añadir una dependencia por una sola conexión.

### 21. Infraestructura declarativa
`definitions.json` declara usuario, exchanges `toka.events`/`toka.dlx` (topic), colas y bindings, incluidas `auth.user-activated` y `auth.role-changed` (desvíos de fases 2 y 3). Todas las colas de consumidores llevan exactamente `x-dead-letter-exchange: toka.dlx`, los mismos argumentos que declara `BaseConsumer`; cualquier diferencia haría fallar el `assertQueue` con PRECONDITION_FAILED. `toka.dlq` se enlaza a `toka.dlx` con `#`.

### 22. Gateway: upstreams estáticos para APIs, resolución perezosa para el frontend
Los upstreams de API se resuelven al arrancar (el `depends_on` del compose los garantiza). `/` usa variable + `resolver 127.0.0.11`, de modo que nginx arranca aunque el frontend no exista todavía (502 hasta la Fase 6). `/api/*/internal/*` devuelve 404 mediante una location regex, que tiene prioridad sobre los prefijos. El `x-correlation-id` entrante se respeta o se genera con `$request_id`, y se devuelve en la respuesta. Se añade `/healthz` propio del gateway.

### 23. Bugs de Docker encontrados al levantar el stack por primera vez
- `HEALTHCHECK` con `wget http://localhost`: en Alpine `localhost` resuelve a `::1` y la app escucha en IPv4, así que quedaba `unhealthy`. Ahora usa `127.0.0.1` en los cuatro servicios.
- Las imágenes runtime de user y role no tenían `openssl` y Prisma no podía ejecutar `migrate deploy`. Se añadió `apk add openssl` al stage runtime.
- `frontend` y `ai-agent-service` están comentados en el compose y en el `depends_on` del gateway hasta las fases 6 y 9.
