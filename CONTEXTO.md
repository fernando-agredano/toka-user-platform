# CONTEXTO MAESTRO – Prueba Técnica Toka (Senior Full-Stack IA)

> Este documento es la fuente de verdad. Todo código generado DEBE respetar estos contratos.
> Si algo no está aquí, decide lo más simple y consistente con lo existente, y anótalo en `docs/decisiones.md`.

## 1. Stack (fijo)

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 22 LTS, TypeScript estricto (`strict: true`) |
| Framework | NestJS 10 |
| Monorepo | npm workspaces (`packages/*`, `services/*`, `frontend`) |
| ORM SQL | Prisma 5 → PostgreSQL 16 (una base de datos por servicio) |
| ODM | Mongoose 8 → MongoDB 7 (audit, métricas IA) |
| Caché | Redis 7 (`ioredis`) |
| Mensajería | RabbitMQ 3.13 (`amqplib`), exchange topic `toka.events` + DLX `toka.dlx` |
| Vector DB | Qdrant 1.12 (`@qdrant/js-client-rest`) |
| Embeddings | Local: `@huggingface/transformers`, modelo `Xenova/all-MiniLM-L6-v2` (384 dims, costo $0) |
| LLM | Interfaz `LlmProvider`: `GeminiProvider` (default, `@google/genai`, `gemini-2.5-flash-lite`), `OllamaProvider` (opcional), `MockProvider` (tests / sin key) |
| Auth | JWT RS256 firmado por auth-service, validación distribuida vía JWKS (`jose`) |
| Validación | `class-validator` + `class-transformer` (`whitelist`, `forbidNonWhitelisted`) |
| Logging | `pino` + `nestjs-pino`, JSON, con `correlationId` |
| Resiliencia | `opossum` (circuit breaker), timeouts axios 2s, retries con backoff solo en operaciones idempotentes |
| Seguridad | `helmet`, `@nestjs/throttler`, `argon2` para passwords, CORS restringido |
| Health | `@nestjs/terminus` → `GET /health` |
| Tests | Jest + ts-jest, `coverageThreshold` global 70% (branches, functions, lines, statements) |
| Frontend | React 18 + Vite + TypeScript + Redux Toolkit (RTK Query) + react-hook-form + zod + Tailwind |
| Tests front | Jest + React Testing Library + MSW |

## 2. Estructura del repositorio

```
toka-user-platform/
├─ CONTEXTO.md
├─ docker-compose.yml
├─ .env.example
├─ package.json                 # workspaces
├─ docs/
│  ├─ 01-arquitectura.md        # Ejercicio 1
│  ├─ 04-diagnostico.md         # Ejercicio 4
│  ├─ 05-prompt-engineering.md  # Ejercicio 5
│  └─ decisiones.md             # ADRs cortos
├─ infra/
│  ├─ gateway/nginx.conf
│  ├─ postgres/init.sql         # crea auth_db, user_db, role_db
│  └─ rabbitmq/definitions.json # exchanges, colas, bindings, DLQ
├─ packages/
│  └─ common/                   # @toka/common
│     └─ src/{logger,auth,messaging,http,errors,correlation,health}/
├─ services/
│  ├─ auth-service/   (3001)
│  ├─ user-service/   (3002)
│  ├─ role-service/   (3003)
│  ├─ audit-service/  (3004)
│  └─ ai-agent-service/ (3005)
└─ frontend/          (servido por nginx interno, expuesto vía gateway)
```

### Estructura interna de cada servicio (Clean Architecture)

```
src/
├─ domain/            # SIN dependencias de Nest/Prisma/etc.
│  ├─ entities/       # Agregados con invariantes (ej. User.deactivate())
│  ├─ value-objects/  # Email, Password, RoleName, UserId...
│  ├─ events/         # Eventos de dominio
│  ├─ repositories/   # Interfaces (puertos)
│  └─ errors/         # DomainError y subclases
├─ application/
│  ├─ use-cases/      # Un caso de uso por clase, método execute()
│  ├─ dtos/
│  └─ ports/          # Interfaces externas: EventPublisher, Cache, Clock, HttpClients
├─ infrastructure/
│  ├─ persistence/    # Prisma/Mongoose + implementaciones de repositorios + mappers
│  ├─ messaging/      # Publisher/consumers RabbitMQ, outbox relay
│  ├─ cache/
│  └─ http/           # Clientes a otros servicios (con breaker)
├─ presentation/
│  ├─ controllers/
│  ├─ guards/ filters/ interceptors/
├─ app.module.ts
└─ main.ts
test/unit/            # domain + application con repos en memoria
```

