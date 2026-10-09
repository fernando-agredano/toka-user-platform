# Ejercicio 4 – Diagnóstico de un incidente en producción

**Escenario.** Tres síntomas simultáneos: (1) no se guardan registros, (2) errores 500 en algunos servicios, (3) alta latencia del agente IA.

Este documento está aterrizado a la arquitectura real de la plataforma (ver `01-arquitectura.md`): gateway nginx → 5 servicios NestJS, Postgres por servicio, Redis, RabbitMQ con outbox, MongoDB, Qdrant y Gemini. Los nombres de logs, colas, umbrales y campos salen del código, no de una arquitectura genérica.

> **Alcance de la verificación.** Los comandos y las hipótesis se derivan del código (`packages/common`, `auth-service`, `ai-agent-service`, `infra/`). No se ejecutaron contra un incidente real; las consultas de Loki/Elastic son equivalentes de referencia, porque el stack de desarrollo solo escribe JSON a stdout. Los puntos donde el código **no** ofrece una señal (por ejemplo, no hay contador de 429 en `/api/ai/metrics`) se marcan explícitamente.

---

## 1. Principio de trabajo

Tres síntomas a la vez rara vez son tres causas. En esta arquitectura casi todo depende de **cuatro dependencias compartidas**: Postgres, RabbitMQ, Redis y Gemini. El método es:

1. **Estabilizar primero, entender después.** Si hay una mitigación segura y reversible, se aplica antes de tener la causa raíz.
2. **Ir de afuera hacia adentro:** gateway → servicio → dependencia. Un `correlationId` permite seguir una sola petición de punta a punta (nginx lo inyecta con `$request_id` si no viene).
3. **Buscar el factor común.** Si «no se guardan registros» y «500» aparecen en servicios distintos, el candidato número uno es una dependencia compartida (Postgres o la red), no un bug de código.

### Cómo se relacionan los síntomas con la arquitectura

| Síntoma | Qué significa en nuestra arquitectura |
|---|---|
| **No se guardan registros** | Puede ser *escritura de negocio fallida* (Postgres de user/role/auth) o *escritura derivada fallida*: los eventos no llegan a audit (outbox, RabbitMQ, consumidor) o las métricas del agente no llegan a Mongo. Hay que distinguir cuál. |
| **500 en algunos servicios** | `ProblemDetailsFilter` convierte errores no controlados en 500 y registra el stack **solo en logs**. Errores de dominio devuelven 4xx/503; un 500 es siempre una excepción inesperada (BD, driver, bug). |
| **Alta latencia del agente IA** | `latency.totalMs` se descompone en `queueWaitMs`, `embedMs`, `retrievalMs`, `llmMs` y `toolsMs`. Cada una apunta a una causa distinta (cuota RPM, CPU del modelo de embeddings, Qdrant, Gemini, otros servicios). |

---

## 2. Hipótesis priorizadas

Probabilidad = qué tan probable es dado el cuadro de síntomas. Impacto = qué se rompe si es cierta. El orden de investigación pondera ambos y el costo de comprobarla (todas se descartan en minutos).

| # | Hipótesis | Prob. | Impacto | Síntomas que explica | Señal rápida |
|---|---|---|---|---|---|
| H1 | **Postgres degradado**: pool de Prisma agotado (P2024), disco lleno (`No space left on device`) o `max_connections` alcanzado | Alta | Crítico | No se guardan registros + 500 en auth/user/role | `PrismaClientKnownRequestError` P2024/P1001 en logs; `/health` de los servicios en 503 |
| H2 | **Rate limit / cuota de Gemini** (429, RPM bajo: `LLM_RPM_LIMIT=8`) | Alta | Medio | Latencia del agente (`queueWaitMs`, reintentos) y modo degradado | `degradedRate` alto en `/api/ai/metrics`; logs `Provider gemini unavailable` |
| H3 | **Redis caído o saturado** | Media | Crítico | 500/503 en login (lockout, blacklist de `jti`, refresh), rate limit del agente, cachés | `redis-cli ping`; errores `ECONNREFUSED`/`MaxRetriesPerRequest` |
| H4 | **Outbox bloqueado** (relay fallando o transacción larga) | Media | Alto (silencioso) | «No se guardan registros» *en audit* aunque el dato de negocio sí existe | Filas `outbox_events` con `published_at IS NULL` creciendo; log `Outbox relay failed` |
| H5 | **RabbitMQ con memory/disk alarm** (publishers bloqueados) | Media | Alto | Mismo síntoma que H4, más publicación del agente (`ai.query.completed`) | `rabbitmq-diagnostics alarms`; conexiones en `blocked` |
| H6 | **Breaker abierto auth → role** (role-service lento o caído) | Media | Alto | 503 en login (`PermissionsUnavailableError`) si no hay permisos en caché | Log `role-service unavailable ... using cached permissions` o 503 sin caché |
| H7 | **JWKS inaccesible** (auth-service caído o cache de JWKS vencida sin poder refrescar) | Baja-Media | Crítico | 401/500 en *todos* los servicios al validar tokens nuevos | Errores de `jose` (`JWKSTimeout`, `fetch failed`) en user/role/audit/ai |
| H8 | **Contexto RAG inflado** (chunks de más, historial largo, tools devolviendo mucho) | Baja | Medio | Solo latencia y coste del agente (`llmMs`, tokens de entrada) | `tokens.input` p95 muy por encima de la línea base |
| H9 | Qdrant lento o caído | Baja | Bajo-Medio | `retrievalMs` alto; el agente continúa sin contexto | Log `Retrieval unavailable, continuing without context` |
| H10 | Despliegue reciente / cambio de configuración | Media | Variable | Cualquiera | ¿Hubo deploy en las últimas horas? Revertir es la mitigación más barata |

