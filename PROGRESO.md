# Progreso

## Estado de fases

- [x] Fase 0-1 – CONTEXTO + Arquitectura (Opus)
- [x] Fase 2 – Monorepo + common + auth-service
- [x] Fase 3 – user-service + role-service
- [x] Fase 4 – audit-service + infra + compose funcional
- [x] Fase 5 – Tests backend ≥70%
- [x] Fase 6 – Frontend
- [x] Fase 7 – Tests frontend (Haiku)
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

### Fase 6

- Entregado: `frontend/` (React 18 + Vite + TS estricto + Redux Toolkit/RTK Query + react-hook-form + zod + Tailwind, con tokens del design system y modo oscuro). Páginas: Login, Registro, Inicio, Usuarios (búsqueda con debounce, filtro de estado, paginación, crear, editar, activar/desactivar con confirmación), Roles (catálogo, asignar y quitar por usuario), Auditoría (filtros + tarjetas de stats + eventos por tipo) y Asistente IA (chat con respuesta, fuentes, herramientas, métricas y calidad; aviso claro mientras el servicio no exista). Rutas protegidas por permiso, skeletons, toasts con el `detail` de ProblemDetails y toasts de éxito. `frontend/Dockerfile` multi-stage (node → nginx-unprivileged, no-root, HEALTHCHECK), `frontend` activo en el compose y el gateway; `/api/` desconocido ahora responde 404.
- Verificado: `npm run build` (tsc estricto + vite) y `biome check` sin errores en el frontend; el stack completo queda healthy y `localhost:8080` sirve el SPA con fallback de rutas, CSP y cabeceras. Recorrido real en Chrome headless contra el gateway: login inválido (toast con detail) → login → las 4 secciones con datos reales → recarga restaura la sesión por cookie → logout. Refresh automático: con 401 forzado en dos peticiones simultáneas sale **un solo** `/auth/refresh`, ambas se reintentan y la UI se recupera sin toasts; con refresh fallido vuelve a `/login`. También en navegador: contraseña débil bloqueada en cliente, crear/editar/desactivar/reactivar usuario y asignar/quitar rol (con el usuario de prueba `e2e…@toka.local` que quedó en la BD de desarrollo). No hay tests automatizados todavía (Fase 7).
- Decisiones: `docs/decisiones.md` (Fase 6, §24-30). Desvíos del contrato: el frontend **no** es workspace de npm (rompería el `npm ci` de los Dockerfiles de servicios); el nginx del frontend escucha en 8080 y el gateway apunta a `frontend:8080`.
- Cómo explicarlo en la entrevista: el access token solo vive en memoria y la sesión se restaura con la cookie httpOnly de refresh, evitando XSS sobre el token; como el refresh rota y su reutilización se trata como robo, el cliente comparte una única promesa de refresh entre peticiones concurrentes (lo probé forzando dos 401 a la vez); los errores del backend llegan como RFC 7807 y un solo listener los convierte en toasts, así que ninguna pantalla repite manejo de errores; los permisos en la UI son solo UX y una única tabla de navegación alimenta sidebar, inicio y guards; la página del asistente se construyó contra el contrato antes de que exista el servicio y degrada con un aviso en vez de romper.

### Fase 7

- Entregado: Jest 30 + React Testing Library + MSW 2 en `frontend/` (`jest.config.mjs`, `tsconfig.test.json`, `test/` con setup, servidor MSW, render con providers reales y fixtures). 26 tests en 5 suites: login (validación sin petición, sesión en el store, detail de ProblemDetails y error sin cuerpo), registro (validación y requisitos de contraseña, éxito con redirección, correo duplicado), slice de auth (reducers y selectores), lista de usuarios (esqueleto de carga, datos, error con reintento, vacío, acciones según `users:write`) y guard `RequirePermission` (permitido, denegado, reacción a cambios de sesión y a logout). Scripts: `npm test`, `npm run test:coverage`, `npm run typecheck:test`.
- Verificado: `npm test` 26/26; `npm run lint` y `typecheck:test` sin errores; `npm run build` correcto. Cobertura global 74.9 % de statements (incluye componentes fuera del alcance); login, registro y slice de auth al 100 %, lista de usuarios al 67 %.
- Decisiones: `docs/decisiones.md` (Fase 7, §31-36). Desvíos: `@swc/jest` en lugar de ts-jest porque MSW 2.x trae dependencias solo ESM; MSW fijado a 2.15.0 (3.x tiene menos de dos semanas); `jest-fixed-jsdom` para exponer `fetch` de Node en jsdom. Sin umbral de cobertura global.
- Deuda declarada: el refresh single-flight de `base-query.ts` y los guards `RequireAuth`/`GuestOnly` no tienen tests todavía. Es la siguiente prioridad por ser el flujo de sesión más sensible.
- Cómo explicarlo en la entrevista: los formularios se prueban contra HTTP real simulado con MSW, así que el test verifica el contrato y el mensaje que llega del servidor, no un mock de hooks; la validación de cliente con zod se verifica por ausencia de peticiones; la protección de rutas se prueba como estado, reaccionando a `sessionStarted` y `sessionCleared` en vez de simular el router; y la cobertura se reporta por flujo crítico, no como número global.

## Pendientes / notas

- Fase 9: descomentar `ai-agent-service` en el compose y en el `depends_on` del gateway, y añadir su `location /api/ai/` + upstream en nginx.conf (hoy `/api/ai/*` responde 404). Revisar que `sources[]`, `quality.checks` y `conversationId` coincidan con los tipos de `frontend/src/@types/api.ts` (ver `docs/decisiones.md` §29).
- El frontend no está en los workspaces: su CI (Fase 12/ci-cd) debe tener un job propio con `cd frontend && npm ci && npm run lint && npm run typecheck:test && npm test && npm run build`.
- Cobertura de servicios sobre `src/**` completo: pendiente decidir si el umbral debe medir también presentación e infraestructura (ver `docs/coverage.md`). Hoy la infraestructura de audit solo se prueba con el stack real.
- El puerto 3001 de esta máquina estaba ocupado por otro proceso durante el smoke test (se usó 13001); no afecta a Docker.
