# Evaluación de recuperación

- Modelo: `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384 dims, dtype q8)
- Chunks: 43 de 4 documentos (0 con más de 256 wordpieces; el modelo trunca a 256)
- Casos: 30 dentro del dominio, 6 fuera

## Calidad del ranking (dentro del dominio)

| hit@1 | hit@4 | MRR | score medio del chunk correcto | score máximo medio fuera de dominio |
|---|---|---|---|---|
| 83.3% | 96.7% | 0.898 | 0.595 | 0.169 |

## Barrido de umbral

Recall = preguntas cuyo chunk correcto está en el top-4 **y** supera el umbral. Falsos positivos = preguntas fuera de dominio que aún recibirían contexto.

| Umbral | Recall | Falsos positivos | F1 |
|---|---|---|---|
| 0.20 | 96.7% | 33.3% | 0.789 |
| 0.25 ◀ | 96.7% | 0.0% | 0.983 |
| 0.30 | 96.7% | 0.0% | 0.983 |
| 0.35 | 96.7% | 0.0% | 0.983 |
| 0.40 | 96.7% | 0.0% | 0.983 |
| 0.45 | 93.3% | 0.0% | 0.966 |
| 0.50 | 86.7% | 0.0% | 0.929 |
| 0.55 | 73.3% | 0.0% | 0.846 |
| 0.60 | 53.3% | 0.0% | 0.696 |

**Umbral recomendado: 0.25** (F1 0.983).

## Fuera de dominio: mejor score por pregunta

- 0.175 · receta de paella valenciana → 03-guia-uso-sistema.md › Asistente IA (requiere `ai:use`)
- 0.181 · ¿Quién ganó el mundial de fútbol de 2018? → 03-guia-uso-sistema.md › Auditoría (requiere `audit:read`) > Filtros y estadísticas
- 0.240 · Escribe una función en Python para ordenar una lista → 01-politica-roles-permisos.md › Catálogo de permisos
- 0.107 · ¿Cuál es la capital de Francia? → 04-faq-soporte.md › Contacto y horario de soporte
- 0.085 · Cuéntame un chiste → 02-politica-contrasenas-seguridad.md › Requisitos de la contraseña
- 0.228 · ¿Cómo configuro un clúster de Kubernetes en AWS? → 03-guia-uso-sistema.md › Auditoría (requiere `audit:read`) > Tipos de evento

## Fallos (1)

- ¿Qué permisos existen en la plataforma? — esperado en posición 5; top-1: 01-politica-roles-permisos.md › Objetivo (0.598)
