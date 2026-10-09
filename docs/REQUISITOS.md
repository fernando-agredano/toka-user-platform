# Checklist de requisitos – Prueba Técnica Toka (Senior Full-Stack IA)

Transcripción de los requisitos y criterios de evaluación del PDF oficial, revisada en la Fase 12.
Cada punto lleva su evidencia (ruta de archivo). «Parcial» indica qué falta y por qué.

## Ejercicio 1 – Arquitectura

Requisitos técnicos
- [x] 3-4+ microservicios independientes (Auth, User, Audit, Role) — `services/{auth,user,role,audit,ai-agent}-service/` (5 servicios)
- [x] Comunicación síncrona (REST) y asíncrona (RabbitMQ) — `docs/01-arquitectura.md` §4; `packages/common/src/http/resilient-http-client.ts`; `packages/common/src/messaging/`
- [x] Estrategia multi-DB: SQL (transaccional), MongoDB (auditoría), Redis (caching) — `docs/01-arquitectura.md` §3; `infra/postgres/init.sql`; `services/audit-service/src/infrastructure/persistence/`
- [x] Microservicio/módulo de IA con RAG en la arquitectura — `services/ai-agent-service/`; diagrama en `docs/01-arquitectura.md` §2
- [x] Ejecutable localmente con Docker Compose — `docker-compose.yml` (13 servicios); verificado en Fases 4, 9 y 11.2 (`PROGRESO.md`)

Entregables
- [x] Diagrama de arquitectura (Mermaid/visual) con todos los microservicios e interacciones — `docs/01-arquitectura.md` §2; embebido en `README.md`
- [x] Justificación de decisiones técnicas — `docs/01-arquitectura.md` §3; `docs/decisiones.md` (§1-51)
- [x] Explicación del flujo de datos entre microservicios — `docs/01-arquitectura.md` §4; `docs/05-integracion.md` §2
- [x] Diseño de docker-compose.yml — `docs/01-arquitectura.md` §9; `docker-compose.yml`
- [x] Explicación de DDD y Clean Architecture — `docs/02-ddd-clean-architecture.md`; `docs/01-arquitectura.md` §5-6

Evaluación
- [x] Claridad y cohesión arquitectónica — un bounded context por servicio, `docs/01-arquitectura.md` §1-2
- [x] Patrones adecuados (DDD, Clean, CQRS si aplica) — `docs/02-ddd-clean-architecture.md`; audit como lado de lectura CQRS (`docs/decisiones.md` Fase 4)
- [x] Seguridad y escalabilidad — `docs/01-arquitectura.md` §7-8; `infra/gateway/nginx.conf` (rate limit, `/internal` bloqueado)
- [x] Comunicación síncrona y asíncrona bien diseñada — outbox `packages/common/src/messaging/outbox-relay.ts`; DLQ `infra/rabbitmq/definitions.json`
- [x] Estrategia multi-DB justificada — `docs/01-arquitectura.md` §3
- [x] Integración de IA en la arquitectura — `docs/05-integracion.md`
- [x] Dockerización completa y funcional — `services/*/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`
- [x] Resiliencia y manejo de fallos entre servicios — breaker en `resilient-http-client.ts`; `docs/01-arquitectura.md` §8; `docs/04-diagnostico.md` §8 y §10

## Ejercicio 2 – Microservicios

