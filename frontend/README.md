# Frontend – Toka

SPA en React 18 + Vite + TypeScript estricto. Estado con Redux Toolkit (RTK Query), formularios con react-hook-form + zod y estilos con Tailwind. Todas las llamadas van al API Gateway (`/api/*`), nunca directo a un microservicio.

## Requisitos

- Node.js 22 LTS y npm.
- Para desarrollo con recarga en caliente o para Docker: el stack del backend levantado (ver [README raíz](../README.md)). La SPA depende del gateway para el login, la cookie de refresh y las rutas `/api`.

## Desarrollo local (`npm run dev`)

El frontend no es workspace de npm del monorepo, así que se instala por separado:

```bash
# 1. Levanta el backend y el gateway (http://localhost:8080)
docker compose up -d --build

# 2. Dev server con recarga en caliente (http://localhost:5173)
cd frontend
npm install
npm run dev
```

En [vite.config.ts](vite.config.ts) el servidor de desarrollo reenvía `/api` a `http://localhost:8080`. El navegador ve un único origen (`localhost:5173`), así que la cookie httpOnly de refresh (`SameSite=Strict`, path `/api/auth`) se comporta igual que en producción. Si cambias el puerto del gateway, actualiza ese `proxy`.

## Con Docker

[Dockerfile](Dockerfile) es multi-stage: compila con `node:22-alpine` y sirve el `dist/` con `nginx-unprivileged` (no-root, escucha en 8080, con `HEALTHCHECK`). La configuración de nginx está en [nginx.conf](nginx.conf) (fallback de rutas de SPA, cabeceras y CSP).

No se expone directamente: el contenedor se levanta con el resto del stack y se accede a través del gateway:

```bash
docker compose up -d --build frontend gateway
# Aplicación: http://localhost:8080
```

Usuario semilla: `admin@toka.local` / `Admin123!` (ver `SEED_ADMIN_*` en `.env.example`).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en `:5173` con proxy a `/api` |
| `npm run build` | Typecheck (`tsc --noEmit`) + build de producción en `dist/` |
| `npm run lint` | Biome (lint + formato) |
| `npm test` | Jest + React Testing Library + MSW |
| `npm run test:coverage` | Igual, con reporte de coverage en `coverage/` |
| `npm run typecheck:test` | Typecheck de los tests (`tsconfig.test.json`) |

Desde la raíz del repositorio: `npm run test:all` ejecuta también esta suite junto con el backend.

## Estructura

```
src/
  @types/       contratos de la API (espejo de los DTOs del backend)
  api/          store, baseQuery con refresh, slices y endpoints RTK Query
  components/   ui/ (genéricos), forms/, users/, roles/, assistant/
  hooks/        redux tipado, permisos, toasts, debounce, tema
  pages/        una por pantalla
  routes/       router, guards por permiso y navegación
  templates/    layouts (auth y app)
  utils/        formato y errores ProblemDetails
  validators/   esquemas zod
test/           setup de Jest, servidor MSW, render con providers reales y fixtures
```

## State management

Todo el estado global vive en un único store de Redux Toolkit, [src/api/store.ts](src/api/store.ts). Tiene tres reducers:

| Clave en el store | Origen | Contenido |
|---|---|---|
| `api` | [src/api/api.ts](src/api/api.ts) (RTK Query) | Caché de datos del servidor: usuarios, roles, auditoría, respuestas del asistente. |
| `auth` | [src/api/auth-slice.ts](src/api/auth-slice.ts) | Sesión: `status` (`bootstrapping`, `authenticated`, `anonymous`), `accessToken` y `user`. |
| `toasts` | [src/api/toast-slice.ts](src/api/toast-slice.ts) | Notificaciones efímeras (éxito y error). |

### RTK Query: un `createApi`, endpoints por módulo

[src/api/api.ts](src/api/api.ts) define una única instancia de `createApi` con las etiquetas de caché (`User`, `UserRoles`, `Role`). Cada dominio inyecta sus endpoints desde su propio archivo, para que ningún módulo crezca demasiado:

