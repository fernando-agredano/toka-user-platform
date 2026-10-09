# Progreso

## Estado de fases

- [x] Fase 0-1 – CONTEXTO + Arquitectura (Opus)
- [x] Fase 2 – Monorepo + common + auth-service
- [x] Fase 3 – user-service + role-service
- [x] Fase 4 – audit-service + infra + compose funcional
- [x] Fase 5 – Tests backend ≥70%
- [ ] Fase 6 – Frontend
- [ ] Fase 7 – Tests frontend
- [ ] Fase 8 – Diseño IA
- [ ] Fase 9 – ai-agent-service
- [ ] Fase 10 – Ejercicio 4 (diagnóstico)
- [ ] Fase 11 – Documentación
- [ ] Fase 12 – Revisión final

## Bitácora

### Fase 0-1

- Entregado: CONTEXTO.md, CLAUDE.md, docs/01-arquitectura.md, docker-compose.yml base.
- Decisiones: NestJS + Prisma, JWT RS256 con JWKS, outbox, Gemini free tier con adaptador LlmProvider, embeddings locales.
- Cómo explicarlo en la entrevista: arquitectura por bounded contexts; validación distribuida de JWT sin llamar a auth en cada request; outbox para no perder eventos; IA con costo cero en embeddings y degradación controlada ante rate limits.

### Fase 2

- Entregado: raíz del monorepo (workspaces, tsconfig.base, .env.example, .gitignore, .dockerignore); `packages/common` (logger pino + correlationId, JwtAuthGuard/Roles/Permissions/InternalApiKeyGuard, EventPublisher, BaseConsumer, OutboxRelayService, ProblemDetailsFilter, ResilientHttpClient, health, `configureApp`); `services/auth-service` completo (dominio, casos de uso, Prisma + migración + outbox, JWKS con llaves autogeneradas, lockout en Redis, cliente a role-service con breaker + fallback a caché, consumers, seed admin, Dockerfile multi-stage, jest 70%).
- Verificado: `npm run build` y `npm test` (common 16 tests, auth-service 43 tests, coverage auth 95%). Smoke test real con Postgres/Redis/RabbitMQ: register → login → refresh → logout (blacklist) → lockout 429 → consumer `user.deactivated` (idempotente) → imagen Docker corriendo como usuario `node`.
- Decisiones: ver `docs/decisiones.md` (Fase 2). Desvío del contrato: cola extra `auth.user-activated` y `Credential.active`.
- Cómo explicarlo en la entrevista: la validación del JWT es distribuida (cada servicio usa el JWKS de auth con caché, sin llamarlo por request) y el logout se resuelve con blacklist de `jti` en Redis; el refresh rota en cada uso y detecta reutilización; los eventos salen por transactional outbox con relay `SKIP LOCKED`, así que un fallo de RabbitMQ nunca pierde ni duplica la escritura; si role-service cae, el breaker abre y el login degrada a permisos cacheados (o 503 explícito); `domain` no conoce Nest ni Prisma y los casos de uso se prueban con repos en memoria.

### Fase 3

- Entregado: `services/user-service` (dominio User/Email/PersonName, casos de uso crear/leer con caché/listar/editar/activar-desactivar/registrar perfil/seed, Prisma + migración + outbox, gateway a auth con breaker, consumer `user.auth-registered`, controller con permisos y «propio o permiso») y `services/role-service` (Role/RoleName/catálogo de permisos, casos de uso crear/permisos/asignar/revocar/autorización/seed, Prisma + migración + outbox, caché `perms:{id}`, endpoint interno, consumer `role.auth-registered`). Ambos con Dockerfile multi-stage y jest 70%. Extras: `assertSelfOrPermission` en `@toka/common`, y en auth-service el consumer `auth.role-changed` que invalida su caché de permisos; `SEED_ADMIN_EMAIL` añadido a user-service en el compose.
- Verificado: `npm run build` y `npm test` en todo el monorepo (user 33 tests / 99% coverage, role 32 tests / 99%, auth 45, common 19). Repositorios Prisma probados contra Postgres 16 real (migraciones, seed concurrente, upsert, unicidad, búsqueda, último admin bajo lock). Imágenes Docker de user y role construyen. No probado de extremo a extremo con RabbitMQ/Redis ni el stack completo (falta infra de Fase 4).
- Decisiones: `docs/decisiones.md` (Fase 3, §10-18). Desvíos del contrato: cola extra `auth.role-changed`; permisos en tabla `role_permissions`; `POST …/assign` y `DELETE …/roles/:roleId` responden 204.
- Cómo explicarlo en la entrevista: cada servicio es un bounded context con su BD, y la consistencia entre ellos es por eventos vía outbox, con idempotencia en consumidores; el alta de usuario por admin es una mini-saga (credenciales → perfil) que se autocura porque auth publica `auth.user.registered`; el invariante «no quitar el último ADMIN» es regla de dominio, pero la concurrencia se cierra con un `SELECT … FOR UPDATE` en el repositorio; las mutaciones devuelven si cambió el estado, así reintentos no generan eventos duplicados; la caché de permisos no guarda vacíos porque el rol USER llega de forma asíncrona.