### Por qué este orden

- **H1 va primero** porque es la única hipótesis que explica *a la vez* «no se guardan registros» y «500 en varios servicios», y cada servicio tiene su propia base: si el disco es compartido (un solo contenedor Postgres con tres bases, como en nuestro `docker-compose.yml`), **un disco lleno afecta a los tres**.
- **H2 va segunda** porque el síntoma de latencia del agente es casi independiente de los otros dos: probablemente es un problema aparte, y es de baja gravedad porque el diseño ya degrada (ver §8).
- **H4/H5 son silenciosas**: el usuario ve un 201, pero el evento nunca sale. Se descubren porque *audit queda vacío o atrasado*. Por eso se revisan aunque los 500 apunten a otro lado.
- **H7 se prioriza más alto de lo que su probabilidad sugiere** porque su impacto es total y se comprueba con un solo `curl`.

---

## 3. Plan de diagnóstico por tiempo

### Minutos 0–5: triage y contención del radio

Objetivo: saber **qué está roto, desde cuándo y qué tan extendido**. Sin tocar nada.

1. **Estado de contenedores y health:**
   ```bash
   docker compose ps
   for p in 3001 3002 3003 3004 3005; do
     echo -n "$p: "; curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 localhost:$p/health
   done
   ```
   (los puertos internos solo están accesibles desde la red de compose; en producción se usa `docker compose exec` o el endpoint de health del orquestador.)
2. **JWKS** (descarta H7 en una línea): `curl -s -o /dev/null -w "%{http_code}\n" localhost:8080/api/auth/.well-known/jwks.json`
3. **Errores 5xx recientes por servicio** (consulta de §5.1).
4. **Disco y memoria del host**: `df -h`, `docker system df`, `docker stats --no-stream`.
5. **¿Hubo un cambio?** Último deploy, cambio de variables de entorno, rotación de claves.
6. **Declarar el incidente** y enviar la **comunicación inicial** (§9).

Criterio de salida: una lista corta de servicios/dependencias con síntomas y una hora de inicio aproximada.

### Minutos 5–15: aislar la dependencia culpable

Objetivo: **confirmar o descartar H1–H7** con una consulta cada una.

| Hipótesis | Comando de confirmación |
|---|---|
| H1 Postgres | `docker compose exec postgres psql -U toka -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY 1;"` y `-c "SHOW max_connections;"`; disco: `docker compose exec postgres df -h /var/lib/postgresql/data`; logs: `docker compose logs postgres --tail 50` |
| H3 Redis | `docker compose exec redis redis-cli ping`; `redis-cli info memory \| grep -E "used_memory_human\|maxmemory_human"`; `redis-cli info clients \| grep connected` |
| H4 Outbox | por BD: `SELECT count(*) AS pendientes, min(created_at) AS mas_antiguo FROM outbox_events WHERE published_at IS NULL;` (en `auth_db`, `user_db` y `role_db`) |
| H5 RabbitMQ | `docker compose exec rabbitmq rabbitmq-diagnostics alarms`; `rabbitmqctl list_queues name messages consumers`; `rabbitmqctl list_connections name state` |
| H6 Breaker | Buscar en logs de auth `role-service unavailable` (§5.4); `curl -s -o /dev/null -w "%{http_code}\n" localhost:3003/health` |
| H2 Gemini | `GET /api/ai/metrics` últimos 30 min: `degradedRate`, `llmLatencyMs.p95` (§6) |

Criterio de salida: **una causa probable con evidencia** (o dos independientes: una para escritura, otra para el agente). Si ninguna se confirma, se amplía con §5 (correlationId de una petición fallida).

### Minutos 15–30: mitigar, verificar y decidir

1. **Aplicar la mitigación** de la tabla de §7 correspondiente a la causa confirmada.
2. **Verificar recuperación** con una petición sintética de punta a punta: login → `GET /api/users/me` → crear usuario → comprobar en `/api/audit` que aparece el evento.
3. **Medir el rezago:** el outbox y las colas tienen que *drenarse*. Mientras haya pendientes, el incidente no está cerrado aunque los 500 hayan desaparecido.
4. **Decidir:** ¿escalar, revertir el deploy o seguir con la corrección de fondo? Si a los 30 min la causa no está identificada, **revertir al último estado conocido bueno** y seguir investigando en paralelo.
5. Enviar la **actualización a las partes interesadas** (§9).

---

## 4. Orden de lectura de las señales

Todos los servicios usan `createLogger` de `@toka/common` y escriben JSON a stdout con estos campos fijos: `level` (texto: `error`, `warn`, `info`), `time` (ISO), `service`, `correlationId`, `msg` y, para logs de Nest, `context` (nombre de la clase). Los logs de petición (pino-http) añaden `req.method`, `req.url`, `res.statusCode` y `responseTime`. `password`, `token` y `authorization` se redactan, así que es seguro compartir las salidas.

