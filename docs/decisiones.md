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

## Fase 6

### 24. Frontend como paquete independiente (desvío del contrato)
`CONTEXTO.md` lista `frontend` en los workspaces. Se deja **fuera**: los Dockerfiles de los servicios hacen `npm ci` con el `package-lock.json` raíz y solo copian `packages/` y `services/`, así que un workspace extra rompería sus builds (el lockfile referenciaría una carpeta ausente). El frontend tiene su propio `package.json` y lockfile (Patrón B), y su Dockerfile instala solo lo suyo. Consecuencia: `npm run build/test` de la raíz no lo incluye; se ejecuta con `cd frontend && npm run build`.

### 25. Sesión: token en memoria, refresh single-flight y 401 → reintento
El `accessToken` vive solo en el slice `auth` (nunca en `localStorage`). Al cargar la app se llama a `/auth/refresh` (cookie httpOnly) **fuera de React**, de modo que StrictMode no dispara dos refresh. El refresh rota en cada uso y el backend trata la reutilización como robo, así que `refreshSession()` comparte una única promesa entre todos los llamadores: dos 401 simultáneos producen un solo refresh y ambas peticiones se reintentan (verificado en navegador). Si el refresh falla se limpia la sesión, se resetea la caché de RTK Query (para no filtrar datos al siguiente usuario) y el guard redirige a `/login`. `login`, `register` y `refresh` no disparan reintento: su 401 son credenciales inválidas.

### 26. Errores y feedback
Un `listenerMiddleware` convierte todo `rejectedWithValue` en un toast con el `detail` de ProblemDetails (más `errors[]` de validación, si existen). Un error de «sesión expirada» se omite para no mostrar ruido justo antes de redirigir. Los éxitos usan `useToast().success`. Las mutaciones usan `if ('error' in result) return;` en lugar de `try/catch`, porque el toast de error ya salió del listener.

### 27. Permisos en UI y rutas
`NAV_ITEMS` (`routes/navigation.tsx`) es la única fuente para sidebar, tarjetas de inicio y rutas protegidas: cada ruta lleva su permiso y `RequirePermission` muestra «Acceso restringido» (no redirige). Es solo UX: la autorización real sigue en el backend. Los botones de escritura (crear, editar, activar, asignar, quitar) se ocultan sin `*:write`.

### 28. Gateway: `/api/` desconocido responde 404; frontend en 8080
Sin esto, `/api/ai/chat` caía en `location /` y devolvía el `index.html` del SPA. Se añade `location /api/ { return 404; }` (los prefijos más largos de cada servicio siguen ganando). El frontend usa `nginxinc/nginx-unprivileged` (usuario no-root, CONTEXTO §9), que escucha en 8080, por lo que el upstream del gateway pasa de `frontend:80` a `frontend:8080`. El nginx del frontend añade CSP (`default-src 'self'`), `X-Frame-Options: DENY` y `nosniff`; los assets con hash se cachean un año y `index.html` es `no-cache`.

### 29. Asistente IA preparado para la Fase 9
La página y el cliente RTK (`POST /api/ai/chat`) siguen el contrato de CONTEXTO §5. Si el servicio no existe (404/405/502/503/504 o respuesta no JSON) se muestra un aviso en la página y un toast claro. **Supuestos a revisar en la Fase 9:** la forma de `sources[]` (`title|source`, `score`, `snippet`), de `quality.checks`, y un `conversationId` opcional en la respuesta (el contrato solo lo define en la petición).

### 30. Estructura de carpetas y límites conocidos
Se sigue el árbol del Patrón B, pero solo con las carpetas que se usan (`assets/` y `themes/` no existen: los tokens viven en `index.css`/`tailwind.config.ts`). El store y los endpoints RTK viven en `api/` (el patrón no tiene `store/`). Textos de la UI en español; código en inglés. Sin librería de iconos ni de componentes, para no añadir dependencias. Roles: la página lista el catálogo y gestiona asignaciones, pero no crea roles ni edita permisos (fuera del alcance pedido, aunque la API lo permite). Para elegir usuario en Roles hace falta `users:read` (no existe un endpoint «usuarios por rol»).

