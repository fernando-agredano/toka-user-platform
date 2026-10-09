# Ejemplos reales del agente IA (Ejercicio 5)

Generado el 2026-10-09T16:44:50.351Z por `npm run eval:agent -w services/ai-agent-service -- --examples` contra el stack de Docker Compose, a través del gateway (`http://localhost:8080`).

**Proveedor LLM que generó estas respuestas: `mock`.**

> **Aviso.** No había `GEMINI_API_KEY` configurada, así que el servicio arrancó con `MockProvider` (como exige el contrato). Es determinista: decide las llamadas a herramientas por palabras clave y redacta citando literalmente los fragmentos recuperados. Lo que estos ejemplos **sí** prueban es todo lo demás, que es real: embeddings locales, búsqueda en Qdrant, JWT del usuario propagado a user/role/audit-service, permisos, citas, métricas, score de calidad, caché y el evento `ai.query.completed`. Lo que **no** prueban es la calidad de redacción de Gemini. Para regenerar con Gemini: `GEMINI_API_KEY=... docker compose up -d ai-agent-service` y repetir el comando de arriba.

## 1. Pregunta de RAG

- **Usuario:** `eval-user@toka.local` — roles USER; permisos ai:use
- **Pregunta:** ¿Cuántos intentos fallidos puedo tener antes de que se bloquee mi cuenta?
- **Verificación automática:** cumple lo esperado

```bash
curl -s -X POST http://localhost:8080/api/ai/chat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"¿Cuántos intentos fallidos puedo tener antes de que se bloquee mi cuenta?"}'
```

Respuesta del servicio, sin editar:

```json
{
  "answer": "Tras 5 intentos fallidos de inicio de sesión en 15 minutos, la cuenta se bloquea temporalmente. Mientras dura el bloqueo, cualquier intento devuelve un error de \"demasiados intentos\", incluso con la contraseña correcta. El bloqueo se levanta solo cuando termina la ventana de 15 minutos. No hace falta contactar a soporte. [S1]\nTras 5 intentos fallidos en 15 minutos la cuenta se bloquea. [S3]",
  "conversationId": "df82ae64-f650-4a01-ac65-440be292d10f",
  "sources": [
    {
      "id": "S1",
      "title": "Política de contraseñas y seguridad de la cuenta",
      "section": "Bloqueo por intentos fallidos",
      "source": "02-politica-contrasenas-seguridad.md",
      "score": 0.69,
      "snippet": "- Tras **5 intentos fallidos de inicio de sesión en 15 minutos**, la cuenta se bloquea temporalmente.\n- Mientras dura el bloqueo, cualquier intento devuelve un error de \"demasiados intentos\", incluso con la contraseña c…"
    },
    {
      "id": "S3",
      "title": "Preguntas frecuentes de soporte",
      "section": "No puedo iniciar sesión",
      "source": "04-faq-soporte.md",
      "score": 0.55,
      "snippet": "**¿Dice \"credenciales inválidas\"?** Revisa mayúsculas (Bloq Mayús) y que el correo sea el correcto. Tras 5 intentos fallidos en 15 minutos la cuenta se bloquea.\n**¿Dice \"demasiados intentos\"?** La cuenta está bloqueada…"
    }
  ],
  "toolsUsed": [],
  "metrics": {
    "latencyMs": 91,
    "inputTokens": 2398,
    "outputTokens": 99,
    "costUsd": 0,
    "cached": false,
    "provider": "mock",
    "model": "mock"
  },
  "quality": {
    "score": 1,
    "checks": {
      "grounded": 1,
      "citationsValid": true,
      "noPii": true,
      "format": true,
      "length": true,
      "degraded": false
    }
  }
}
```

## 2. Herramienta de usuarios (search_users)

- **Usuario:** `eval-manager@toka.local` — roles MANAGER, USER; permisos ai:use, audit:read, roles:read, users:read, users:write
- **Pregunta:** Muéstrame los usuarios inactivos
- **Verificación automática:** cumple lo esperado

```bash
curl -s -X POST http://localhost:8080/api/ai/chat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"Muéstrame los usuarios inactivos"}'
```

Respuesta del servicio, sin editar:

```json
{
  "answer": "Encontré 0 usuarios en total. [D1]",
  "conversationId": "a18c082f-9669-4ccb-9170-111b221c3083",
  "sources": [
    {
      "id": "D1",
      "title": "Usuarios (search_users)",
      "source": "user-service",
      "snippet": "0 de 0 usuarios"
    }
  ],
  "toolsUsed": [
    "search_users"
  ],
  "metrics": {
    "latencyMs": 225,
    "inputTokens": 4786,
    "outputTokens": 9,
    "costUsd": 0,
    "cached": false,
    "provider": "mock",
    "model": "mock"
  },
  "quality": {
    "score": 1,
    "checks": {
      "grounded": 1,
      "citationsValid": true,
      "noPii": true,
      "format": true,
      "length": true,
      "degraded": false
    }
  }
}
```

## 3. Herramienta de auditoría (get_audit_summary)

- **Usuario:** `eval-manager@toka.local` — roles MANAGER, USER; permisos ai:use, audit:read, roles:read, users:read, users:write
- **Pregunta:** Dame un resumen de auditoría de hoy
- **Verificación automática:** cumple lo esperado

```bash
curl -s -X POST http://localhost:8080/api/ai/chat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"Dame un resumen de auditoría de hoy"}'
```

Respuesta del servicio, sin editar:

```json
{
  "answer": "Entre 2026-10-09 y 2026-10-09 hubo 98 eventos de auditoría, con 3 inicios de sesión fallidos y 0 cuentas bloqueadas [D1].\nLos tipos más frecuentes son: ai.query.completed (53), auth.login.succeeded (24), role.assigned (6), auth.user.registered (4), user.created (4) [D1].",
  "conversationId": "c38839b2-3671-4609-8c9d-ed65ea933da6",
  "sources": [
    {
      "id": "D1",
      "title": "Resumen de auditoría (get_audit_summary)",
      "source": "audit-service",
      "snippet": "98 eventos entre 2026-10-09 y 2026-10-09"
    }
  ],
  "toolsUsed": [
    "get_audit_summary"
  ],
  "metrics": {
    "latencyMs": 126,
    "inputTokens": 4588,
    "outputTokens": 68,
    "costUsd": 0,
    "cached": false,
    "provider": "mock",
    "model": "mock"
  },
  "quality": {
    "score": 1,
    "checks": {
      "grounded": 1,
      "citationsValid": true,
      "noPii": true,
      "format": true,
      "length": true,
      "degraded": false
    }
  }
}
```

## Evidencia en el resto del sistema

### El evento `ai.query.completed` llegó a audit-service

Consulta: `GET /api/audit?type=ai.query.completed&limit=1` como ADMIN. El evento lleva solo métricas, nunca el texto de la pregunta ni de la respuesta.

```json
{
  "items": [
    {
      "eventId": "5e21a268-4c7d-463b-913e-c8f2b0b42d77",
      "type": "ai.query.completed",
      "version": 1,
      "occurredAt": "2026-10-09T16:44:47.085Z",
      "correlationId": "a583559db3b6fd71ab7001554b21c05d",
      "source": "ai-agent-service",
      "actor": {
        "userId": "3d52e7e2-c37a-497d-89d9-65027e8d5a54",
        "ip": "192.168.97.1"
      },
      "data": {
        "requestId": "0b0a1f3a-2543-4baf-a170-9f30bfaa83d4",
        "conversationId": "1f4b2e43-ae66-470f-988a-296041ab0324",
        "provider": "mock",
        "model": "mock",
        "cached": false,
        "degraded": false,
        "latencyMs": 31,
        "inputTokens": 2424,
        "outputTokens": 87,
        "costUsd": 0,
        "toolsUsed": [],
        "qualityScore": 1
      }
    }
  ],
  "page": 1,
  "limit": 1,
  "total": 69
}
```

### Métricas agregadas

Consulta: `GET /api/ai/metrics` como ADMIN (permiso `audit:read`). Incluye todas las consultas registradas, también las de corridas anteriores.

```json
{
  "from": null,
  "to": null,
  "requests": 69,
  "cacheHitRate": 0.275,
  "degradedRate": 0,
  "latencyMs": {
    "p50": 22,
    "p95": 239
  },
  "llmLatencyMs": {
    "p50": 0,
    "p95": 3
  },
  "tokens": {
    "input": 152834,
    "output": 2847,
    "thoughts": 0
  },
  "costUsd": {
    "total": 0,
    "savedByCache": 0
  },
  "avgQualityScore": 1,
  "byProvider": [
    {
      "provider": "mock",
      "model": "mock",
      "requests": 50,
      "costUsd": 0
    },
    {
      "provider": "cache",
      "model": "cache",
      "requests": 19,
      "costUsd": 0
    }
  ]
}
```