> Nota: los logs de `/health` no se emiten (`autoLogging.ignore`), por lo que un servicio puede estar fallando su healthcheck sin que aparezca ruido en los logs.

---

## 5. Consultas sobre logs

Para cada consulta se da la versión local (`docker compose logs` + `jq`) y la equivalente en un stack de observabilidad (Loki/LogQL y Elasticsearch/KQL). En Loki se asume la etiqueta `service`; en Elastic, los campos aplanados `service`, `level`, `correlationId`.

> `docker compose logs --no-log-prefix` evita el prefijo `service  |` y deja JSON puro; `fromjson?` descarta líneas que no son JSON (arranque de Docker, advertencias de Prisma).

### 5.1 Todos los errores recientes, por servicio

```bash
docker compose logs --no-log-prefix --since 15m auth-service user-service role-service audit-service ai-agent-service \
  | jq -R 'fromjson? | select(.level=="error" or .level=="fatal")
           | {time, service, context, msg: (.msg[:160])}'
```

Conteo por servicio y mensaje, para ver el patrón dominante:

```bash
docker compose logs --no-log-prefix --since 15m \
  | jq -rR 'fromjson? | select(.level=="error") | [.service, (.msg[:80])] | @tsv' \
  | sort | uniq -c | sort -rn | head -15
```

| Stack | Consulta |
|---|---|
| Loki | `sum by (service) (count_over_time({env="prod"} \| json \| level="error" [15m]))` |
| Elastic (KQL) | `level:"error" and @timestamp >= now-15m` → visualización *terms* por `service` |

### 5.2 5xx del gateway/servicios (qué ruta falla)

```bash
docker compose logs --no-log-prefix --since 15m \
  | jq -R 'fromjson? | select(.res.statusCode >= 500)
           | {time, service, method: .req.method, url: .req.url, status: .res.statusCode, ms: .responseTime, correlationId}'
```

| Stack | Consulta |
|---|---|
| Loki | `{env="prod"} \| json \| res_statusCode >= 500` (Loki aplana `res.statusCode` a `res_statusCode`) |
| Elastic | `res.statusCode >= 500` |

### 5.3 Seguir una petición por `correlationId` a través de servicios

Es la consulta central para los fallos en cascada (§10). Se obtiene el `correlationId` de la cabecera `x-correlation-id` de la respuesta fallida (nginx la añade siempre) o del campo `correlationId` del ProblemDetails.

```bash
CID=<correlation-id>
docker compose logs --no-log-prefix --since 1h \
  | jq -R --arg cid "$CID" 'fromjson? | select(.correlationId==$cid)
           | {time, service, level, context, msg: (.msg[:140])}' \
  | jq -s 'sort_by(.time)[]' -c
```

| Stack | Consulta |
|---|---|
| Loki | `{env="prod"} \| json \| correlationId="<cid>"` |
| Elastic | `correlationId:"<cid>"` ordenado por `@timestamp` asc, agrupado por `service` |

**Cómo se lee:** la secuencia de `service` en el tiempo es la ruta de la petición. Un 500 en `user-service` cuya cadena empieza con un `error` en `auth-service` indica que el origen está aguas abajo, no en user.

> El `correlationId` también viaja dentro del envelope de cada evento, así que la misma consulta encuentra los efectos asíncronos (consumo en audit/role/user, `ai.query.completed`).

### 5.4 Señales específicas de cada hipótesis

```bash
# H1 – Postgres/Prisma (pool agotado P2024, conexión rechazada P1001, disco)
docker compose logs --no-log-prefix --since 15m \
  | jq -R 'fromjson? | select(.level=="error" and (.msg|test("P2024|P1001|P1017|ECONNREFUSED|No space left|too many connections";"i")))
           | {time, service, msg: (.msg[:160])}'

# H4 – Outbox relay fallando (el relay reintenta cada 1 s; esto sale como error en bucle)
docker compose logs --no-log-prefix --since 15m auth-service user-service role-service \
  | jq -R 'fromjson? | select(.msg|startswith("Outbox relay failed")) | {time, service, msg}'

# H6 – role-service caído: auth degrada a permisos en caché (warn) o responde 503 (sin caché)
docker compose logs --no-log-prefix --since 15m auth-service \
  | jq -R 'fromjson? | select(.msg|test("role-service unavailable|PermissionsUnavailable";"i")) | {time, level, msg: (.msg[:140])}'

# Consumidores: eventos que agotaron reintentos (3 intentos → DLQ)
docker compose logs --no-log-prefix --since 30m \
  | jq -R 'fromjson? | select(.msg|test("dead-lettering";"i")) | {time, service, msg}'

# H7 – JWKS: fallos al validar tokens (cualquier servicio que no sea auth)
docker compose logs --no-log-prefix --since 15m user-service role-service audit-service ai-agent-service \
  | jq -R 'fromjson? | select(.msg|test("JWKS|jwks|fetch failed";"i")) | {time, service, msg: (.msg[:140])}'

# H2 – el agente: proveedor LLM no disponible / modo degradado / reintentos
docker compose logs --no-log-prefix --since 15m ai-agent-service \
  | jq -R 'fromjson? | select(.msg|test("Provider .* unavailable|degraded mode|Retrieval unavailable|Metrics not saved|not published";"i"))
           | {time, level, msg: (.msg[:140]), correlationId}'
```

