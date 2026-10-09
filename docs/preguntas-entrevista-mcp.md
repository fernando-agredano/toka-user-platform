# Preguntas probables de entrevista: servidor MCP

Detalle técnico en [06-mcp-server.md](06-mcp-server.md) y ADRs §54-60 en [decisiones.md](decisiones.md).

**1. ¿Qué aporta MCP frente a que el asistente llame a la API REST directamente?**
Un contrato estándar de descubrimiento: Claude Desktop, Claude Code o Cursor listan las tools, resources y prompts sin una integración a medida. El servidor es un adaptador delgado que traduce cada llamada a REST; no contiene lógica de negocio.

**2. ¿Cómo evitas que un asistente (o una inyección de prompt) haga más de lo que el usuario puede?**
El servidor no tiene identidad propia: reenvía el JWT del usuario y cada servicio dueño del dato decide con sus permisos. Además hay un pre-chequeo de permisos y un rate limit de 30 llamadas/min por usuario. Una inyección no obtiene acceso nuevo.

**3. ¿Qué pasa con las acciones destructivas? ¿`confirm: true` es una barrera real?**
`deactivate_user` y `revoke_role` devuelven una vista previa y no cambian nada sin `confirm: true`. No es una barrera de seguridad, porque un modelo podría pasar el parámetro; es una pausa para que el humano revise. La barrera real es el permiso del token y los invariantes del servicio dueño (p. ej. no quitar el último ADMIN).

**4. ¿Por qué un servidor sin estado y qué limitaciones asumes?**
Con Streamable HTTP sin sesión, un token nunca cruza usuarios y escala sin afinidad entre instancias. Se renuncia a notificaciones iniciadas por el servidor. Y la autenticación con Bearer JWT es provisional: la mejora natural es OAuth 2.1 con tokens de alcance limitado. Cada invocación, incluso las rechazadas, publica `mcp.tool.invoked` a la auditoría con argumentos redactados.