Requisitos técnicos
- [x] 3-4+ microservicios implementados, independientes y dockerizados — `services/*/` con su `Dockerfile` y su base de datos
- [x] REST entre servicios + al menos un flujo asíncrono con RabbitMQ — login → role-service (REST); `auth.user.registered` → user/role/audit (`infra/rabbitmq/definitions.json`)
- [x] DDD y Clean Architecture en cada servicio — `services/*/src/{domain,application,infrastructure,presentation}`
- [x] Autenticación OAuth2/OIDC distribuida (JWT con validación distribuida) — JWT RS256 + JWKS: `packages/common/src/auth/jwt-verifier.service.ts`; `GET /api/auth/.well-known/jwks.json`. Parcial en lo formal: no es un proveedor OIDC completo (sin discovery ni flujos OAuth2), se usa el modelo de tokens de OIDC (`docs/decisiones.md` §52)
- [x] Multi-DB según el diseño — Postgres (auth/user/role), Mongo (audit, IA), Redis, Qdrant
- [x] Dockerfile por servicio + compose que orquesta servicios y dependencias — `services/*/Dockerfile`; `docker-compose.yml` con `depends_on` + healthchecks
- [x] Tests unitarios con coverage ≥ 70% — `docs/coverage.md` (todos ≥ 94 % statements; el umbral mide dominio y aplicación)
- [x] Logging estructurado JSON en cada servicio — `packages/common/src/logger/logger.ts` (pino + `correlationId` + redacción)
- [x] ORM (Prisma / Mongoose) — `services/{auth,user,role}-service/prisma/`; Mongoose en `services/audit-service/src/infrastructure/persistence/`

Entregables
- [x] Código fuente de todos los microservicios — `services/`, `packages/common/`
- [x] Dockerfiles — `services/*/Dockerfile`
- [x] docker-compose.yml funcional — `docker-compose.yml`
- [x] Tests unitarios + coverage report (versionado) — `services/*/test/unit/`; reportes HTML en `docs/coverage/<paquete>/` (los 7 paquetes desde la Fase 12)
- [x] Documentación de cómo ejecutar el sistema completo — `README.md` («Levantar el sistema», «Credenciales y URLs»)
- [x] Explicación de cómo se aplicaron DDD y Clean Architecture — `docs/02-ddd-clean-architecture.md`

Evaluación
- [x] Cumplimiento funcional — flujos E2E por gateway verificados (`PROGRESO.md` Fase 4 y 6)
- [x] Uso correcto de ORM y acceso a datos — repositorios como adaptadores de puertos de dominio; `$transaction` con outbox (`docs/02-ddd-clean-architecture.md` §3)
- [x] Código limpio, seguro, SOLID — casos de uso de una sola responsabilidad, inyección por tokens (`docs/02-ddd-clean-architecture.md` §2, §5)
- [x] DDD y Clean Architecture correctos — reglas de dependencia comprobadas con grep (`docs/02-ddd-clean-architecture.md` §2)
- [x] Comunicación síncrona/asíncrona bien implementada — outbox + `SKIP LOCKED`, consumidores idempotentes con DLQ (`packages/common/src/messaging/base-consumer.ts`)
- [x] Independencia y desacoplamiento — una BD por servicio; sin imports entre servicios (solo `@toka/common`)
- [x] Autenticación distribuida funcionando — cada servicio valida con JWKS en caché; blacklist de `jti` en Redis
- [x] Coverage adecuado — `docs/coverage.md`. Matiz declarado: sobre `src/**` completo los servicios quedan entre 48 % y 67 %
- [x] Dockerización funcional — multi-stage, no-root, `HEALTHCHECK`
- [x] Logging estructurado — `packages/common/src/logger/logger.ts`
- [x] OWASP: validación de inputs, sanitización — `ValidationPipe` con `whitelist`/`forbidNonWhitelisted`, `helmet` (`packages/common/src/bootstrap.ts`); argon2; throttler; `ProblemDetailsFilter` sin stack traces

## Ejercicio 3 – Front-end