| Hipótesis | Loki (LogQL) | Elastic (KQL) |
|---|---|---|
| H1 | `{env="prod"} \|~ "P2024\|P1001\|No space left"` | `msg:(*P2024* or *P1001* or "No space left")` |
| H4 | `{env="prod"} \|= "Outbox relay failed"` | `msg:"Outbox relay failed"` |
| H6 | `{service="auth-service"} \|= "role-service unavailable"` | `service:"auth-service" and msg:"role-service unavailable"` |
| DLQ | `{env="prod"} \|= "dead-lettering"` | `msg:"dead-lettering"` |
| H2 | `{service="ai-agent-service"} \|~ "unavailable\|degraded mode"` | `service:"ai-agent-service" and msg:(*unavailable* or *degraded*)` |

### 5.5 Latencia: ¿quién es lento?

```bash
# Peticiones lentas (> 2 s) por servicio y ruta
docker compose logs --no-log-prefix --since 15m \
  | jq -R 'fromjson? | select(.responseTime > 2000)
           | {service, url: .req.url, ms: .responseTime, correlationId}'
```

Loki: `{env="prod"} | json | responseTime > 2000`. Elastic: `responseTime > 2000`.

---

## 6. Revisión de `/api/ai/metrics`

Requiere permiso `audit:read` (admin o manager). Compara la ventana del incidente contra una ventana base (por ejemplo, la misma hora del día anterior).

```bash
TOKEN=$(curl -s localhost:8080/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@toka.local","password":"<seed-password>"}' | jq -r .accessToken)

FROM=$(date -u -v-30M +%FT%TZ)   # macOS; en Linux: date -u -d '30 min ago' +%FT%TZ
curl -s "localhost:8080/api/ai/metrics?from=$FROM" -H "authorization: Bearer $TOKEN" | jq .
```

Campos reales de la respuesta (`MetricsSummary`) y cómo interpretarlos:

| Campo | Qué mirar | Interpretación |
|---|---|---|
| `latencyMs.p50 / p95` | p95 ≫ p50 | Cola larga: pocas peticiones lentas (reintentos, cuota) y no una lentitud general |
| `llmLatencyMs.p95` | Solo peticiones que llamaron al LLM | Si sube, el problema es Gemini; si no, es previo (embeddings/Qdrant/cola) |
| `degradedRate` | > 0 sostenido | El agente respondió con fragmentos citados porque el LLM no estuvo disponible: **es la señal indirecta de 429/503 de Gemini** |
| `cacheHitRate` | Baja inesperada | Más llamadas al LLM → más latencia y coste (¿Redis caído? la caché vive allí) |
| `tokens.input` (total y por petición) | Por encima de la base | Contexto inflado (H8): demasiados chunks, historial largo o tools verbosas |
| `tokens.thoughts` | Alto | `thinkingBudget` consumiendo tiempo y coste |
| `costUsd.total` / `savedByCache` | Coste/petición en alza | Confirma H8; revisar `byProvider` |
| `byProvider` | Un proveedor con muchas peticiones | Revela si el fallback entró en juego |
| `avgQualityScore` | Caída | Respuestas degradadas o sin fuentes |

**Limitación conocida: no hay tasa de 429 en las métricas.** El resumen no incluye un contador de rechazos. Se estima así:

- **429 de Gemini** (se reintenta con backoff y `retryDelay`): no es un fallo para el usuario; aparece como `degradedRate` y en los logs `Provider gemini unavailable`. Se consulta con la §5.4 (H2).
- **429 por límite de usuario** (token bucket, 5 req/min): se ve en el gateway/servicio como `res.statusCode == 429` en `/api/ai/chat` y con cabecera `Retry-After`:
  ```bash
  docker compose logs --no-log-prefix --since 15m ai-agent-service \
    | jq -R 'fromjson? | select(.res.statusCode==429 and (.req.url|startswith("/api/ai/chat")))' | wc -l
  ```
- **429 de nginx** (`limit_req` 20 r/s): son del gateway, no del servicio.

Esa brecha es una mejora de fondo (§8): registrar `rateLimited` en `QueryMetric` o exponer un contador.

**Lectura por descomposición de latencia.** Cada `QueryMetric` guarda `latency.{queueWaitMs, embedMs, retrievalMs, llmMs, toolsMs}` en Mongo. Para ver qué componente domina:

```js
// mongosh, base "ai", colección de métricas del agente
db.getCollectionNames()   // confirmar el nombre real de la colección
db.ai_metrics.aggregate([
  { $match: { createdAt: { $gte: new Date(Date.now() - 30*60*1000) } } },
  { $group: { _id: null,
      queueP95: { $percentile: { input: "$latency.queueWaitMs", p: [0.95], method: "approximate" } },
      embedP95: { $percentile: { input: "$latency.embedMs", p: [0.95], method: "approximate" } },
      retrievalP95: { $percentile: { input: "$latency.retrievalMs", p: [0.95], method: "approximate" } },
      llmP95: { $percentile: { input: "$latency.llmMs", p: [0.95], method: "approximate" } },
      toolsP95: { $percentile: { input: "$latency.toolsMs", p: [0.95], method: "approximate" } } } }
])
```

