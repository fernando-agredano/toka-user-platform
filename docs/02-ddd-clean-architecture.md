# DDD y Clean Architecture en la plataforma

Este documento explica cómo se aplicaron Domain-Driven Design y Clean Architecture en los servicios, con referencias a archivos reales del repositorio. La decisión de arquitectura de alto nivel (bounded contexts, multi-DB, eventos) está en [01-arquitectura.md](01-arquitectura.md); aquí se baja a código.

## 1. Qué se aplicó y qué no

| Idea | Cómo se aplicó | Límite honesto |
|---|---|---|
| **Bounded contexts** | Un servicio por contexto (Identity, User, Authorization, Audit, AI), cada uno con su base de datos. | Los contextos no comparten modelo: un `userId` es solo un identificador entre servicios. |
| **Entidades con invariantes** | `User`, `Credential`, `Role`, `AuditEntry`: las reglas viven en la entidad, no en el controlador. | Algunas entidades son clases con `props` privadas; no hay agregados con raíz formal ni eventos de dominio despachados desde la entidad (los eventos se construyen en el caso de uso). |
| **Value objects** | `Email`, `PersonName` (user), `Password` (auth), `RoleName` y `Permission` (role). | Solo los necesarios; no todo string tiene su VO. |
| **Puertos y adaptadores** | Repositorios e interfaces externas se declaran en `domain/` o `application/ports/`, y se implementan en `infrastructure/`. | Los puertos se inyectan con tokens `Symbol` de NestJS, no con inversión de dependencias "pura". |
| **Casos de uso** | Una clase por operación con método `execute()`. | Algunos casos de uso orquestan dos servicios (p. ej. crear usuario = credenciales en auth + perfil en user). |
| **CQRS ligero** | audit-service es el lado de lectura: consume todos los eventos y solo expone consultas. | No hay un modelo de escritura separado dentro de audit; es una proyección de eventos. |

## 2. Capas y regla de dependencias

Todos los servicios siguen la misma estructura (Clean Architecture por servicio):

```
src/
├─ domain/            entidades, value objects, eventos, puertos de repositorio, errores de dominio
├─ application/       casos de uso, DTOs, puertos externos (gateways, cache, clock, LLM, ...)
├─ infrastructure/    Prisma / Mongoose, RabbitMQ, Redis, HTTP, JWT, LLM, embeddings
├─ presentation/      controladores, guards, filtros
└─ app.module.ts      composición: une puertos con implementaciones
```

Regla: `presentation → application → domain`, e `infrastructure` implementa los puertos declarados por `domain` o `application`.

Verificación hecha con grep sobre el código actual:

- `domain/` no importa de `@nestjs`, `@prisma`, `mongoose`, `amqplib`, `ioredis`, `axios`, `@qdrant`, `@google` ni de ningún SDK. Es TypeScript puro.
- `application/` no importa de `infrastructure/`. Depende solo de `domain/` y de sus propios puertos.
- `application/` sí importa de `@nestjs/common`, pero solo para `@Injectable()` e `@Inject()`, el mecanismo de inyección. Es una concesión deliberada: sin ella los casos de uso no se pueden instanciar por DI sin un contenedor propio.

## 3. Ejemplo completo: crear un usuario (user-service)

Recorrido de `POST /api/users` (permiso `users:write`), de la capa externa a la interna:

