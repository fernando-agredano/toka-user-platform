# Guía de fases (para ti, no para Claude)

Antes de cada fase: `/clear`, luego `/model <modelo>` y después pega el prompt.
Si una fase se pone larga (más de 20 intercambios), usa `/compact` o termina con commit y `/clear`.

---

## Fase 2 – Monorepo + common + auth-service · `/model sonnet`

```
Fase 2. Crea la raíz del monorepo (package.json con workspaces, tsconfig.base.json, .env.example, .gitignore, .dockerignore), el paquete packages/common completo según la sección 3 de CONTEXTO.md, y services/auth-service completo: dominio (Credential, Email, Password), casos de uso (register, login, refresh, logout, createCredentialInternal), Prisma con migración y outbox + relay, JWKS con llaves RSA autogeneradas en JWT_KEYS_DIR, lockout en Redis, cliente a role-service con breaker y fallback a cache, consumer de user.deactivated, seed del admin, health, Dockerfile multi-stage y jest.config con threshold 70%. Incluye tests unitarios del dominio y de los casos de uso. Verifica con npm run build y npm test.
```

## Fase 3 – user-service + role-service · `/model sonnet`

```
Fase 3. Implementa services/user-service y services/role-service siguiendo exactamente el patrón de auth-service (misma estructura de carpetas, uso de @toka/common, outbox, Dockerfile, jest.config). Endpoints, eventos, invariantes, seeds y cache según CONTEXTO.md secciones 5 y 6. Incluye tests unitarios de dominio y casos de uso. Verifica build y tests.
```

## Fase 4 – audit-service + infra + compose funcional · `/model sonnet`

```
Fase 4. Implementa services/audit-service (consumer de todos los eventos con idempotencia por eventId, consultas y stats, CQRS read model en Mongo). Crea infra/postgres/init.sql, infra/rabbitmq/definitions.json (exchange, DLX, colas y bindings de la sección 6) e infra/gateway/nginx.conf (sección 7; el frontend aún no existe, deja la ruta / preparada). Comenta temporalmente frontend y ai-agent-service en docker-compose.yml. Levanta todo con docker compose y prueba el flujo: register → login → GET /api/users/me → GET /api/audit con el admin. Corrige lo necesario hasta que funcione.
```

## Fase 5 – Tests backend ≥70% · `/model haiku`

```
Fase 5. Ejecuta npm test -- --coverage en cada servicio y en packages/common. Donde el coverage sea menor a 70%, agrega tests unitarios (casos de uso, entidades, VOs, guards, filtros) usando repos en memoria y mocks. No cambies el código de producción salvo bugs evidentes. Genera coverage/ en cada servicio y un resumen en docs/coverage.md con la tabla de porcentajes.
```
Si Haiku se atora con mocks complejos (Prisma, amqplib), cambia a `/model sonnet` solo para ese servicio.

## Fase 6 – Frontend · `/model sonnet`

```
Fase 6. Crea frontend/ con React + Vite + TS + Redux Toolkit (RTK Query con baseQuery que haga refresh automático ante 401) + react-hook-form + zod + Tailwind. Access token solo en memoria (store), refresh por cookie. Páginas: Login, Registro, Usuarios (lista paginada con búsqueda, crear, editar, activar/desactivar), Roles (ver, asignar y quitar a usuarios), Auditoría (tabla con filtros + stats), Asistente IA (chat que muestre respuesta, fuentes y métricas; si el servicio no existe aún, deja la página lista). Rutas protegidas por permiso. Estados de carga (skeletons), errores (toasts con el detail de ProblemDetails) y feedback de éxito. Dockerfile multi-stage servido con nginx. Descomenta frontend en docker-compose y verifica en localhost:8080.
```

## Fase 7 – Tests frontend · `/model haiku`

```
Fase 7. Configura Jest + React Testing Library + MSW en frontend/. Escribe tests para: formulario de login (validación y error del servidor), formulario de registro, slice de auth, lista de usuarios (loading, error, datos), guard de rutas por permiso. Ejecuta con coverage y reporta.
```

## Fase 8 – Diseño IA · `/model opus`