## Fase 7

### 31. Tests del frontend fuera de `src/`
Los tests viven en `frontend/test/` y no en `src/`: el `tsconfig.json` de la app incluye `src` con `types: ["vite/client"]`, así que colocar tests allí rompería `tsc` del build. `tsconfig.test.json` extiende la base y añade los tipos de Jest (`npm run typecheck:test`). Así el build de producción no cambia.

### 32. Transformador SWC en lugar de ts-jest
Se usa `@swc/jest` porque MSW 2.x y sus dependencias (`rettime`, `until-async`, `@open-draft/*`) publican solo ESM, y ts-jest no las transpila sin tocar la configuración de cada una. `transformIgnorePatterns` deja pasar esos paquetes a SWC. Coste: SWC no hace type-check en los tests; el tipado se verifica con `npm run typecheck:test`.

### 33. MSW fijado a 2.15.0 y `jest-fixed-jsdom`
- MSW 3.x (publicado el 3 de octubre de 2026) se descartó por la regla de no usar versiones de menos de dos semanas.
- `jest-fixed-jsdom` aporta `fetch`, `Request` y `Response` de Node dentro de jsdom; RTK Query los necesita y el entorno jsdom por defecto no los trae.

### 34. URLs relativas en tests
RTK Query construye `new Request('/api/…')`, y el `Request` de Node rechaza URLs relativas (en el navegador se resuelven contra la página). El shim en `test/setup.ts` las resuelve contra la `location` de jsdom. No se toca `API_BASE_URL` de producción.

### 35. Store singleton y reset entre tests
El store de la app es un singleton de módulo (con sus listeners de toasts y de limpieza de caché). `renderWithProviders` lo reinicia antes de cada test (`resetApiState`, toasts y sesión) en lugar de refactorizar `store.ts` a una factoría, que sería un cambio de producción fuera del alcance de la fase.

### 36. Sin umbral de cobertura en el frontend
Se reporta cobertura pero no se fuerza un umbral global: el objetivo de CLAUDE.md es señal sobre flujos críticos, no cobertura total. Login, registro y slice de auth quedan al 100 % de statements; la lista de usuarios al 67 % (faltan los modales de alta/edición y la confirmación de activar/desactivar); `RequirePermission` está cubierto. Quedan sin cubrir el refresh single-flight de `base-query.ts` y los guards `RequireAuth`/`GuestOnly`: se anotan como deuda, no se incluyen en esta fase.

## Fase 8

### 37. Permisos estructurales, no dependientes del prompt
Las tools del agente llaman a los endpoints públicos con el JWT del usuario y solo se declaran al modelo las que su sesión permite. El system prompt refuerza la negativa, pero la garantía es que el modelo nunca tiene más acceso que el usuario. La detección de prompt injection solo marca métricas, no bloquea (falsos positivos con preguntas legítimas de seguridad). Detalle: `docs/05-prompt-engineering.md` §5 y §8.4.

### 38. Chunks de ≤ 200 wordpieces con encabezado contextual
`all-MiniLM-L6-v2` trunca a 256 wordpieces y el español se fragmenta más que el inglés. Se corta por secciones `##` con overlap de 40 y se antepone `documento > sección` al texto embebido. Umbral inicial 0,30, a calibrar con el set de recuperación en la Fase 9. Se recomienda comparar con `paraphrase-multilingual-MiniLM-L12-v2` (también 384 dims); si se adopta, será un desvío del contrato.

### 39. Calidad determinista en línea, LLM-as-judge solo offline
El score 0-1 (groundedness léxica + números, citas válidas, PII, formato, longitud) se calcula en cada respuesta sin un segundo LLM, para no duplicar coste ni consumo de RPM. Las respuestas con PII se redactan; las de score bajo no se cachean ni se regeneran.

