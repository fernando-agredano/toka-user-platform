# audit-service

Contexto **Audit** (puerto interno `3004`, expuesto vía gateway en `/api/audit*`). Es el lado de **lectura** de un CQRS ligero: no genera eventos de negocio, solo los registra y los consulta.

## Datos y dependencias

- **MongoDB `audit`**: colección `audit_logs` con índice único en `eventId` (idempotencia), índices por `type`, `occurredAt` y `actor.userId`, y TTL opcional de 365 días.
- **RabbitMQ**: consume la cola `audit.all` con el binding `#` (todos los eventos del exchange `toka.events`).

## Endpoints

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/audit?type&actorId&from&to&page&limit` | `audit:read` |
| GET | `/api/audit/stats?from&to` | `audit:read` (conteo por tipo y logins fallidos) |

## Decisiones

- **Redacción en el dominio:** `createAuditEntry()` elimina claves sensibles (`password`, `token`, ...) antes de persistir, así que ningún productor puede filtrar secretos a la auditoría por descuido.
- **Idempotencia en la base de datos:** el índice único en `eventId` evita duplicados aunque el mismo evento llegue dos veces.

## Estructura

```
src/
  domain/              AuditEntry (con redacción), errores y puerto AuditRepository
  application/         casos de uso (registrar, buscar, estadísticas) y DTOs
  infrastructure/      Mongoose (modelo, repositorio), consumer de la cola audit.all
  presentation/        AuditController
```

## Tests

```bash
npm test -w services/audit-service -- --coverage
```

La infraestructura de Mongoose no tiene tests unitarios: se valida con el stack real. Ver [la guía DDD](../../docs/02-ddd-clean-architecture.md) y [coverage](../../docs/coverage.md).