Regla de dependencias: `presentation → application → domain`; `infrastructure` implementa puertos de `domain`/`application`. Inyección vía tokens (`USER_REPOSITORY`, etc.).

## 3. Paquete compartido `@toka/common`

- `createLogger()` / `LoggerModule`: pino JSON, campos base: `service`, `level`, `time`, `correlationId`, `msg`. Redacta `password`, `authorization`, `token`.
- `CorrelationIdMiddleware`: lee/crea `x-correlation-id`, lo guarda en AsyncLocalStorage y lo reenvía en HTTP y eventos.
- `JwtAuthGuard` + `@Roles()` / `@Permissions()` + `PermissionsGuard`: valida JWT con `createRemoteJWKSet(AUTH_JWKS_URL)` (cache JWKS), verifica `iss`, `aud`, `exp`; revisa blacklist `jti` en Redis.
- `EventPublisher` (amqplib, confirm channel, persistent) y `BaseConsumer` (ack manual, idempotencia por `eventId`, nack → DLQ tras 3 intentos).
- `ProblemDetailsFilter`: errores RFC 7807 (`type`, `title`, `status`, `detail`, `correlationId`). Nunca exponer stack traces.
- `ResilientHttpClient`: axios + timeout + opossum + propagación de `x-correlation-id` y `Authorization`.

## 4. Servicios y responsabilidades (Bounded Contexts)

| Servicio | Contexto | Datos | Responsabilidad |
|---|---|---|---|
| auth-service | Identity & Access | Postgres `auth_db` (credentials, outbox) + Redis (refresh tokens, blacklist) | Registro de credenciales, login, refresh con rotación, logout, JWKS |
| user-service | User Management | Postgres `user_db` (users, outbox) + Redis (cache) | Perfil de usuario, alta/edición/desactivación |
| role-service | Authorization | Postgres `role_db` (roles, permissions, user_roles, outbox) + Redis (cache permisos) | Roles, permisos, asignaciones |
| audit-service | Audit (CQRS read side) | MongoDB `audit` (audit_logs) | Consume todos los eventos, expone consultas |
| ai-agent-service | AI Assistant | Qdrant (`knowledge_base`) + MongoDB `ai` (ai_metrics, conversations) + Redis (rate limit, cache respuestas) | Agente RAG con tools sobre los demás servicios |

## 5. Contratos HTTP (todo expuesto vía gateway en `http://localhost:8080/api/...`)

Prefijo interno de cada servicio: `/api/<servicio>` (ej. auth-service escucha `/api/auth/*`).

### auth-service
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | /api/auth/register | público | `{email, password, firstName, lastName}` → 201 `{userId}`; publica `auth.user.registered` |
| POST | /api/auth/login | público | `{email, password}` → `{accessToken, expiresIn, user:{id,email,roles,permissions}}` + cookie httpOnly `refresh_token` (path `/api/auth`, SameSite=Strict) |
| POST | /api/auth/refresh | cookie | rota refresh token → nuevo accessToken |
| POST | /api/auth/logout | JWT | revoca refresh, blacklist `jti` hasta `exp` |
| GET | /api/auth/.well-known/jwks.json | público | JWKS |

- Access token: 15 min, claims: `sub, email, roles[], permissions[], jti, iss=toka-auth, aud=toka-api`.
- En login llama SÍNCRONO a role-service `GET /api/roles/internal/users/:id/permissions` (con breaker; fallback: cache Redis; si no hay → 503).
- Bloqueo tras 5 intentos fallidos en 15 min (Redis) → publica `auth.login.locked`.
- Publica `auth.login.succeeded` / `auth.login.failed` (sin password, con IP y userAgent).
- Consume `user.deactivated` → revoca todos los refresh tokens del usuario.
- Llaves RSA: si no existen en `/keys`, se generan al arrancar (volumen `auth-keys`).

### user-service
| Método | Ruta | Permiso |
|---|---|---|
| GET | /api/users?page&limit&search&status | `users:read` |
| GET | /api/users/me | autenticado |
| GET | /api/users/:id | `users:read` o ser el propio usuario |
| POST | /api/users | `users:write` (crea usuario + credenciales vía REST a auth `/api/auth/internal/credentials`) |
| PATCH | /api/users/:id | `users:write` o propio (solo firstName/lastName) |
| POST | /api/users/:id/deactivate | `users:write` |
| POST | /api/users/:id/activate | `users:write` |

- Consume `auth.user.registered` → crea perfil (status ACTIVE).
- Publica `user.created`, `user.updated`, `user.deactivated`, `user.activated`.
- Cache Redis `user:{id}` TTL 300s, invalidación en escritura.

