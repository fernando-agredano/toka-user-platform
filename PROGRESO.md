# Progreso

## Estado de fases

- [x] Fase 0-1 – CONTEXTO + Arquitectura (Opus)
- [x] Fase 2 – Monorepo + common + auth-service
- [ ] Fase 3 – user-service + role-service
- [ ] Fase 4 – audit-service + infra + compose funcional
- [ ] Fase 5 – Tests backend ≥70%
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

## Pendientes / notas

- Fase 4: añadir la cola `auth.user-activated` a `rabbitmq/definitions.json`; las colas deben llevar el argumento `x-dead-letter-exchange: toka.dlx` (ver decisiones §6).
- Fase 3: role-service debe cumplir los contratos asumidos (decisiones §7) y publicar `role.*`; entonces auth añade el consumer que invalida `auth:permissions:*`.
- Fase 5: `@toka/common` está en ~30% de coverage (guards, JwtVerifier, BaseConsumer, EventPublisher sin tests); `npm test` normal pasa, solo `--coverage` falla el umbral.
- El puerto 3001 de esta máquina estaba ocupado por otro proceso durante el smoke test (se usó 13001); no afecta a Docker.