Requisitos técnicos
- [x] React + TypeScript — `frontend/` (React 18, Vite, TS estricto)
- [x] State management (Redux Toolkit) — `frontend/src/api/store.ts`, `auth-slice.ts`, `*.api.ts` (RTK Query)
- [x] Consume los microservicios (vía gateway) — `frontend/src/api/base-query.ts`; `docs/03-frontend.md` §4
- [x] Loading states — skeletons (`docs/img/frontend/`, captura de carga)
- [x] Error states y mensajes — toasts con `detail` de RFC 7807 (`frontend/src/api/toast-slice.ts`)
- [x] Validación de formularios — zod + react-hook-form (`frontend/src/validators/`)
- [x] Feedback visual — toasts de éxito/error, confirmaciones (`docs/03-frontend.md` §5)
- [x] Tests (Jest + React Testing Library) — `frontend/test/` (29 tests, MSW)
- [x] Front incluido en docker-compose.yml — servicio `frontend` + gateway

Entregables
- [x] Código fuente del front — `frontend/src/`
- [x] Configuración de state management — `frontend/src/api/store.ts`; `docs/03-frontend.md` §3
- [x] Tests de componentes y lógica — `frontend/test/pages/`, `test/api/auth-slice.test.ts`, `test/routes/guards.test.tsx`
- [x] Integración con los microservicios — `docs/03-frontend.md` §4 (tabla pantalla → endpoint → servicio)
- [x] Documentación de cómo ejecutar el front — `docs/03-frontend.md` §7; `frontend/README.md`
- [x] docker-compose.yml actualizado — `docker-compose.yml` (`frontend`)

Evaluación
- [x] Funcionalidad de la UI — recorrido real en navegador (`PROGRESO.md` Fase 6); capturas en `docs/img/frontend/`
- [x] Uso correcto de state management — tags de invalidación y refresh single-flight (`frontend/src/api/base-query.ts`)
- [x] Integración correcta — vía gateway, mismo origen, cookie httpOnly
- [x] Estados de carga, error y éxito — `docs/03-frontend.md` §5
- [x] Calidad de TypeScript — `strict`, `tsc --noEmit` en build y `typecheck:test`
- [x] Tests funcionando — 29/29; coverage 77 % statements (`docs/coverage/frontend/`). Parcial: el refresh single-flight de `base-query.ts` no tiene test (deuda declarada en `PROGRESO.md` Fase 7)
- [x] UX básica (feedback, validaciones) — `docs/03-frontend.md` §5
- [x] Front dockerizado — `frontend/Dockerfile` (nginx-unprivileged, no-root)

## Ejercicio 4 – Diagnóstico

Escenario: no se guardan registros, errores 500 en algunos servicios, alta latencia del agente IA.

Debe incluir
- [x] Hipótesis de causas (BD, comunicación entre servicios, red, agentes IA) — `docs/04-diagnostico.md` §2
- [x] Plan de diagnóstico sistemático con logs estructurados y herramientas de debugging — `docs/04-diagnostico.md` §3-5
- [x] Uso de logs centralizados — `docs/04-diagnostico.md` §5 (jq + equivalentes LogQL/KQL por `correlationId`)
- [x] Problemas de IA: latencia, costos de tokens, rate limiting — `docs/04-diagnostico.md` §6 y §10.6
- [x] Comunicación del avance a stakeholders — `docs/04-diagnostico.md` §9 y §11

Evaluación
- [x] Lógica del análisis y priorización de hipótesis — `docs/04-diagnostico.md` §2 («Por qué este orden»)
- [x] Prioridad de acciones (qué verificar primero) — `docs/04-diagnostico.md` §3-4
- [x] Uso adecuado de logs y debugging — `docs/04-diagnostico.md` §5
- [x] Problemas de microservicios (comunicación, fallos en cascada) — `docs/04-diagnostico.md` §10
- [x] Diagnóstico de IA (latencia, costos, rate limits) — `docs/04-diagnostico.md` §6
- [x] Comunicación clara y estructurada — `docs/04-diagnostico.md` §9. Parcial: las consultas no se ejecutaron sobre un incidente real

## Ejercicio 5 – IA y Agentes