### role-service
| Método | Ruta | Permiso |
|---|---|---|
| GET | /api/roles | `roles:read` |
| POST | /api/roles | `roles:write` `{name, description, permissions[]}` |
| PUT | /api/roles/:id/permissions | `roles:write` |
| GET | /api/roles/users/:userId | `roles:read` o propio |
| POST | /api/roles/users/:userId/assign | `roles:write` `{roleId}` |
| DELETE | /api/roles/users/:userId/roles/:roleId | `roles:write` |
| GET | /api/roles/internal/users/:userId/permissions | interno (header `x-internal-key`) |

- Roles semilla: `ADMIN` (todos), `MANAGER` (`users:read, users:write, roles:read, audit:read, ai:use`), `USER` (`ai:use`).
- Consume `auth.user.registered` → asigna `USER`.
- Invariante: no se puede quitar el último ADMIN.
- Publica `role.assigned`, `role.revoked`, `role.created`, `role.permissions.updated`. Cache `perms:{userId}` TTL 600s.

### audit-service
| Método | Ruta | Permiso |
|---|---|---|
| GET | /api/audit?type&actorId&from&to&page&limit | `audit:read` |
| GET | /api/audit/stats?from&to | `audit:read` (conteo por tipo, logins fallidos) |

- Consume `#` (todos los eventos) en cola `audit.all`. Índice único en `eventId` (idempotencia), índices por `type`, `occurredAt`, `actor.userId`. TTL opcional 365 días.

### ai-agent-service
| Método | Ruta | Permiso |
|---|---|---|
| POST | /api/ai/chat | `ai:use` `{message, conversationId?}` → `{answer, sources[], toolsUsed[], metrics:{latencyMs, inputTokens, outputTokens, costUsd, cached}, quality:{score, checks}}` |
| POST | /api/ai/ingest | `ADMIN` → re-indexa `knowledge/*.md` |
| GET | /api/ai/metrics?from&to | `audit:read` → p50/p95 latencia, tokens, costo total, tasa de cache hit |

- Tools del agente (llaman a servicios con el JWT del usuario, respetando sus permisos): `search_users`, `get_user_roles`, `get_audit_summary`, `search_knowledge_base`.
- Rate limit por usuario (Redis token bucket, 5 req/min) + cola global respetando RPM del proveedor + retry exponencial ante 429 + breaker.
- Cache de respuestas: hash(pregunta normalizada + rol) TTL 1h (solo preguntas sin tools de datos personales).
- Publica `ai.query.completed` (sin contenido de la pregunta, solo métricas).

## 6. Eventos (RabbitMQ)

Exchange `toka.events` (topic, durable). DLX `toka.dlx` → cola `toka.dlq`.

Envelope obligatorio:
```json
{
  "eventId": "uuid",
  "type": "user.deactivated",
  "version": 1,
  "occurredAt": "ISO-8601",
  "correlationId": "uuid",
  "source": "user-service",
  "actor": { "userId": "uuid|null", "ip": "string|null" },
  "data": {}
}
```

| Routing key | Productor | Consumidores (cola) |
|---|---|---|
| auth.user.registered | auth | user (`user.auth-registered`), role (`role.auth-registered`), audit |
| auth.login.succeeded / failed / locked | auth | audit |
| user.created / updated / activated | user | audit |
| user.deactivated | user | auth (`auth.user-deactivated`), audit |
| role.* | role | audit, auth invalida cache de permisos |
| ai.query.completed | ai | audit |

Publicación confiable: **Transactional Outbox** en auth/user/role (tabla `outbox_events`, relay cada 1s con `FOR UPDATE SKIP LOCKED`).

## 7. Gateway (nginx, puerto 8080)

- `/` → frontend
- `/api/auth/` → auth:3001, `/api/users` → user:3002, `/api/roles` → role:3003, `/api/audit` → audit:3004, `/api/ai/` → ai:3005
- Bloquea `/api/*/internal/*` desde fuera (404).
- `limit_req` 20r/s por IP; añade `x-correlation-id` si no viene (`$request_id`).

## 8. Variables de entorno (`.env.example`)

```
NODE_ENV=development
LOG_LEVEL=info
POSTGRES_USER=toka
POSTGRES_PASSWORD=toka_dev_pwd
MONGO_URI=mongodb://mongo:27017
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://toka:toka_dev_pwd@rabbitmq:5672
QDRANT_URL=http://qdrant:6333
AUTH_JWKS_URL=http://auth-service:3001/api/auth/.well-known/jwks.json
JWT_ISSUER=toka-auth
JWT_AUDIENCE=toka-api
INTERNAL_API_KEY=change_me_internal
LLM_PROVIDER=gemini            # gemini | ollama | mock
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite
LLM_RPM_LIMIT=8
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:3b
SEED_ADMIN_EMAIL=admin@toka.local
SEED_ADMIN_PASSWORD=Admin123!
```

