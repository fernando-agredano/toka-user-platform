# Cobertura de tests del backend

Reportes HTML generados con `npm test -- --coverage` y versionados en `docs/coverage/<paquete>/`.
Abre `index.html` de cada carpeta en el navegador.

## Cobertura oficial (umbral 70% en `jest.config.ts`)

Es la métrica que valida `npm test -- --coverage`. Cada paquete mide el alcance definido en su `collectCoverageFrom`.

| Paquete | Tests | Statements | Branches | Functions | Lines | Reporte |
|---|---:|---:|---:|---:|---:|---|
| `@toka/common` | 78 | 94.21% | 87.50% | 80.64% | 94.10% | [index.html](coverage/common/index.html) |
| auth-service | 45 | 99.62% | 97.22% | 98.11% | 99.54% | [index.html](coverage/auth-service/index.html) |
| user-service | 33 | 99.56% | 100% | 97.91% | 99.47% | [index.html](coverage/user-service/index.html) |
| role-service | 32 | 99.14% | 95.00% | 97.95% | 99.46% | [index.html](coverage/role-service/index.html) |
| audit-service | 7 | 100% | 93.54% | 100% | 100% | [index.html](coverage/audit-service/index.html) |

## Alcance real de los servicios (medido, no configurado)

En los servicios, `collectCoverageFrom` solo incluye `domain/`, `application/` y, en algunos, `infrastructure/http/`. Quedan fuera los repositorios Prisma/Mongoose, los publicadores y consumidores de RabbitMQ, la caché Redis, los controladores y los filtros HTTP. Esas capas se validan con el stack real (smoke test con Docker), no con tests unitarios.

Medición ad hoc sobre `src/**/*.ts` (excluye `main.ts` y `*.module.ts`), sin cambiar la configuración:

| Servicio | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| auth-service | 47.57% | 46.05% | 46.01% | 47.12% |
| user-service | 67.11% | 64.40% | 60.75% | 66.77% |
| role-service | 63.94% | 51.35% | 55.68% | 62.73% |
| audit-service | 51.79% | 64.44% | 48.38% | 53.15% |

`@toka/common` (94%) ya se mide sobre todo su `src/`: incluye guards, verificador JWT, consumidor con DLQ y publisher con confirms.

## Pendiente

- Decidir si el umbral debe medir `src/**` completo. En ese caso los servicios necesitan tests de presentación (controladores, filtros, guards), de repositorios en memoria y de infraestructura con mocks.
