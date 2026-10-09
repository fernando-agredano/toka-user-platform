# Evaluación de recuperación

- Modelo: `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384 dims, dtype por defecto)
- Chunks: 43 de 4 documentos (0 con más de 256 wordpieces; el modelo trunca a 256)
- Casos: 30 dentro del dominio, 6 fuera

## Calidad del ranking (dentro del dominio)

| hit@1 | hit@4 | MRR | score medio del chunk correcto | score máximo medio fuera de dominio |
|---|---|---|---|---|
| 83.3% | 100.0% | 0.900 | 0.595 | 0.163 |

## Barrido de umbral

Recall = preguntas cuyo chunk correcto está en el top-4 **y** supera el umbral. Falsos positivos = preguntas fuera de dominio que aún recibirían contexto.

| Umbral | Recall | Falsos positivos | F1 |
|---|---|---|---|
| 0.20 | 100.0% | 33.3% | 0.800 |
| 0.25 ◀ | 100.0% | 0.0% | 1.000 |
| 0.30 | 100.0% | 0.0% | 1.000 |
| 0.35 | 100.0% | 0.0% | 1.000 |
| 0.40 | 100.0% | 0.0% | 1.000 |
| 0.45 | 93.3% | 0.0% | 0.966 |
| 0.50 | 86.7% | 0.0% | 0.929 |
| 0.55 | 70.0% | 0.0% | 0.824 |
| 0.60 | 43.3% | 0.0% | 0.605 |

**Umbral recomendado: 0.25** (F1 1.000).

## Fuera de dominio: mejor score por pregunta

- 0.154 · receta de paella valenciana → 03-guia-uso-sistema.md › Usuarios (requiere `users:read`)
- 0.182 · ¿Quién ganó el mundial de fútbol de 2018? → 03-guia-uso-sistema.md › Auditoría (requiere `audit:read`) > Filtros y estadísticas
- 0.238 · Escribe una función en Python para ordenar una lista → 01-politica-roles-permisos.md › Catálogo de permisos
- 0.106 · ¿Cuál es la capital de Francia? → 04-faq-soporte.md › Contacto y horario de soporte
- 0.075 · Cuéntame un chiste → 02-politica-contrasenas-seguridad.md › Requisitos de la contraseña
- 0.219 · ¿Cómo configuro un clúster de Kubernetes en AWS? → 03-guia-uso-sistema.md › Auditoría (requiere `audit:read`) > Tipos de evento

## Fallos (0)

Ninguno.