| Capa | Archivo | Responsabilidad |
|---|---|---|
| presentation | [services/user-service/src/presentation/controllers/users.controller.ts](../services/user-service/src/presentation/controllers/users.controller.ts) | Valida el DTO con `class-validator` y delega. No toma decisiones de negocio. |
| application | [services/user-service/src/application/use-cases/create-user.use-case.ts](../services/user-service/src/application/use-cases/create-user.use-case.ts) | Orquesta: construye la entidad, verifica unicidad, provisiona credenciales y guarda con evento. |
| domain | [services/user-service/src/domain/entities/user.ts](../services/user-service/src/domain/entities/user.ts) | `User.create()` fija el estado inicial (`ACTIVE`) y las fechas. |
| domain | [services/user-service/src/domain/value-objects/email.ts](../services/user-service/src/domain/value-objects/email.ts) | `Email.create()` valida el formato; un `Email` inválido no puede existir. |
| domain | [services/user-service/src/domain/events/user-events.ts](../services/user-service/src/domain/events/user-events.ts) | `userCreated(...)` construye el evento de dominio que se publicará. |
| domain (puerto) | [services/user-service/src/domain/repositories/user.repository.ts](../services/user-service/src/domain/repositories/user.repository.ts) | `USER_REPOSITORY` (token) y la interfaz `UserRepository`. |
| application (puerto) | [services/user-service/src/application/ports/ports.ts](../services/user-service/src/application/ports/ports.ts) | `CREDENTIAL_GATEWAY`: la llamada a auth-service es un puerto, no un `axios` dentro del caso de uso. |
| infrastructure | [services/user-service/src/infrastructure/persistence/prisma-user.repository.ts](../services/user-service/src/infrastructure/persistence/prisma-user.repository.ts) | Implementa `UserRepository`. `save()` escribe el usuario y su evento de outbox en una sola transacción (`$transaction`, líneas 55-72). |
| infrastructure | [services/user-service/src/infrastructure/http/auth-credentials-gateway.ts](../services/user-service/src/infrastructure/http/auth-credentials-gateway.ts) | Implementa `CredentialGateway` con el cliente REST resiliente de `@toka/common`. |
| composición | [services/user-service/src/app.module.ts](../services/user-service/src/app.module.ts) (líneas 60-62) | `{ provide: USER_REPOSITORY, useClass: PrismaUserRepository }` y `{ provide: CREDENTIAL_GATEWAY, useClass: AuthCredentialsGateway }`. |

Dos detalles del caso de uso que muestran el criterio:

- **Falla rápido antes de crear credenciales.** Si el email ya existe, el caso de uso lanza `EmailAlreadyExistsError` antes de llamar a auth-service, para no dejar credenciales huérfanas.
- **Idempotencia frente a la saga.** auth-service también publica `auth.user.registered`, y user-service crea el perfil desde ese evento. Si el consumidor ya creó el perfil, el caso de uso lo reutiliza en vez de emitir `user.created` dos veces.

Los tests de este caso de uso usan un repositorio en memoria y un gateway falso; no necesitan Postgres ni Nest (ver `services/user-service/test/`).

## 4. Invariantes en el dominio

Las reglas de negocio están en la entidad, y el caso de uso no las repite:

- **El último ADMIN nunca se puede quitar.** La regla está en [services/role-service/src/domain/entities/role.ts](../services/role-service/src/domain/entities/role.ts) (líneas 63-65, `LastAdminError`). La concurrencia se cierra en infraestructura: [prisma-role.repository.ts](../services/role-service/src/infrastructure/persistence/prisma-role.repository.ts) toma `SELECT ... FOR UPDATE` antes de contar holders (línea 99). El dominio no puede resolver una carrera por sí solo; por eso la regla vive en dos capas a propósito.
- **ADMIN es inmutable.** En la misma entidad, `Role` rechaza cambios de permisos sobre ADMIN (`ProtectedRoleError`), para que nadie pueda dejar la plataforma sin acceso.
- **Mutadores que informan si cambiaron el estado.** `User.deactivate()`, `activate()` y similares devuelven si el estado realmente cambió. Así el caso de uso emite `user.deactivated` solo en transiciones reales, y un reintento no genera eventos duplicados.
- **Value objects validan en la construcción.** [services/auth-service/src/domain/value-objects/password.ts](../services/auth-service/src/domain/value-objects/password.ts) rechaza contraseñas que no cumplen la política; nunca llega a la base de datos una contraseña inválida.
- **Redacción en el dominio de auditoría.** [services/audit-service/src/domain/entities/audit-entry.ts](../services/audit-service/src/domain/entities/audit-entry.ts) (`createAuditEntry`, función `redact`, línea 33) elimina claves sensibles antes de persistir, sin depender de que cada productor de eventos lo recuerde.

## 5. Puertos y adaptadores fuera del dominio

Cada dependencia externa es un puerto. Ejemplos reales:

| Puerto (token) | Declarado en | Adaptador | Por qué importa |
|---|---|---|---|
| `USER_REPOSITORY` | `user-service/src/domain/repositories/` | `PrismaUserRepository` | Los tests de casos de uso usan un repositorio en memoria. |
| `ROLE_REPOSITORY` | `role-service/src/domain/repositories/` | `PrismaRoleRepository` | Igual; el `FOR UPDATE` es un detalle del adaptador. |
| `CREDENTIAL_REPOSITORY` | `auth-service/src/domain/repositories/credential.repository.ts` | `prisma-credential.repository.ts` | El login no sabe qué base de datos usa. |
| `AUDIT_REPOSITORY` | `audit-service/src/domain/repositories/audit.repository.ts` | `mongo-audit.repository.ts` | Cambiar Mongo por otra base solo toca infraestructura. |
| `LLM_CHAIN` | `ai-agent-service/src/application/ports/llm-provider.port.ts` | `create-llm-chain.ts` + `gemini.provider.ts`, `ollama.provider.ts`, `mock.provider.ts` | El caso de uso del agente no sabe qué modelo responde. |
| `KNOWLEDGE_SOURCE`, `EMBEDDING_PROVIDER`, `VECTOR_STORE` | `ai-agent-service/src/application/ports/` | `fs-knowledge.source.ts`, `transformers-embedding.provider.ts`, Qdrant | El pipeline RAG se puede probar sin modelo de embeddings ni Qdrant. |