### 40. Clave de caché por permisos en vez de por rol (desvío menor)
El contrato dice `hash(pregunta normalizada + rol)`. Se usa el conjunto de permisos ordenado, más `kbVersion`, `PROMPT_VERSION` y el modelo. Es más estricto con roles personalizados y re-ingestar o cambiar el prompt invalida la caché sin hacer flush. Solo se cachea el primer turno y nunca con tools de datos personales.

### 41. Contrato de respuesta del chat (cierra §29)
`sources[]` = `{id: "S#"|"D#", title, source, section?, score?, snippet}`; `quality.checks` = `{grounded: number, citationsValid, noPii, format, length, degraded: boolean}`; `conversationId` se devuelve siempre (extensión: el contrato solo lo define en la petición). Compatible con `frontend/src/@types/api.ts` agregando `id` y `section` opcionales.

### 42. Fallback sin 500: proveedor alternativo o modo degradado
Ante 429 persistente, breaker abierto o falta de slot global, se usa `LLM_FALLBACK_PROVIDER` (Ollama) si está configurado. Si no, las preguntas de documentación reciben los fragmentos recuperados sin redactar (`degraded: true`) y las que necesitan datos reciben 503 con `Retry-After`. Variables nuevas para la Fase 9: `LLM_FALLBACK_PROVIDER`, `LLM_PRICING_JSON` y `EMBEDDING_MODEL` (opcional).

## Fase 9

### 43. Modelo de embeddings multilingüe en q8 (desvío del contrato)
CONTEXTO fija `Xenova/all-MiniLM-L6-v2`. Se midió contra `Xenova/paraphrase-multilingual-MiniLM-L12-v2` con `npm run eval:retrieval` (30 preguntas en el dominio, 6 fuera; informes en `services/ai-agent-service/eval/`): hit@4 86,7 % → 96,7 %, MRR 0,78 → 0,90 y coseno medio del ruido fuera de dominio 0,43 → 0,17. Con el modelo en inglés, el mejor umbral posible (0,55) ya sacrificaba recall y aun así 0,30 dejaba pasar el 83 % del ruido. Mismas 384 dimensiones, así que la colección de Qdrant no cambia. Se usa `dtype: q8` (118 MB en vez de 470 MB; cuesta un caso de 30). Trade-off: modelo de 12 capas, más lento que el de 6. `EMBEDDING_MODEL` y `EMBEDDING_DTYPE` permiten volver atrás sin tocar código; si cambia la dimensión, el store recrea la colección.

### 44. Umbral de recuperación 0,35 y piso del modo degradado 0,45
El umbral 0,30 de la Fase 8 se calibró con datos: con el modelo multilingüe hay una meseta de 0 % de falsos positivos entre 0,25 y 0,40; 0,35 deja margen a ambos lados (peor ruido 0,24; el recall cae a partir de 0,45). El modo degradado solo muestra fragmentos con score ≥ 0,45: por debajo es más honesto un 503 que enseñar texto poco relacionado.

### 45. Imagen Docker sobre Debian slim, modelo horneado (desvío del contrato)
CONTEXTO pide `node:22-alpine`, pero `onnxruntime-node` trae binarios nativos solo para glibc. El modelo q8 se descarga en el build, así que el primer arranque no necesita internet (arranca en ~3 s). Sin `wget` en slim, el `HEALTHCHECK` usa `node`. Coste: la imagen pesa 1,05 GB (661 MB de `node_modules`, de los que `onnxruntime-node` son 291 MB con los binarios de todas las plataformas).

### 46. Cliente de Qdrant 1.12.0 y `node_modules` anidado
`@qdrant/js-client-rest` se fija en 1.12.0 para coincidir con el servidor `v1.12.4` del compose (la 1.19 ya no tiene `search`). Por un conflicto de `undici`, npm anida el cliente en `services/ai-agent-service/node_modules`; el runtime copia también ese directorio.