| Archivo | Endpoints |
|---|---|
| [src/api/auth.api.ts](src/api/auth.api.ts) | `login`, `register`, `logout` |
| [src/api/users.api.ts](src/api/users.api.ts) | `listUsers`, `createUser`, `updateUser`, `deactivateUser`, `activateUser` |
| [src/api/roles.api.ts](src/api/roles.api.ts) | `listRoles`, `getUserRoles`, `assignRole`, `revokeRole` |
| [src/api/audit.api.ts](src/api/audit.api.ts) | `searchAudit`, `getAuditStats` |
| [src/api/ai.api.ts](src/api/ai.api.ts) | `chat` |

Efectos de sesión en los endpoints de autenticación:

- `login` despacha `sessionStarted` si la respuesta es correcta. Los errores no se manejan aquí: el listener del store ya los muestra como toast.
- `logout` despacha `sessionCleared` aunque la llamada al servidor falle (token vencido o red caída), así que la sesión local siempre termina.
- Al cerrar sesión, el listener de `store.ts` ejecuta `api.util.resetApiState()`, para que el siguiente usuario no vea caché del anterior.

### Sesión y refresh automático del token

El access token vive **solo en memoria** (en `auth.accessToken`). Al recargar la página se pierde, y la sesión se restaura con la cookie httpOnly de refresh. Este flujo tiene tres piezas:

1. **Arranque.** [src/main.tsx](src/main.tsx) llama a `refreshSession()` antes de renderizar y despacha `sessionStarted` o `sessionCleared`. Mientras tanto, `status` vale `bootstrapping` y los guards muestran un loader en lugar de redirigir a `/login`.
2. **Reintento ante 401.** [src/api/base-query.ts](src/api/base-query.ts) exporta `baseQueryWithReauth`. Si una petición responde 401, la función:
   - pide un refresh (`refreshSession()`);
   - si funciona, despacha `sessionStarted` con el nuevo token y **reintenta** la petición original;
   - si falla, despacha `sessionCleared` y devuelve un error `SESSION_EXPIRED`, que lleva a `/login`.

   Las rutas `auth/login`, `auth/register` y `auth/refresh` están excluidas (`NO_REAUTH_PREFIXES`): un 401 ahí es una credencial incorrecta, no un token vencido.
3. **Refresh único compartido.** `refreshSession()` guarda una sola promesa en vuelo (`inFlightRefresh`). Si varias peticiones reciben 401 a la vez, todas esperan la misma llamada. Esto importa porque el refresh token rota en cada uso y su reutilización se trata como robo; dos refresh simultáneos cerrarían la sesión. Se verificó en navegador forzando dos 401 concurrentes (sale un solo `/api/auth/refresh`). **Deuda:** `refreshSession()` y los guards `RequireAuth`/`GuestOnly` todavía no tienen tests automatizados (ver `PROGRESO.md`).

### Cómo lo consumen los componentes

- **Lectura de sesión:** `selectAuthStatus`, `selectCurrentUser`, `selectAccessToken` en `auth-slice.ts`.
- **Permisos en la UI:** el hook [src/hooks/use-permissions.ts](src/hooks/use-permissions.ts) expone `can('users:write')` a partir de `user.permissions`. Es solo UX: el backend vuelve a validar cada petición.
- **Guards de rutas:** [src/routes/guards.tsx](src/routes/guards.tsx) define `RequireAuth`, `GuestOnly` y `RequirePermission`. Reaccionan al estado del store, no a un router simulado, por eso se prueban como estado.
- **Errores:** un único listener en `store.ts` convierte cada rechazo de RTK Query en un toast con el `detail` de ProblemDetails ([src/utils/problem-details.ts](src/utils/problem-details.ts)). Ninguna pantalla repite ese manejo.

## Decisiones clave

- El access token nunca se guarda en `localStorage`: no es legible por XSS.
- Un 401 dispara un único refresh compartido y reintenta la petición; si el refresh falla, la sesión termina.
- Los errores del backend llegan como RFC 7807 y se muestran como toast desde un solo punto.
- Los permisos de la UI son orientativos; la autorización real está en el backend.
- Detalle completo en [`docs/decisiones.md`](../docs/decisiones.md) (Fases 6 y 7).