Si `GEMINI_API_KEY` está vacío, el servicio arranca con `MockProvider` y lo registra con un log de advertencia.

## 9. Convenciones

- IDs: UUID v4. Fechas: ISO-8601 UTC.
- Seed: el usuario admin usa un UUID fijo `00000000-0000-4000-8000-000000000001` en auth, user y role.
- Paginación: `{ items, page, limit, total }`.
- Passwords: mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.
- Nunca loguear passwords, tokens ni prompts completos con PII.
- Commits: Conventional Commits.
- Cada servicio: `Dockerfile` multi-stage (`node:22-alpine`, usuario no-root, `HEALTHCHECK`), `jest.config.ts` con threshold 70%.

## 10. Fases y modelo

| # | Fase | Modelo |
|---|---|---|
| 0-1 | CONTEXTO + Ejercicio 1 | Opus ✅ |
| 2 | Monorepo, `@toka/common`, auth-service | Sonnet |
| 3 | user-service + role-service | Sonnet |
| 4 | audit-service, infra (nginx, init.sql, rabbit definitions), compose funcional | Sonnet |
| 5 | Tests backend ≥70% | Haiku (Sonnet si se atora) |
| 6 | Frontend | Sonnet |
| 7 | Tests frontend | Haiku |
| 8 | Diseño IA: prompts, RAG, evaluación (`docs/05-prompt-engineering.md`) | Opus |
| 9 | Implementación ai-agent-service | Sonnet |
| 10 | Ejercicio 4 (diagnóstico) | Sonnet |
| 11 | READMEs | Haiku |
| 12 | Revisión final contra rúbrica | Opus |

## 11. MCP Server (módulo extra)

Servidor Model Context Protocol (`@modelcontextprotocol/sdk` 1.x) que expone la plataforma a asistentes de IA (Claude Desktop, Claude Code, Cursor). No es requisito de la prueba. Detalle en `docs/06-mcp-server.md`.

| Servicio | Contexto | Datos | Responsabilidad |
|---|---|---|---|
| mcp-server (3006) | AI Integration | Redis (rate limit); sin BD propia | Traduce llamadas MCP a llamadas REST con el JWT del usuario |

- **Transportes:** Streamable HTTP sin sesión (`POST /mcp`, puerto 3006, expuesto en el gateway como `/mcp` con `proxy_buffering off`) y stdio (`dist/stdio.js`, para uso local; usa `TOKA_ACCESS_TOKEN` y `TOKA_API_URL`).
- **Auth:** `Authorization: Bearer <JWT>` validado con JWKS (`JwtVerifier` de `@toka/common`, incluye blacklist). Cada tool reenvía ese mismo JWT; el servicio dueño del dato decide.
- **Tools de lectura** (`readOnlyHint`): `search_users` (users:read), `get_user` (users:read), `get_user_roles` (roles:read), `list_roles` (roles:read), `get_audit_events` (audit:read), `get_audit_stats` (audit:read), `ask_knowledge_base` (ai:use, usa `POST /api/ai/chat`).
- **Tools de escritura:** `assign_role` (roles:write), `activate_user` (users:write); destructivas (`destructiveHint`) `revoke_role` (roles:write) y `deactivate_user` (users:write): exigen `confirm: true`, sin él devuelven una vista previa y no cambian nada.
- **Resources:** `toka://docs/{nombre}` (documentos de `services/ai-agent-service/knowledge`) y `toka://me` (perfil, roles y permisos del usuario).
- **Prompts:** `security-review` (argumento opcional `hours`, 24 por defecto) y `access-audit`.
- **Gobierno:** cada invocación publica `mcp.tool.invoked` (`data`: `tool`, `arguments` redactados, `outcome` = `success|preview|error|denied|rate_limited`, `errorKind?`, `durationMs`, `userId`, `transport`; `actor` con `userId` e `ip`) consumido por audit-service; rate limit 30 llamadas/min por usuario en Redis (`mcp:rl:{userId}`); los errores se devuelven como resultado MCP con `isError: true`, sin stack traces.
- **Variables:** `PORT=3006`, `USER_SERVICE_URL`, `ROLE_SERVICE_URL`, `AUDIT_SERVICE_URL`, `AI_SERVICE_URL` (o un único `TOKA_API_URL` fuera de Docker), `MCP_RATE_LIMIT_PER_MINUTE=30`, `MCP_ALLOWED_ORIGINS`, `KNOWLEDGE_DIR`.
