# Frontend – Toka

SPA en React 18 + Vite + TypeScript estricto, con Redux Toolkit (RTK Query), react-hook-form + zod y Tailwind. Consume solo el API Gateway (`/api/*`).

Documentación completa (pantallas, state management, integración, UX, tests y ejecución): **[docs/03-frontend.md](../docs/03-frontend.md)**.

## Inicio rápido

```bash
docker compose up -d --build   # backend + gateway en http://localhost:8080
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

Scripts: `npm run build` · `npm run lint` · `npm test` · `npm run test:coverage` · `npm run typecheck:test`.

Usuario semilla: `admin@toka.local` / `Admin123!`.