### Fase 4

- Entregado: `services/audit-service` (dominio `AuditEntry` con redacción de secretos, casos de uso registrar/buscar/estadísticas, repositorio Mongoose con índices y TTL opcional, consumidor `audit.all` con binding `#`, `GET /api/audit` y `/api/audit/stats` con `audit:read`, Dockerfile, jest 70%); `infra/postgres/init.sql`, `infra/rabbitmq/definitions.json` (exchanges, DLX, 7 colas + DLQ, bindings) e `infra/gateway/nginx.conf`; `frontend` y `ai-agent-service` comentados en el compose.
- Verificado: build y tests de todo el monorepo (audit 7 tests, ~100% coverage). `docker compose up -d --build` deja los 5 servicios healthy. Flujo real a través del gateway: register → login (roles USER, `ai:use`) → `GET /api/users/me` → 403 en `/api/audit` para un USER → login admin → `/api/audit` y `/stats` muestran `auth.user.registered`, `role.assigned`, `user.created`, `auth.login.succeeded/failed`; `/api/roles/internal/*` → 404; JWKS → 200; `/` → 502 hasta que exista el frontend.
- Decisiones: `docs/decisiones.md` (Fase 4, §19-23). Correcciones de fases previas: `HEALTHCHECK` con `127.0.0.1` (IPv6 en Alpine) y `openssl` en el runtime de user y role.
- Cómo explicarlo en la entrevista: audit es el lado de lectura de un CQRS ligero: consume todo con un binding `#` y es idempotente por un índice único, no solo por Redis; las colas se declaran en `definitions.json` con los mismos argumentos DLX que el código, para que el broker nunca rechace una redeclaración; el gateway bloquea `/internal` con una regex y propaga el correlation-id, así que una petición se puede seguir de nginx a los eventos de auditoría; levantar el stack real destapó dos bugs que los tests unitarios no podían ver (healthcheck IPv6 y openssl para Prisma).

### Fase 5

- Entregado: tests unitarios nuevos en `packages/common` (guards y decoradores de roles/permisos, verificador JWT con blacklist, `BaseConsumer` con idempotencia/retry/DLQ, `EventPublisher` con confirms y reconexión, logger con redacción, `configureApp`, health indicator, conexión RabbitMQ, helpers de env). Pasa de 19 a 78 tests y de ~30% a 94% statements. Los servicios ya superaban 70% y no se tocó su código. Reportes HTML en `docs/coverage/` y tabla en `docs/coverage.md`.
- Verificado: `npm run build` de common sin errores; `npm test -- --coverage` en los 5 paquetes pasa el umbral (common 94.21%, auth 99.62%, user 99.56%, role 99.14%, audit 100% statements).
- Decisiones: el umbral solo mide `domain/` y `application/` (y `infrastructure/http` en algunos servicios). Medido sobre `src/**` completo, auth queda en 48%, audit en 52%, role en 64% y user en 67%. No se cambió la configuración; queda como decisión pendiente (`docs/coverage.md`).
- Cómo explicarlo en la entrevista: el 70% se mide sobre el dominio y los casos de uso, que es donde un bug cuesta datos; la idempotencia y la DLQ del consumidor se prueban con mocks del canal AMQP, no solo en el stack real; la cobertura alta no oculta el alcance: documentamos qué quedó fuera y por qué, en lugar de subir el número con tests de Prisma o Mongoose contra mocks.

## Pendientes / notas

- Fase 6: al crear `frontend/Dockerfile`, descomentar `frontend` en el compose y en el `depends_on` del gateway. Fase 9: lo mismo con `ai-agent-service` y su `location /api/ai/` + upstream en nginx.conf.
- Cobertura de servicios sobre `src/**` completo: pendiente decidir si el umbral debe medir también presentación e infraestructura (ver `docs/coverage.md`). Hoy la infraestructura de audit solo se prueba con el stack real.
- El puerto 3001 de esta máquina estaba ocupado por otro proceso durante el smoke test (se usó 13001); no afecta a Docker.
