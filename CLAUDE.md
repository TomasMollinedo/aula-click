@AGENTS.md

# Guía de archivos de referencia

`AGENTS.md` (importado arriba) tiene las reglas: no se repiten acá. Esta guía dice **qué leer según la tarea**, antes de escribir código. Se leen a demanda (no se importan) y siempre hay que leerlos antes de imitar su patrón. Todas las rutas son desde la raíz del repo.

| Si la tarea es…                                 | Leer primero                                                                                                                                    | Para qué                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Crear una feature o un endpoint                 | `src/server/features/alumnos/` (los 5 archivos + `__tests__/`), `src/server/router.ts`, `src/server/app.ts`; comando `/nueva-feature <dominio>` | Patrón de capas, `createRouter()` y cómo se registra una feature con una línea en `app.ts` |
| Lanzar o declarar errores (400/401/403/404/409) | `src/server/errors/index.ts`, `src/server/errors/error-response.ts`                                                                             | Clases de error y `ErrorResponseSchema` para `createRoute()`                               |
| Autenticación, roles, sesión                    | `src/lib/auth.ts`, `src/server/middlewares/auth.ts`, `src/proxy.ts`                                                                             | Better Auth, `requireAuth()`/`requireRole()` y la redirección a `/login`                   |
| Modelo de datos                                 | `prisma/schema.prisma`, `prisma7.config.ts`, `src/lib/prisma.ts`                                                                                | Se puede editar el schema; **no generar migraciones** (AGENTS.md, regla 12)                |
| Acceso a datos (repository)                     | `src/lib/prisma.ts` y el repository de la feature                                                                                               | Único lugar donde se usa Prisma; traducción de P2002 a `ConflictError`                     |
| Variables de entorno                            | `src/config/env.ts`, `.env.example`                                                                                                             | Agregar la variable en ambos. **Nunca leer ni abrir `.env`**                               |
| Subida de archivos / fotos                      | `src/lib/storage.ts`, `docker-compose.yml`                                                                                                      | Único punto que conoce MinIO/S3; se guarda la clave, no la URL                             |
| Escribir tests                                  | `src/server/features/alumnos/__tests__/`, `vitest.config.mts`                                                                                   | Un archivo por service, repository mockeado, `pnpm test:run`                               |
| Frontend (páginas y componentes)                | `src/app/<entidad>/page.tsx`, `src/components/<entidad>/`, `src/app/layout.tsx`                                                                 | Solo `fetch` a `/api/v1`; sin Prisma, services ni lógica de negocio                        |
| API de Next (proxy, Route Handlers, params)     | `node_modules/next/dist/docs/` (`index.md`)                                                                                                     | Es Next 16: leer la guía antes de asumir comportamiento                                    |
| Reglas de negocio del Sprint 1                  | `AGENTS.md`, secciones "Reglas de dominio" y "Decisiones abiertas"                                                                              | No modificarlas; lo pendiente (rol, recurrentes, excepciones) se pregunta                  |
| Revisar cambios antes del PR                    | comando `/revisar-arquitectura`, `eslint.config.mjs`                                                                                            | Violaciones de arquitectura con archivo y línea (solo lectura)                             |
| Comandos, hooks y CI                            | `package.json`, `.husky/`, `.github/workflows/ci.yml`, `.claude/settings.json`                                                                  | Scripts (`pnpm check`), permisos y qué corre en el CI                                      |
| Puesta en marcha y flujo del equipo             | `README.md`, `docker-compose.yml`                                                                                                               | Entorno local, ramas, PR y puntos de conflicto                                             |

## Antes de terminar cualquier tarea

- Correr `pnpm check` (typecheck + lint + `test:run`) y reportar el resultado real.
- Dejar los cambios **sin commitear** y sin crear ramas, salvo pedido explícito de la persona. No ejecutar migraciones.
- Si algo no está claro o depende de una decisión abierta, decirlo en lugar de suponerlo.