| Componente dominante | Causa probable |
|---|---|
| `queueWaitMs` | Cuota global RPM agotada (`LLM_RPM_LIMIT`), pico de tráfico o reintentos consumiendo cuota (cada reintento gasta un slot) |
| `embedMs` | CPU saturada en el contenedor del agente (el modelo de embeddings es local) |
| `retrievalMs` | Qdrant lento o con colección grande/no indexada |
| `llmMs` | Gemini lento, `thinkingBudget` alto o contexto inflado |
| `toolsMs` | user/role/audit lentos: el agente hereda su latencia (timeout 2 s por llamada) |

> El nombre exacto de la colección debe confirmarse con `getCollectionNames()` antes de usar el aggregate; no se verificó en esta fase.

---

## 7. Mitigaciones inmediatas vs. correcciones de fondo

Regla: la mitigación **reduce el daño en minutos y es reversible**; la corrección de fondo evita la reincidencia y se planifica después del incidente.

| Causa | Mitigación inmediata (≤ 30 min) | Corrección de fondo |
|---|---|---|
| **H1 Postgres: disco lleno** | Liberar espacio (logs de Docker, WAL archivados antiguos, `VACUUM` si procede) o ampliar el volumen; **no** borrar datos de negocio | Alertas de disco al 70/85 %; volumen separado por base; política de retención de `outbox_events` publicados (hoy no se purgan) |
| **H1 Postgres: pool agotado / conexiones** | Reiniciar el servicio con fugas; subir temporalmente `connection_limit` en la `DATABASE_URL`; matar sesiones `idle in transaction` | Dimensionar pool según réplicas × `max_connections`; PgBouncer; `statement_timeout`/`idle_in_transaction_session_timeout`; revisar transacciones largas |
| **H3 Redis caído** | Reiniciar Redis. Mientras tanto: auth degrada a *sin lockout/blacklist* según el código (verificar impacto antes de asumir) y el agente pierde rate limit y caché | Redis con persistencia y réplica (Sentinel/gestionado); decidir explícitamente fail-open vs fail-closed por caso (blacklist de `jti` es sensible) |
| **H4 Outbox bloqueado** | Reiniciar el servicio dueño del relay; matar la transacción larga que retiene filas (`pg_stat_activity`). Los eventos **no se pierden**: se publican al recuperarse | Métrica y alerta de «edad del evento pendiente más antiguo»; purga de publicados; límite de reintentos con *poison row* aislada |
| **H5 RabbitMQ con alarma** | Liberar disco/memoria; purgar solo si se entiende qué colas crecen (nunca `toka.dlq` sin copia); reiniciar consumidores caídos | Límites `vm_memory_high_watermark`/`disk_free_limit` explícitos; alerta de profundidad de cola y de DLQ; *lazy queues* para `audit.all` |
| **H6 Breaker auth → role** | Reiniciar/escalar role-service; el login ya degrada a permisos cacheados (`CACHE_TTL`), así que solo falla el usuario sin caché | Aumentar el TTL de la caché de permisos con invalidación por evento (`auth.role-changed` ya existe); alerta cuando el breaker abre |
| **H7 JWKS inaccesible** | Recuperar auth-service; los servicios mantienen JWKS en caché, por lo que los tokens ya conocidos siguen validando | Réplicas de auth; alerta sobre `jwks.json`; rotación de claves con solape (`kid`) |
| **H2 Gemini 429** | Subir `LLM_RPM_LIMIT` solo si el plan lo permite; activar `LLM_FALLBACK_PROVIDER`; el modo degradado ya mantiene el servicio | Plan de pago/cuota mayor; fallback a Ollama; añadir contador de 429 a las métricas; presupuesto de tokens por usuario |
| **H8 Contexto inflado** | Reducir `top_k` de recuperación o el límite de historial por configuración; limpiar caché si hay respuestas antiguas | Presupuesto de tokens con truncado; evaluación offline (`eval:agent`) con umbral de `tokens.input` |
| **H9 Qdrant** | Reiniciar; el agente sigue sin contexto (peor calidad, no caída) | Réplica/snapshot; reindexado programado |
| **H10 Deploy reciente** | **Revertir** a la imagen anterior | Despliegue gradual, migraciones compatibles hacia atrás, *smoke tests* post-deploy |

**Mitigaciones transversales:** aumentar el `limit_req` solo si el origen es un pico legítimo; poner el frontend en modo mantenimiento si se está dañando integridad; **pausar escritura masiva** (un admin que crea usuarios en bucle puede agravar un pool agotado).

---

## 8. Mecanismos de contención ya implementados

Resumen de lo que el diseño hace *por sí solo* y que explica por qué un incidente no es siempre una caída total:

| Mecanismo | Dónde | Efecto en un incidente |
|---|---|---|
| Timeout HTTP 2 s + breaker opossum (50 % error, volumen mínimo 5, reset 10 s) | `ResilientHttpClient` | Una llamada a un servicio lento no bloquea la petición ni acumula peticiones; los 4xx no abren el breaker |
| Reintentos solo en operaciones idempotentes | `ResilientHttpClient` | No se duplican escrituras |
| Fallback a caché de permisos | `RolePermissionsGateway` (auth) | Login sigue funcionando con role-service caído, salvo para usuarios sin caché (503 explícito) |
| Transactional Outbox | auth/user/role | La escritura de negocio no depende de RabbitMQ; los eventos se publican al volver |
| `SKIP LOCKED` + transacción de 15 s | `OutboxRelayService` | Réplicas del relay no compiten ni duplican |
| Reintentos del consumidor y DLQ | `BaseConsumer` | 3 intentos con espera creciente y luego `toka.dlq`; un evento venenoso no bloquea la cola |
| Idempotencia por `eventId` | consumidores y audit (índice único) | Reentregas tras recuperación no duplican registros |
| Cuota global RPM + backoff con `retryDelay` + breaker por proveedor + fallback + modo degradado | `ResilientLlm`, `ChatUseCase` | El agente responde con fragmentos citados en lugar de fallar; solo hay dos errores explícitos: 429 (límite de usuario) y 503 |
| Efectos secundarios no bloqueantes | `ChatUseCase` | Si falla guardar métricas o publicar `ai.query.completed`, solo hay `warn`/`error` y la respuesta sale igual |
| `ProblemDetailsFilter` | `@toka/common` | Los 500 no exponen stack; el `correlationId` viaja en el cuerpo |

---

## 9. Comunicación a partes interesadas

Principios: hechos y no suposiciones, impacto en lenguaje de negocio, hora de la próxima actualización, un solo responsable de comunicar. Se evita culpar y especular sobre la causa hasta tenerla.

### Comunicación inicial (en los primeros 10 minutos)

> **Asunto:** [Incidente] Degradación en la plataforma de usuarios – en investigación
>
> **Estado:** Investigando · **Severidad:** <SEV-1/2/3> · **Inicio detectado:** <hora local>
>
> **Qué estamos viendo:** algunas operaciones de alta o edición de usuarios no se están guardando y algunos servicios devuelven errores; el asistente IA responde más lento de lo normal.
> **Impacto:** <quiénes y qué funciones; % aproximado si se conoce>. El inicio de sesión <sí/no> está afectado.
> **Qué estamos haciendo:** el equipo está identificando la causa y aplicando medidas de contención.
> **Qué pueden hacer los usuarios:** <esperar / reintentar en X minutos / evitar crear usuarios masivamente>.
> **Próxima actualización:** en 30 minutos, o antes si hay novedades.
> **Responsable de comunicación:** <nombre>

### Actualización cada 30 minutos

> **Actualización #N – <hora>**
> **Estado:** <Investigando / Causa identificada / Mitigando / Monitoreando>
> **Lo que sabemos:** <causa confirmada o hipótesis descartadas, sin tecnicismos innecesarios>.
> **Impacto actual:** <mejoró / igual / empeoró> — <detalle>.
> **Acciones en curso:** <mitigación y quién la ejecuta>.
> **Riesgo de pérdida de datos:** <ninguno conocido / en evaluación>. Los eventos pendientes se procesarán al recuperarse el servicio.
> **Próxima actualización:** <hora>.

### Cierre

> **Incidente resuelto – <hora>**
> **Duración:** <hh:mm> · **Impacto:** <resumen>.
> **Causa:** <una o dos frases>.
> **Resolución:** <qué se hizo>.
> **Verificación:** <pruebas realizadas; cola/outbox drenados>.
> **Datos:** <se confirmó que no hubo pérdida / se reprocesaron N eventos / se necesitan acciones de usuarios afectados>.
> **Siguientes pasos:** postmortem sin culpables en <fecha>; acciones preventivas se compartirán allí.

---

## 10. Fallos en cascada

Un fallo en cascada ocurre cuando un problema local se propaga porque los servicios esperan unos a otros (hilos, conexiones y memoria retenidos) o porque la recuperación genera más carga (tormenta de reintentos). En esta plataforma hay dos tipos de acoplamiento: **síncrono** (HTTP) y **asíncrono** (RabbitMQ). La contención difiere.

### 10.1 Mapa de dependencias

```
                     ┌──────────────────── Redis ────────────────────┐
                     │ lockout · blacklist jti · refresh · cachés ·  │
                     │ rate limit del agente                         │
                     └────────────▲──────────▲───────────▲───────────┘
 nginx ─▶ auth ──HTTP síncrono──▶ role ───────┘           │
   │       │  ▲                    │                       │
   │       │  └─ JWKS ─ (todos los servicios validan JWT)  │
   │       ▼                       ▼                       │
   │    Postgres auth_db        Postgres role_db     ai-agent ──▶ Gemini
   │       │ outbox               │ outbox             │  │──▶ Qdrant
   │       └───────────┐  ┌───────┘                    │  └──▶ user/role/audit (tools, JWT del usuario)
   │                   ▼  ▼                            │
   └─▶ user ─▶ Postgres user_db ── outbox ─▶ RabbitMQ ◀─┘ (ai.query.completed)
                                              │
                              consumers: user, role, auth, audit ─▶ MongoDB
```

Acoplamientos críticos:

| Acoplamiento | Tipo | Quién cae si falla |
|---|---|---|
| auth → role (permisos en login) | HTTP síncrono | Login (mitigado por caché) |
| user → auth (alta de usuario con credenciales) | HTTP síncrono | Creación de usuarios por admin |
| todos → auth (JWKS) | HTTP, cacheado | Validación de tokens nuevos |
| ai-agent → user/role/audit (tools) | HTTP síncrono | Solo las preguntas que requieren datos |
| ai-agent → Gemini | HTTP externo | Latencia / modo degradado |
| servicios → Postgres | conexión | Escritura de negocio |
| servicios → RabbitMQ | AMQP | Solo propagación (gracias al outbox) |
| consumidores → RabbitMQ y su BD | AMQP | Efectos derivados (perfil, rol por defecto, auditoría) |

### 10.2 Cascada A: Postgres → auth → todo lo que depende de auth

1. **Origen:** el disco o el pool de `auth_db` se agota.
2. **Propagación:** `register`, `login` (escritura del refresh/outbox) y `POST /api/users` fallan con 500. `user-service` crea usuarios llamando a auth por REST: su llamada excede el timeout de 2 s o recibe 5xx → el breaker se acerca al umbral (50 % con volumen ≥ 5) → el endpoint de usuarios responde 503 *rápido*, sin consumir recursos.
3. **Segunda ola:** los eventos `auth.user.registered` no se publican (outbox con filas pendientes, `Outbox relay failed`). Consecuencia diferida: `user-service` y `role-service` **nunca crean el perfil ni asignan el rol `USER`** para registros recientes, y audit no los ve. Es el síntoma «no se guardan registros» en su versión silenciosa.
4. **Detección en logs:**
   - Una sola petición `POST /api/auth/register` con `correlationId=X` muestra `error` en `auth-service` (P2024/P1001) y ninguna línea posterior en `user-service`/`role-service`/`audit-service` con el mismo `X`: **la ausencia del correlationId aguas abajo es la evidencia**.
   - En `POST /api/users` con `correlationId=Y` aparecen líneas en `user-service` seguidas de un error HTTP hacia auth: la cadena cruza servicios y el origen es el último.
5. **Contención:** timeout 2 s + breaker (cortocircuito rápido en user→auth); el outbox conserva los eventos; consumidores idempotentes permiten reprocesar al recuperar; la rutina de alta por admin es una *mini-saga* que se autocura porque auth publica `auth.user.registered` cuando vuelve.
6. **Qué NO contiene:** un usuario puede quedar «a medias» temporalmente (credencial creada sin perfil). Se resuelve solo al drenar el outbox; hay que verificarlo explícitamente.

### 10.3 Cascada B: RabbitMQ (memory/disk alarm) → outbox → disco de Postgres

1. **Origen:** una alarma de memoria o disco hace que RabbitMQ bloquee las conexiones publicadoras.
2. **Propagación:** el `EventPublisher` espera confirmación (confirm channel) y deja de recibirla → `relayPending()` se retrasa; la transacción del relay retiene filas con `FOR UPDATE` hasta 15 s → timeouts del relay → `Outbox relay failed` en bucle cada segundo.
3. **Segunda ola:** `outbox_events` crece sin freno (no se purga) → **más disco y bloat en Postgres** → riesgo de convertir un problema de RabbitMQ en el de H1.
4. **Efecto lateral:** el agente publica `ai.query.completed` de forma no bloqueante: se pierde la métrica en audit pero la respuesta al usuario no se afecta (`warn: ai.query.completed not published`).
5. **Detección en logs:** `Outbox relay failed` repetido en los tres servicios con outbox *a la vez*, y `audit-service` sin eventos nuevos (consulta `GET /api/audit` y `stats`). Si solo falla *uno*, no es RabbitMQ sino su BD.
6. **Contención:** el outbox desacopla la escritura de negocio de RabbitMQ (el usuario sigue guardando); `SKIP LOCKED` evita pelear entre réplicas; DLQ aísla mensajes venenosos. Pendiente: alerta por edad del evento más antiguo y purga de publicados.

### 10.4 Cascada C: role-service lento → auth → login

1. **Origen:** role-service sin respuesta (`role_db` o Redis degradados).
2. **Propagación:** en login, auth llama a `GET /api/roles/internal/users/:id/permissions` con timeout 2 s. Sin breaker, cada login retendría una conexión 2 s; con breaker, tras ≥ 5 peticiones con ≥ 50 % de error se **abre** y responde al instante.
3. **Contención:** fallback a la caché Redis de permisos (`perms:{userId}`); si no hay, `PermissionsUnavailableError` → **503 explícito** en vez de un login con permisos incorrectos (fallo cerrado, intencional).
4. **Detección:** `role-service unavailable (...); using cached permissions` en `auth-service` con `correlationId` que aparece también en `role-service` con un error o sin respuesta. Si hay 503 de login, la cadena termina en auth sin eco en role.
5. **Efecto sobre el agente:** `get_user_roles` falla en la tool; el `ToolExecutor` registra `Tool ... failed unexpectedly` y el agente responde indicando que no pudo consultar, sin romper la conversación.

### 10.5 Cascada D: Redis → seguridad y agente