Requisitos técnicos
- [ ] Agente con API de IA (Gemini) — **Parcial**: `services/ai-agent-service/src/infrastructure/llm/gemini.provider.ts` implementado y probado con cliente falso, pero nunca contra la API real (sin `GEMINI_API_KEY`). Los ejemplos son del `MockProvider`
- [x] RAG con vector DB (Qdrant) — `services/ai-agent-service/src/infrastructure/vector/qdrant-vector.store.ts`
- [x] Pipeline de embeddings — `src/infrastructure/embeddings/transformers-embedding.provider.ts`, `src/domain/services/chunker.ts`, `knowledge/`
- [x] Prompt engineering documentado (system prompt, few-shot, chain-of-thought si aplica) — `docs/05-prompt-engineering.md` §2-4; `src/application/prompts/`
- [x] Evaluación: latencia — `GET /api/ai/metrics` (p50/p95); `eval/run-agent.ts`
- [x] Evaluación: costo de tokens (input/output) — `src/domain/services/cost-calculator.ts`
- [x] Evaluación: validación básica de calidad — `src/domain/services/quality-evaluator.ts`
- [x] Integrado con al menos un microservicio — 4 tools sobre user/role/audit con el JWT del usuario (`src/application/tools/`)

Entregables
- [x] Código del microservicio de IA — `services/ai-agent-service/`
- [x] Pipeline de embeddings — ver arriba; ingesta por `POST /api/ai/ingest`
- [x] Documentación de prompt engineering — `docs/05-prompt-engineering.md`
- [x] Código de evaluación (latencia, costos) — `services/ai-agent-service/eval/` (`run-agent.ts`, `run-retrieval.ts` e informes)
- [x] Ejemplo de uso integrado con los microservicios — `docs/05-ejemplos.md` (del `MockProvider`, declarado)
- [x] Explicación de la integración con el sistema existente — `docs/05-integracion.md`

Evaluación
- [x] Integración funcional con los microservicios — `eval:agent` 16/16 por el gateway (`eval/agent-report.md`)
- [x] RAG correcto con vector DB — `eval/retrieval-report-*.md` (hit@4 97 %)
- [x] Calidad del prompt engineering — `docs/05-prompt-engineering.md`
- [x] Métricas de latencia y costo — `GET /api/ai/metrics`; `docs/05-ejemplos.md`
- [x] Manejo de errores y rate limiting de APIs de IA — `src/infrastructure/cache/redis-user-rate-limiter.ts`, `redis-llm-gate.ts`, `src/infrastructure/llm/opossum-circuit-breaker.ts`, `create-llm-chain.ts`. Parcial: el gate global de RPM y el 429 real de Gemini no se ejercitaron de extremo a extremo
- [x] Costos y optimización de tokens — `docs/05-prompt-engineering.md` §7 (presupuesto, caché, modelo)
- [x] Validación de respuestas del agente — `quality-evaluator.ts`, `pii.ts`

## Entregables globales

- [x] Repositorio o carpeta comprimida — `../toka-user-platform.zip` (`git archive` de `HEAD`)
- [x] Arquitectura: diagramas, justificación, compose, DDD/Clean — `docs/01-arquitectura.md`, `docs/02-ddd-clean-architecture.md`, `docker-compose.yml`
- [x] Microservicios: código, Dockerfiles, compose, tests + coverage, docs de ejecución — `services/`, `docs/coverage/`, `README.md`; CI en `.github/workflows/backend.yml`
- [x] IA: código, embeddings, prompt engineering, evaluación — `services/ai-agent-service/`, `docs/05-*.md`
- [x] Front-end: código, state management, tests — `frontend/`, `docs/03-frontend.md`; CI en `.github/workflows/frontend.yml`
- [x] Análisis: respuesta del ejercicio 4 — `docs/04-diagnostico.md`
- [x] Documento consolidado — `docs/Documentacion-Tecnica.pdf`

Extra: servidor MCP (docs/06-mcp-server.md)
