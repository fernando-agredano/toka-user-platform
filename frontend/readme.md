# Frontend – Toka

SPA en React 18 + Vite + TypeScript. Estado y datos con Redux Toolkit (RTK Query), formularios con react-hook-form + zod y estilos con Tailwind.

## Cómo correrlo

```bash
# Con todo el stack (recomendado): http://localhost:8080
docker compose up -d --build

# Desarrollo con recarga en caliente (requiere el stack arriba): http://localhost:5173
cd frontend && npm install && npm run dev
```

Vite redirige `/api` al gateway (`localhost:8080`), así que las cookies y rutas se comportan como en producción.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck + build de producción en `dist/` |
| `npm run lint` | Biome (lint + formato) |

## Estructura

```
src/
  @types/       contratos de la API
  api/          store, baseQuery con refresh, slices y endpoints RTK Query
  components/   ui/ (genéricos), forms/, users/, roles/, assistant/
  hooks/        redux tipado, permisos, toasts, debounce, tema
  pages/        una por pantalla
  routes/       router, guards por permiso y navegación
  templates/    layouts (auth y app)
  utils/        formato y errores ProblemDetails
  validators/   esquemas zod
```

## Decisiones clave

- El access token vive solo en memoria; la sesión se restaura con la cookie httpOnly de refresh.
- Un 401 dispara un único refresh compartido y reintenta la petición; si falla, vuelve a `/login`.
- Los errores del backend se muestran como toast con el `detail` de ProblemDetails.
- Detalle completo en [`docs/decisiones.md`](../docs/decisiones.md) (Fase 6).

Usuario semilla: `admin@toka.local` / `Admin123!`.
