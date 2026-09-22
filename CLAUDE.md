@AGENTS.md

# Claude Code en este repo

`AGENTS.md` (importado arriba) tiene las reglas transversales; no se repiten acá. Este archivo agrega solo lo propio de Claude Code.

> No quitar la línea `@AGENTS.md`: si existe un `CLAUDE.md`, Claude Code no lee `AGENTS.md` por su cuenta. Tampoco crear un `CLAUDE.local.md` en la raíz sin mantener esa importación.

## Reglas por zona

Se cargan solas cuando Claude trabaja con archivos de esa zona (frontmatter `paths`). Cada una indica qué docs leer y resume lo no negociable de su lado.

| Archivo                     | Zona                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `.claude/rules/backend.md`  | `src/server/`, `src/lib/`, `src/config/`, `src/app/api/`, `src/proxy.ts`, `prisma/`, `prisma7.config.ts`                |
| `.claude/rules/frontend.md` | `src/app/` (salvo `api/`), `src/features/`, `src/components/`, `src/hooks/`, `src/types/`, `src/utils/`, `src/proxy.ts` |

## Qué leer según la tarea

Se leen a demanda (no se importan) y siempre antes de imitar su patrón. Todas las rutas son desde la raíz del repo.

| Si la tarea es…                                  | Leer primero                                                                                                                                                              | Para qué                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Crear una feature de API o un endpoint           | `docs/arquitectura-backend.md`, `src/server/features/alumnos/` (los 5 archivos + `__tests__/`), `src/server/router.ts`, `src/server/app.ts`; comando `/nueva-feature-api` | Patrón de capas, `createRouter()` y registro con una línea en `app.ts`        |
| Fechas, listados, búsqueda o auditoría en la API | `docs/convenciones-backend.md`                                                                                                                                            | Convenciones y especificación de `src/server/shared/`                         |
| Lanzar o declarar errores (400/401/403/404/409)  | `src/server/errors/index.ts`, `src/server/errors/error-response.ts`, `docs/contrato-api.md` (Errores)                                                                     | Clases de error, códigos y `ErrorResponseSchema` para `createRoute()`         |
| Autenticación, roles y sesión en la API          | `src/lib/auth.ts`, `src/lib/auth-reglas.ts`, `src/server/middlewares/auth.ts`, `src/proxy.ts`                                                                             | Better Auth, `requireAuth()`/`requireRole()` y la redirección a `/login`      |
| Modelo de datos                                  | `prisma/schema.prisma`, `prisma7.config.ts`, `src/lib/prisma.ts`                                                                                                          | Se puede editar el schema; **no generar migraciones** (`AGENTS.md`, regla 10) |
| Acceso a datos (repository)                      | `src/lib/prisma.ts` y el repository de la feature                                                                                                                         | Único lugar donde se usa Prisma; traducción de P2002 a `ConflictError`        |
| Variables de entorno                             | `src/config/env.ts`, `.env.example`                                                                                                                                       | Agregar la variable en ambos. **Nunca leer ni abrir `.env`**                  |
| Subida de archivos / fotos                       | `src/lib/storage.ts`, `docker-compose.yml`, `docs/arquitectura-backend.md` (Archivos)                                                                                     | Único punto que conoce MinIO/S3; se guarda la clave, no la URL                |
| Tests de la API                                  | `src/server/features/alumnos/__tests__/`, `vitest.config.mts`                                                                                                             | Un archivo por service, repository mockeado, `pnpm test:run`                  |
| Crear una feature de UI                          | `docs/arquitectura-frontend.md`, `src/features/alumnos/`; comando `/nueva-feature-ui`                                                                                     | Patrón types / schema / api / keys / hooks / components                       |
| Página, layout, Sidebar o Header                 | `docs/arquitectura-frontend.md` (Roles y URLs; Layout), `src/app/layout.tsx`, `src/app/mesa/layout.tsx`, `src/components/layout/`                                         | Un segmento de URL por rol; Header y Sidebar vía `AppShell`                   |
| Consumir la API desde el frontend                | `docs/contrato-api.md`, `src/utils/fetch-json.ts`, `src/features/alumnos/api/` y `hooks/`                                                                                 | `fetchJson`, `ApiError`, query keys, paginación                               |
| Login, logout o rol en la UI                     | `docs/arquitectura-frontend.md` (Autenticación en el cliente), `src/features/auth/`                                                                                       | `authClient`; el rol en la UI no es seguridad                                 |
| Formularios o fechas en la UI                    | `docs/arquitectura-frontend.md` (Formularios; Fechas y horas), `docs/contrato-api.md` (Formatos)                                                                          | `zodResolver`, errores 400 por campo, fechas como string `YYYY-MM-DD`         |
| API de Next (proxy, Route Handlers, params)      | `node_modules/next/dist/docs/` (`index.md`)                                                                                                                               | Es Next 16: leer la guía antes de asumir comportamiento                       |
| Reglas de negocio                                | `docs/dominio.md`, `docs/decisiones.md` (Abiertas)                                                                                                                        | No modificarlas; lo pendiente se pregunta                                     |
| Agregar o sacar una dependencia                  | `docs/dependencias.md`, `package.json`                                                                                                                                    | Se acuerda antes; se documenta en el mismo PR                                 |
| Revisar cambios antes del PR                     | comando `/revisar-arquitectura`, `eslint.config.mjs`                                                                                                                      | Violaciones de arquitectura con archivo y línea (solo lectura)                |
| Comandos, hooks y CI                             | `package.json`, `.husky/`, `.github/workflows/ci.yml`, `.claude/settings.json`                                                                                            | Scripts (`pnpm check`), permisos y qué corre en el CI                         |
| Puesta en marcha y flujo del equipo              | `README.md`, `docker-compose.yml`                                                                                                                                         | Entorno local, ramas, PR y puntos de conflicto                                |

## Comandos de Claude Code (`.claude/commands/`)

| Comando                                         | Qué hace                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `/nueva-feature-api <dominio>`                  | Crea el esqueleto de una feature de API en `src/server/features/<dominio>/` |
| `/nueva-feature-ui <entidad-plural> <singular>` | Crea el esqueleto de una feature de UI en `src/features/<entidad>/`         |
| `/revisar-arquitectura`                         | Revisa el diff contra `main` según `AGENTS.md` y `docs/` (solo lectura)     |

`.claude/settings.json` pide confirmación antes de cualquier `git commit`, de crear una rama y de cualquier comando de migración. Es una red de seguridad; la regla es la 10 de `AGENTS.md`.

## Antes de terminar cualquier tarea

- Correr `pnpm check` (typecheck + lint + `test:run`) y reportar el resultado real.
- Dejar los cambios **sin commitear** y sin crear ramas, salvo pedido explícito de la persona. No ejecutar migraciones.
- Si el cambio modificó una regla, la estructura, el contrato de la API o una dependencia, actualizar el doc correspondiente (`AGENTS.md`, regla 9).
- Si algo no está claro o depende de una decisión abierta, decirlo en lugar de suponerlo.
