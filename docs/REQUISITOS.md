# Checklist de requisitos – Prueba Técnica Toka (Senior Full-Stack IA)

Transcripción de los requisitos y criterios de evaluación del PDF oficial. Usar en la Fase 12.
Marcar cada punto con su evidencia (ruta de archivo).

## Ejercicio 1 – Arquitectura

Requisitos técnicos
- [ ] 3-4+ microservicios independientes (Auth, User, Audit, Role)
- [ ] Comunicación síncrona (REST) y asíncrona (RabbitMQ)
- [ ] Estrategia multi-DB: SQL (transaccional), MongoDB (auditoría), Redis (caching)
- [ ] Microservicio/módulo de IA con RAG en la arquitectura
- [ ] Ejecutable localmente con Docker Compose

Entregables
- [ ] Diagrama de arquitectura (Mermaid/visual) con todos los microservicios e interacciones
- [ ] Justificación de decisiones técnicas
- [ ] Explicación del flujo de datos entre microservicios
- [ ] Diseño de docker-compose.yml
- [ ] Explicación de DDD y Clean Architecture

Evaluación
- [ ] Claridad y cohesión arquitectónica
- [ ] Patrones adecuados (DDD, Clean, CQRS si aplica)
- [ ] Seguridad y escalabilidad
- [ ] Comunicación síncrona y asíncrona bien diseñada
- [ ] Estrategia multi-DB justificada
- [ ] Integración de IA en la arquitectura
- [ ] Dockerización completa y funcional
- [ ] Resiliencia y manejo de fallos entre servicios

## Ejercicio 2 – Microservicios

Requisitos técnicos
- [ ] 3-4+ microservicios implementados, independientes y dockerizados
- [ ] REST entre servicios + al menos un flujo asíncrono con RabbitMQ
- [ ] DDD y Clean Architecture en cada servicio
- [ ] Autenticación OAuth2/OIDC distribuida (JWT con validación distribuida)
- [ ] Multi-DB según el diseño
- [ ] Dockerfile por servicio + compose que orquesta servicios y dependencias
- [ ] Tests unitarios con coverage ≥ 70%
- [ ] Logging estructurado JSON en cada servicio
- [ ] ORM (Prisma / Mongoose)

Entregables
- [ ] Código fuente de todos los microservicios
- [ ] Dockerfiles
- [ ] docker-compose.yml funcional
- [ ] Tests unitarios + coverage report (versionado)
- [ ] Documentación de cómo ejecutar el sistema completo
- [ ] Explicación de cómo se aplicaron DDD y Clean Architecture

Evaluación
- [ ] Cumplimiento funcional
- [ ] Uso correcto de ORM y acceso a datos
- [ ] Código limpio, seguro, SOLID
- [ ] DDD y Clean Architecture correctos
- [ ] Comunicación síncrona/asíncrona bien implementada
- [ ] Independencia y desacoplamiento
- [ ] Autenticación distribuida funcionando
- [ ] Coverage adecuado
- [ ] Dockerización funcional
- [ ] Logging estructurado
- [ ] OWASP: validación de inputs, sanitización

## Ejercicio 3 – Front-end

Requisitos técnicos
- [ ] React + TypeScript
- [ ] State management (Redux Toolkit)
- [ ] Consume los microservicios (vía gateway)
- [ ] Loading states
- [ ] Error states y mensajes
- [ ] Validación de formularios
- [ ] Feedback visual
- [ ] Tests (Jest + React Testing Library)
- [ ] Front incluido en docker-compose.yml

Entregables
- [ ] Código fuente del front
- [ ] Configuración de state management
- [ ] Tests de componentes y lógica
- [ ] Integración con los microservicios
- [ ] Documentación de cómo ejecutar el front
- [ ] docker-compose.yml actualizado

Evaluación
- [ ] Funcionalidad de la UI
- [ ] Uso correcto de state management
- [ ] Integración correcta
- [ ] Estados de carga, error y éxito
- [ ] Calidad de TypeScript
- [ ] Tests funcionando
- [ ] UX básica (feedback, validaciones)
- [ ] Front dockerizado

## Ejercicio 4 – Diagnóstico

Escenario: no se guardan registros, errores 500 en algunos servicios, alta latencia del agente IA.

Debe incluir
- [ ] Hipótesis de causas (BD, comunicación entre servicios, red, agentes IA)
- [ ] Plan de diagnóstico sistemático con logs estructurados y herramientas de debugging
- [ ] Uso de logs centralizados
- [ ] Problemas de IA: latencia, costos de tokens, rate limiting
- [ ] Comunicación del avance a stakeholders

Evaluación
- [ ] Lógica del análisis y priorización de hipótesis
- [ ] Prioridad de acciones (qué verificar primero)
- [ ] Uso adecuado de logs y debugging
- [ ] Problemas de microservicios (comunicación, fallos en cascada)
- [ ] Diagnóstico de IA (latencia, costos, rate limits)
- [ ] Comunicación clara y estructurada

## Ejercicio 5 – IA y Agentes

Requisitos técnicos
- [ ] Agente con API de IA (Gemini)
- [ ] RAG con vector DB (Qdrant)
- [ ] Pipeline de embeddings
- [ ] Prompt engineering documentado (system prompt, few-shot, chain-of-thought si aplica)
- [ ] Evaluación: latencia
- [ ] Evaluación: costo de tokens (input/output)
- [ ] Evaluación: validación básica de calidad
- [ ] Integrado con al menos un microservicio

Entregables
- [ ] Código del microservicio de IA
- [ ] Pipeline de embeddings
- [ ] Documentación de prompt engineering
- [ ] Código de evaluación (latencia, costos)
- [ ] Ejemplo de uso integrado con los microservicios
- [ ] Explicación de la integración con el sistema existente

Evaluación
- [ ] Integración funcional con los microservicios
- [ ] RAG correcto con vector DB
- [ ] Calidad del prompt engineering
- [ ] Métricas de latencia y costo
- [ ] Manejo de errores y rate limiting de APIs de IA
- [ ] Costos y optimización de tokens
- [ ] Validación de respuestas del agente

## Entregables globales

- [ ] Repositorio o carpeta comprimida
- [ ] Arquitectura: diagramas, justificación, compose, DDD/Clean
- [ ] Microservicios: código, Dockerfiles, compose, tests + coverage, docs de ejecución
- [ ] IA: código, embeddings, prompt engineering, evaluación
- [ ] Front-end: código, state management, tests
- [ ] Análisis: respuesta del ejercicio 4