### 47. `MockProvider` como proveedor real de respaldo, con sus límites declarados
Sin `GEMINI_API_KEY` el servicio arranca con `MockProvider` (contrato) y lo avisa en el log. No es un stub vacío: planifica llamadas a herramientas por palabras clave y redacta citando literalmente los fragmentos recuperados, lo que permite probar de verdad RAG, tools, permisos, citas, calidad, caché y eventos sin key. Limitación: su elección de qué citar es léxica y peor que la de un modelo real; los ejemplos de `docs/05-ejemplos.md` lo declaran y dicen cómo regenerarlos con Gemini. Cada respuesta incluye `metrics.provider` y `metrics.model` para que nunca haya duda de quién la generó.

### 48. Extensiones al contrato de la API
Aditivas y compatibles con el frontend: `metrics.provider` y `metrics.model`; `sources[].id` (`S#`/`D#`, la etiqueta que cita la respuesta) y `sources[].section`; `conversationId` siempre en la respuesta; `Retry-After` en los 429/503 (lo emite el `ProblemDetailsFilter` de `@toka/common`, con test). Solo se devuelven las fuentes que la respuesta cita. Cierra los supuestos de la §29.

### 49. `ai.query.completed` sin outbox
No hay Postgres en este servicio ni un cambio de negocio que proteger: la fuente de verdad es `ai_metrics` en Mongo. El evento se publica con confirmación del broker y un tope de 5 s, sin bloquear la respuesta. Si RabbitMQ cae en ese instante, audit-service pierde esa notificación (la métrica no).

### 50. Dependencias opcionales fallan abiertas; el JWT falla cerrado
Caché, rate limit, métricas, conversaciones y recuperación fallan abiertos: se registra y se responde. El verificador de JWT de `@toka/common` consulta la blacklist en Redis sin captura, así que con Redis caído de forma sostenida toda petición recibe 401, igual que en los demás servicios (no se cambió).

### 51. Pendiente: peso de las imágenes de los otros servicios
Los `Dockerfile` de auth, user, role y audit hacen `npm ci` de todo el monorepo y copian el `node_modules` completo. Con las dependencias del agente (743 MB en total) sus imágenes crecerán al reconstruirse (hoy 264–333 MB). No se tocaron por estar fuera del alcance de la fase y no se midió el impacto. Solución propuesta: `npm ci -w services/<svc> -w packages/common --include-workspace-root`. Para el agente, se podrían además podar los binarios de `onnxruntime-node` de otras plataformas (~200 MB).

## Fase 12

### 52. Autenticación «OAuth2/OIDC distribuida»: modelo de tokens de OIDC, no un proveedor OIDC completo
auth-service emite access tokens JWT RS256 con los claims de OIDC (`iss`, `aud`, `sub`, `exp`, `jti`) y publica sus llaves en un JWKS; cada servicio los valida en local con `createRemoteJWKSet` y caché, sin llamar a auth por petición. No se implementó discovery (`/.well-known/openid-configuration`), ID tokens ni los flujos de OAuth2 (authorization code + PKCE, client credentials), porque hay un único cliente de primera parte (la SPA) y el refresh rota con cookie httpOnly. Si aparecieran clientes de terceros, se sustituiría auth-service por un proveedor estándar (Keycloak, Auth0) sin tocar los demás servicios: solo cambian `AUTH_JWKS_URL`, `JWT_ISSUER` y `JWT_AUDIENCE`.

### 53. CI con GitHub Actions
Dos workflows: `backend.yml` (build de todos los workspaces y tests con el umbral de 70 % de cada `jest.config.ts`) y `frontend.yml` (lint, typecheck de tests, tests y build), porque el frontend no es workspace y tiene su propio lockfile. Corren en `master` y `main`. No incluyen deploy ni tests de integración con el stack Docker.
