# Evaluación de recuperación

- Modelo: `Xenova/all-MiniLM-L6-v2` (384 dims, dtype por defecto)
- Chunks: 47 de 4 documentos (0 con más de 256 wordpieces; el modelo trunca a 256)
- Casos: 30 dentro del dominio, 6 fuera

## Calidad del ranking (dentro del dominio)

| hit@1 | hit@4 | MRR | score medio del chunk correcto | score máximo medio fuera de dominio |
|---|---|---|---|---|
| 70.0% | 86.7% | 0.784 | 0.630 | 0.430 |

## Barrido de umbral

Recall = preguntas cuyo chunk correcto está en el top-4 **y** supera el umbral. Falsos positivos = preguntas fuera de dominio que aún recibirían contexto.

| Umbral | Recall | Falsos positivos | F1 |
|---|---|---|---|
| 0.20 | 86.7% | 100.0% | 0.000 |
| 0.25 | 86.7% | 100.0% | 0.000 |
| 0.30 | 86.7% | 83.3% | 0.280 |
| 0.35 | 86.7% | 83.3% | 0.280 |
| 0.40 | 86.7% | 83.3% | 0.280 |
| 0.45 | 86.7% | 66.7% | 0.481 |
| 0.50 | 83.3% | 16.7% | 0.833 |
| 0.55 ◀ | 80.0% | 0.0% | 0.889 |
| 0.60 | 56.7% | 0.0% | 0.723 |

**Umbral recomendado: 0.55** (F1 0.889).

## Fuera de dominio: mejor score por pregunta

- 0.467 · receta de paella valenciana → 04-faq-soporte.md › ¿Puedo eliminar mi cuenta?
- 0.502 · ¿Quién ganó el mundial de fútbol de 2018? → 04-faq-soporte.md › ¿Puedo eliminar mi cuenta?
- 0.467 · Escribe una función en Python para ordenar una lista → 03-guia-uso-sistema.md › Cerrar sesión
- 0.451 · ¿Cuál es la capital de Francia? → 04-faq-soporte.md › ¿Puedo eliminar mi cuenta?
- 0.432 · Cuéntame un chiste → 02-politica-contrasenas-seguridad.md › Bloqueo por intentos fallidos
- 0.262 · ¿Cómo configuro un clúster de Kubernetes en AWS? → 04-faq-soporte.md › El Asistente IA dice que espere / "límite de solicitudes"

## Fallos (4)

- ¿Cómo se guardan las contraseñas? — esperado en posición 11; top-1: 02-politica-contrasenas-seguridad.md › Requisitos de la contraseña (0.634)
- ¿Puedo cambiar mi contraseña yo mismo? — esperado en posición 9; top-1: 04-faq-soporte.md › ¿Puedo cambiar mi correo? (0.634)
- ¿Qué filtros tiene la sección de auditoría? — esperado en posición 5; top-1: 01-politica-roles-permisos.md › Catálogo de permisos (0.668)
- ¿Cuánto tiempo se conservan los registros de auditoría? — esperado en posición 5; top-1: 03-guia-uso-sistema.md › Usuarios (requiere `users:read`) (0.641)