```
Fase 8 (solo diseño, no implementes código del servicio). Escribe docs/05-prompt-engineering.md con: system prompt completo del agente (rol, límites, formato, uso de tools, citas de fuentes, defensa contra prompt injection, negativa ante datos que el usuario no puede ver), 3 few-shot examples, cuándo aplicar razonamiento paso a paso, definición de las 4 tools con JSON schema, estrategia de chunking y retrieval (tamaño, overlap, top-k, umbral de score), optimización de tokens (cache, truncado de contexto, límite de historial, modelo flash-lite), estrategia de rate limiting y fallback, y el diseño de evaluación: métricas de latencia y costo (tabla de precios configurable), y validación de calidad (groundedness contra fuentes, formato, PII, longitud) con score 0-1. Crea también services/ai-agent-service/knowledge/ con 4 documentos markdown realistas (política de roles y permisos, política de contraseñas y seguridad, guía de uso del sistema, FAQ de soporte).
```

## Fase 9 – ai-agent-service · `/model sonnet`

```
Fase 9. Implementa services/ai-agent-service según CONTEXTO.md y docs/05-prompt-engineering.md: puerto LlmProvider con GeminiProvider (@google/genai, function calling), OllamaProvider y MockProvider (selección por LLM_PROVIDER; si no hay GEMINI_API_KEY usa Mock con warning). Pipeline de embeddings local (@huggingface/transformers, all-MiniLM-L6-v2) → Qdrant, con ingesta al arrancar si la colección está vacía y por POST /api/ai/ingest. Tools que llaman a user, role y audit con el JWT del usuario. Rate limit por usuario en Redis, limitador global por RPM, retry exponencial ante 429, breaker con degradación a respuesta solo-RAG, cache de respuestas. Evaluador que mide latencia, tokens, costo y quality score y lo guarda en Mongo; GET /api/ai/metrics. Publica ai.query.completed. Tests con MockProvider. Descomenta el servicio en compose y prueba 3 preguntas de ejemplo: una de RAG, una con tool de usuarios y una de auditoría. Guarda las respuestas reales en docs/05-ejemplos.md.
```

## Fase 10 – Ejercicio 4 · `/model sonnet`

```
Fase 10. Escribe docs/04-diagnostico.md respondiendo el Ejercicio 4 (falla: no se guardan registros, errores 500 en algunos servicios, alta latencia del agente IA) aterrizado a NUESTRA arquitectura: hipótesis priorizadas con probabilidad e impacto (Postgres con pool agotado o disco lleno, outbox bloqueado, RabbitMQ con memory alarm, breaker abierto entre auth y role, Redis caído, JWKS inaccesible, rate limit 429 de Gemini, contexto RAG inflado), plan de diagnóstico en los primeros 5, 15 y 30 minutos, consultas concretas sobre nuestros logs JSON filtrando por correlationId, nivel y servicio (ejemplos con docker compose logs + jq y su equivalente en Loki o Elastic), revisión de /api/ai/metrics (p95, tokens, costo, tasa de 429), mitigaciones inmediatas frente a correcciones de fondo, plantilla de comunicación a stakeholders (inicial, cada 30 min y cierre) y un postmortem breve.
```

## Fase 11 – Documentación · `/model haiku`

```
Fase 11. Escribe README.md en la raíz (descripción, diagrama embebido de docs/01-arquitectura.md, requisitos, cómo obtener la GEMINI_API_KEY gratis o usar LLM_PROVIDER=mock u ollama, docker compose up, credenciales del admin, URLs, cómo correr los tests y ver el coverage, índice de docs/ que mapee cada entregable de la prueba a su archivo) y un README.md corto en cada servicio y en frontend. Agrega docs/02-ddd-clean-architecture.md explicando con ejemplos REALES del código (rutas de archivos) cómo se aplicaron DDD y Clean Architecture.
```

## Fase 12 – Revisión final · `/model opus`

```
Fase 12. Revisa el repositorio contra TODOS los criterios de evaluación de la prueba técnica (ejercicios 1 a 5 y entregables esperados). No leas todo el código: usa el árbol de carpetas, PROGRESO.md, los docs y muestras representativas. Entrega una tabla de criterio | cumple / parcial / falta | evidencia (archivo) | acción, y corrige solo los huecos de alto impacto que sean rápidos. Finalmente prepárame 10 preguntas probables de entrevista sobre este proyecto con respuestas cortas.
```
