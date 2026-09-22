---
paths:
  - 'src/server/**'
  - 'src/lib/**'
  - 'src/config/**'
  - 'src/app/api/**'
  - 'src/proxy.ts'
  - 'prisma/**'
  - 'prisma7.config.ts'
---

# Backend (API)

Esta zona es el backend. Si en esta sesión todavía no se leyeron, leer antes de escribir código:

- `docs/arquitectura-backend.md` — siempre.
- `docs/convenciones-backend.md` — si la tarea toca endpoints, repositories, fechas, listados, búsqueda o auditoría.
- `docs/contrato-api.md` — si cambia algo que ve el frontend (rutas, campos, formatos, códigos de error).
- `docs/dominio.md` — si la tarea implementa reglas de negocio.

Checklist (resumen; la fuente es `docs/arquitectura-backend.md`):

- Feature de API nueva: `/nueva-feature-api <dominio>`. El router se crea con `createRouter()` y se registra con una sola línea en `src/server/app.ts`.
- Capas: routes (contrato HTTP) → controller (sin `try/catch` ni reglas) → service (sin HTTP ni Prisma; lanza `AppError` o subclases) → repository (único que usa Prisma; traduce `P2002` a `ConflictError`).
- De otra feature solo se importa su repository, para lecturas.
- Cada endpoint: `createRoute()` con schemas Zod de entrada y todos sus status codes, errores declarados con `ErrorResponseSchema` y rol con `requireAuth()` + `requireRole(...)`.
- Fechas, paginación, búsqueda y validaciones comunes salen de `src/server/shared/`. Está **A construir**: si una tarea lo necesita y no existe, avisar antes de crearlo.
- Un test por service, con el repository mockeado: camino feliz + un caso por cada error que lanza.
- Si cambia el contrato con el frontend, actualizar `docs/contrato-api.md` en el mismo cambio.
