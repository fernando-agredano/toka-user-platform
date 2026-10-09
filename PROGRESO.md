# Progreso

## Estado de fases

- [x] Fase 0-1 – CONTEXTO + Arquitectura (Opus)
- [ ] Fase 2 – Monorepo + common + auth-service
- [ ] Fase 3 – user-service + role-service
- [ ] Fase 4 – audit-service + infra + compose funcional
- [ ] Fase 5 – Tests backend ≥70%
- [ ] Fase 6 – Frontend
- [ ] Fase 7 – Tests frontend
- [ ] Fase 8 – Diseño IA
- [ ] Fase 9 – ai-agent-service
- [ ] Fase 10 – Ejercicio 4 (diagnóstico)
- [ ] Fase 11 – Documentación
- [ ] Fase 12 – Revisión final

## Bitácora

### Fase 0-1

- Entregado: CONTEXTO.md, CLAUDE.md, docs/01-arquitectura.md, docker-compose.yml base.
- Decisiones: NestJS + Prisma, JWT RS256 con JWKS, outbox, Gemini free tier con adaptador LlmProvider, embeddings locales.
- Cómo explicarlo en la entrevista: arquitectura por bounded contexts; validación distribuida de JWT sin llamar a auth en cada request; outbox para no perder eventos; IA con costo cero en embeddings y degradación controlada ante rate limits.

## Pendientes / notas

- (vacío)
