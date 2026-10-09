# ai-agent-service

Contexto **AI Assistant** (puerto interno `3005`, expuesto vía gateway en `/api/ai*`). Agente RAG con herramientas sobre los demás servicios. Responde preguntas sobre la plataforma citando su base de conocimiento y, cuando hace falta, datos reales de usuarios, roles y auditoría.

## Cómo funciona una consulta

1. Rate limit por usuario (token bucket en Redis, 5 req/min) y caché de respuestas (1 h).
2. Recuperación: la pregunta se convierte en un embedding local (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`) y se busca en Qdrant (`knowledge_base`) con un umbral mínimo (`RAG_MIN_SCORE`).
3. El LLM recibe el prompt y las herramientas que el **JWT del usuario** le permite usar. Cada herramienta llama al servicio dueño del dato con ese mismo token, así que el agente nunca tiene más permisos que quien pregunta.
4. Se calcula el costo en USD, el score de calidad determinista (0-1) y se publica `ai.query.completed` (solo métricas, sin el texto de la pregunta).

## Proveedores de LLM

Se elige con `LLM_PROVIDER`:

| Valor | Uso |
|---|---|
| `gemini` (por defecto) | Gemini API con nivel gratuito. Requiere `GEMINI_API_KEY`. |
| `ollama` | Modelo local (`docker compose --profile local-llm up -d`). |
| `mock` | Respuestas deterministas, sin clave ni internet. Es lo que usan los tests. |

Si `GEMINI_API_KEY` está vacío, el servicio arranca con `mock` y lo registra como advertencia. `LLM_FALLBACK_PROVIDER` define el respaldo cuando el primario falla.

## Endpoints

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/ai/chat` | `ai:use` |
| POST | `/api/ai/ingest` | `ADMIN` (reindexa `knowledge/*.md`) |
| GET | `/api/ai/metrics?from&to` | `audit:read` (p50/p95, tokens, costo, cache hit) |

## Estructura

```
src/
  domain/              cost-calculator, quality-evaluator, chunker, pii y sanitización (funciones puras)
  application/        casos de uso (chat, ingest, métricas), tools, resilient-llm, puertos y prompts
  infrastructure/      proveedores LLM, embeddings, Qdrant, Redis, Mongo, HTTP a servicios, RabbitMQ
  presentation/        AiController
knowledge/             base de conocimiento en Markdown (políticas, guía de uso, FAQ)
eval/                  evaluación de recuperación y del agente, con sus informes
config/                tabla de precios (llm-pricing.json)
```

## Tests y evaluación

```bash
npm test -w services/ai-agent-service -- --coverage        # unitarios (sin red ni modelos)
npm run eval:retrieval -w services/ai-agent-service        # calidad de recuperación (descarga el modelo de embeddings)
npm run eval:agent -w services/ai-agent-service            # agente end-to-end (requiere el stack arriba)
```

Detalle del diseño de prompts y de la evaluación: [docs/05-prompt-engineering.md](../../docs/05-prompt-engineering.md), ejemplos reales en [docs/05-ejemplos.md](../../docs/05-ejemplos.md) e integración en [docs/05-integracion.md](../../docs/05-integracion.md).