Redis concentra lockout, blacklist de `jti`, refresh tokens, cachés y rate limit. Su caída es la de mayor *radio* porque afecta a todos los servicios a la vez. Decisión de diseño a revisar durante el incidente: qué se degrada **abierto** (cachés: se sigue sin caché) y qué debe degradar **cerrado** (blacklist y lockout: no aceptar tokens revocados). Detección: errores de conexión de Redis con el *mismo* timestamp en auth, role, user y ai-agent: señal de infraestructura compartida y no de código.

### 10.6 Cascada E: Gemini → cola del agente → gateway

1. **Origen:** 429 sostenido o latencia alta de Gemini.
2. **Propagación:** cada reintento consume un slot de la cuota global RPM, así que **los reintentos agravan la falta de cuota** (tormenta de reintentos); `queueWaitMs` crece para todos los usuarios. `proxy_read_timeout` del gateway para `/api/ai/` es 90 s: las peticiones pueden esperar mucho antes de fallar.
3. **Contención:** cuota global compartida (Lua, ventana deslizante), backoff que respeta `retryDelay`, breaker por proveedor, fallback y modo degradado → la respuesta llega con fragmentos citados y `degraded: true`. El rate limit por usuario (5 req/min) evita que un solo usuario consuma toda la cuota.
4. **Detección:** `degradedRate` en `/api/ai/metrics` y `Provider gemini unavailable; trying the next one` en logs; los demás servicios **no** se ven afectados (aislamiento de fallo).

### 10.7 Cómo reconocer una cascada y distinguirla de varios fallos independientes

| Indicio | Interpretación |
|---|---|
| Errores en varios servicios con el **mismo timestamp de inicio** | Dependencia compartida (Postgres/Redis/RabbitMQ/red/host) |
| El `correlationId` se repite en varios servicios y **el primer `error` está aguas abajo** | Causa en el último servicio de la cadena |
| El `correlationId` aparece en el servicio emisor y **no** en los consumidores | Fallo de propagación asíncrona (outbox/RabbitMQ/consumidor), no de la petición |
| Errores en un solo servicio y aislados | Fallo local (bug, deploy, su propia BD) |
| 503 muy rápidos (< 50 ms) tras minutos de 2 s | El breaker se abrió: el origen está *antes* del momento en que empezó el cortocircuito |
| Mensajes en `toka.dlq` | Un consumidor agotó 3 reintentos: ver `x-attempts` y el `msg` del `dead-lettering` |

Consulta para ordenar la cronología e identificar el primer servicio que falló:

```bash
docker compose logs --no-log-prefix --since 30m \
  | jq -rR 'fromjson? | select(.level=="error" or .level=="warn") | [.time, .service, (.msg[:90])] | @tsv' \
  | sort | head -40
```

Loki: `{env="prod"} | json | level=~"error|warn"` ordenado ascendente. Elastic: `level:("error" or "warn")` ordenado por `@timestamp` asc; el **primer** servicio y dependencia de la lista es el candidato a origen.

---

## 11. Postmortem breve (plantilla)

Sin culpables: el objetivo es que el sistema falle de forma más segura.

| Campo | Contenido |
|---|---|
| **Resumen** | Una o dos frases: qué falló y qué impacto tuvo |
| **Severidad y duración** | Inicio de síntomas → detección → mitigación → resolución |
| **Impacto** | Usuarios, funciones y datos afectados; cantidad de eventos retrasados o reprocesados |
| **Causa raíz** | Mecanismo técnico (por ejemplo, «el volumen de Postgres se llenó por crecimiento de `outbox_events` sin purga») |
| **Factores contribuyentes** | Ausencia de alerta, límite mal dimensionado, dependencia sin fallback |
| **Qué funcionó** | Breakers, caché de permisos, modo degradado, DLQ, outbox |
| **Qué no funcionó** | Detección tardía, falta de métrica de 429, comunicación |
| **Cronología** | Tabla con hora y evento |
| **Acciones correctivas** | Cada una con responsable, prioridad y fecha |

**Ejemplo de acciones** (a confirmar según la causa real):

| Acción | Tipo | Prioridad |
|---|---|---|
| Alertas de disco de Postgres, profundidad de colas RabbitMQ y edad del evento más antiguo del outbox | Detección | Alta |
| Purga programada de `outbox_events` con `published_at` antiguo | Prevención | Alta |
| Contador de 429 y `rateLimited` en `QueryMetric` / `/api/ai/metrics` | Observabilidad | Media |
| Dimensionar pools de Prisma según réplicas y `max_connections`; evaluar PgBouncer | Capacidad | Media |
| Agregar `LLM_FALLBACK_PROVIDER` real y probar `GeminiProvider` contra la API con clave | Resiliencia | Media |
| Centralizar logs (Loki/Elastic) con alertas por `level=error` y `dead-lettering` | Observabilidad | Alta |
| Runbook por hipótesis (este documento) y simulacro semestral | Proceso | Baja |

**Lecciones que ya se reflejan en el diseño:** la escritura de negocio no depende del broker (outbox), la autorización degrada con caché y el agente degrada a fragmentos citados. Lo que queda por demostrar es la *detección*: hoy el sistema contiene bien los fallos pero depende de que alguien mire los logs, por lo que la alerta temprana es la mejora de mayor valor.
