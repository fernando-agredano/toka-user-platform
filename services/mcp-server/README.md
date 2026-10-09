# mcp-server

Módulo **extra** (no requerido por la prueba). Servidor Model Context Protocol que expone la plataforma a asistentes de IA (Claude Desktop, Claude Code, Cursor). Puerto interno `3006`, expuesto en el gateway como `/mcp`. Documentación completa en [docs/06-mcp-server.md](../../docs/06-mcp-server.md).

## Qué expone

- **11 tools:** lectura (`search_users`, `get_user`, `get_user_roles`, `list_roles`, `get_audit_events`, `get_audit_stats`, `ask_knowledge_base`) y escritura (`assign_role`, `activate_user`, y las destructivas `revoke_role` y `deactivate_user`, que exigen `confirm: true`).
- **Resources:** `toka://docs/{nombre}` y `toka://me`.
- **Prompts:** `security-review` y `access-audit`.

Cada tool reenvía el JWT del usuario al servicio dueño del dato: el asistente nunca puede más que la persona que lo conectó.

## Transportes

| Transporte | Uso | Arranque |
|---|---|---|
| Streamable HTTP (sin estado) | Docker, vía gateway | `docker compose up -d` y `POST http://localhost:8080/mcp` con `Authorization: Bearer <JWT>` |
| stdio | Local con `node` | `TOKA_ACCESS_TOKEN=<JWT> TOKA_API_URL=http://localhost:8080 node dist/stdio.js` |

## Variables

`PORT` (3006), `USER_SERVICE_URL`, `ROLE_SERVICE_URL`, `AUDIT_SERVICE_URL`, `AI_SERVICE_URL` (o `TOKA_API_URL` para todas), `MCP_RATE_LIMIT_PER_MINUTE` (30), `MCP_ALLOWED_ORIGINS`, `KNOWLEDGE_DIR`, además de las comunes (`REDIS_URL`, `RABBITMQ_URL`, `AUTH_JWKS_URL`, `JWT_ISSUER`, `JWT_AUDIENCE`).

## Comandos

```bash
npm test -w services/mcp-server -- --coverage     # tests unitarios (52)
npm run typecheck -w services/mcp-server           # tipos, incluidos tests y scripts
npm run verify -w services/mcp-server              # prueba extremo a extremo contra el stack levantado
```
