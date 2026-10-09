# CLAUDE.md – Prueba Técnica Toka

Contexto y contratos completos (fuente de verdad, obligatorio respetar):
@CONTEXTO.md

Estado actual del trabajo:
@PROGRESO.md

## Reglas de trabajo

- Idioma: código, nombres y commits en inglés; documentación (`docs/`, README) en español.
- Respeta estrictamente los contratos de CONTEXTO.md (rutas, eventos, envelope, puertos, variables). Si necesitas desviarte, anótalo en `docs/decisiones.md`.
- Clean Architecture: `domain` nunca importa de Nest, Prisma, Mongoose, amqplib ni axios.
- Reutiliza `@toka/common`; no dupliques logger, guards, publisher ni filtros.
- Trabaja solo en el alcance de la fase pedida. No refactorices otras partes sin que te lo pida.

## Reglas para ahorrar tokens (importante)

- No releas archivos que ya leíste en esta sesión salvo que hayan cambiado.
- Limita la salida de comandos: `npm test 2>&1 | tail -n 40`, `docker compose logs <svc> --tail 50`, `npm run build 2>&1 | tail -n 30`.
- Para builds de Docker usa `docker compose build <servicio> 2>&1 | tail -n 30`, nunca la salida completa.
- No muestres el contenido de los archivos que escribes; solo lista qué archivos creaste o modificaste.
- Respuestas finales breves: qué se hizo, qué falta y cómo verificarlo (máximo 10 líneas).
- Si un error persiste tras 3 intentos, detente y explícame el problema en vez de seguir probando.

## Al terminar cada fase

1. Verifica que compile y que los tests de lo tocado pasen.
2. Actualiza `PROGRESO.md`: marca la fase, lista lo entregado y las decisiones tomadas, y añade 3-5 líneas de "Cómo explicarlo en la entrevista".
3. Haz commit usando exactamente el mensaje de la tabla "Commits por fase".

## Commits por fase

| Fase | Mensaje de commit |
|---|---|
| 0-1 | `chore: initial context and architecture` |
| 2 | `feat(auth): add monorepo setup, common package and auth-service` |
| 3 | `feat(user,role): add user-service and role-service` |
| 4 | `feat(audit): add audit-service, gateway and infra config` |
| 5 | `test: increase backend unit test coverage above 70%` |
| 6 | `feat(frontend): add React app with RTK Query and protected routes` |
| 7 | `test(frontend): add component and state tests` |
| 8 | `docs(ai): add prompt engineering strategy and knowledge base` |
| 9 | `feat(ai): add RAG agent service with evaluation and rate limiting` |
| 10 | `docs: add production incident diagnosis (exercise 4)` |
| 11 | `docs: add READMEs and DDD/Clean Architecture guide` |
| 12 | `chore: final review fixes` |

## Comandos útiles

- Instalar: `npm install` (raíz)
- Tests de un servicio: `npm test -w services/<svc> -- --coverage`
- Levantar todo: `docker compose up -d --build`
- Salud: `curl localhost:8080/api/auth/.well-known/jwks.json`