### Un caso de la IA: el proveedor de LLM

En [services/ai-agent-service/src/application/ports/llm-provider.port.ts](../services/ai-agent-service/src/application/ports/llm-provider.port.ts) se define la interfaz `LlmProvider`, junto con `LlmRequest`, `LlmResponse`, `ToolDeclaration` y el error `LlmProviderError` con su tipo (`rate_limited`, `unavailable`, `config`, `bad_request`). Las implementaciones viven en `infrastructure/llm/`. Como el caso de uso depende solo de esa interfaz, cambiar de Gemini a Ollama es una variable de entorno (`LLM_PROVIDER`), no un cambio de código de aplicación.

La resiliencia (reintentos, breaker, cuota global, fallback) está en `application/services/resilient-llm.ts`, que envuelve el puerto. Esto significa que la lógica de resiliencia no se duplica en cada proveedor.

## 6. Dominio puro también en el agente

Los cálculos de negocio del agente son funciones y clases de dominio sin dependencias externas:

- [services/ai-agent-service/src/domain/services/cost-calculator.ts](../services/ai-agent-service/src/domain/services/cost-calculator.ts): calcula el costo en USD a partir de tokens y de una tabla de precios inyectada.
- [services/ai-agent-service/src/domain/services/quality-evaluator.ts](../services/ai-agent-service/src/domain/services/quality-evaluator.ts): `evaluateQuality()` puntúa una respuesta de 0 a 1 con reglas deterministas (citas verificables, números presentes en la fuente, PII redactada). No llama a un LLM.
- [services/ai-agent-service/src/domain/services/chunker.ts](../services/ai-agent-service/src/domain/services/chunker.ts): divide la base de conocimiento en fragmentos con encabezado contextual.

Como son puras, se prueban en milisegundos y su resultado no depende del proveedor.

## 7. Eventos y consistencia

Los eventos de dominio son objetos simples (`userCreated`, `userDeactivated`, ...). La entrega confiable la resuelve la infraestructura:

1. El caso de uso pasa los eventos al repositorio: `repository.save(user, [userCreated(...)])`.
2. El adaptador de Prisma escribe la entidad y las filas de `outbox_events` en la misma transacción (ver `prisma-user.repository.ts`, líneas 55-72).
3. `OutboxRelayService` de `packages/common/src/messaging/outbox-relay.ts` publica las filas pendientes con `FOR UPDATE SKIP LOCKED`.
4. Los consumidores heredan de `BaseConsumer` (`packages/common/src/messaging/base-consumer.ts`), que hace la idempotencia por `eventId` y el envío a la DLQ tras 3 intentos.

El dominio nunca sabe de RabbitMQ: solo produce eventos.

## 8. Tests que siguen las capas

- **Domain y application** (cubiertos por el umbral de 70 %): tests unitarios con repositorios y gateways en memoria. Rápidos y sin infraestructura.
- **Infrastructure**: no tiene tests unitarios automatizados. Los repositorios de Prisma se probaron contra Postgres 16 real durante el desarrollo, y el adaptador de auditoría se valida con el stack completo (`docker compose up -d --build`). No se sube la cobertura con mocks de Prisma o Mongoose; el alcance medido está en [coverage.md](coverage.md).

## 9. Trade-offs asumidos

- **Más archivos y más indirección.** Un caso como crear usuario toca seis archivos. A cambio, cambiar Prisma, RabbitMQ o el proveedor de LLM no obliga a tocar el dominio.
- **Tokens de Nest en lugar de interfaces puras.** Es más práctico, pero obliga a usar `import` de tipo de valor en las clases inyectadas (ver el comentario en `chat.use-case.ts`).
- **Invariantes en dos capas en casos de concurrencia.** El dominio expresa la regla; la base de datos (lock) la garantiza frente a condiciones de carrera.
