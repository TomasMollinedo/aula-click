<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Aula Click (Nexo Académico)

Sistema de gestión de un centro de atención académica: alumnos, profesores, materias, bloques de horario y turnos. Equipo de 6 personas, 3 sprints de una semana.

**Alcance del Sprint 1:** `alumnos`, `profesores` (incluye materias asignadas y bloques de clase), `materias` y `turnos` (prioridad, capacidad, solapamientos y agenda diaria). `pagos` e `indicadores` **no** se crean todavía.

Este archivo tiene solo lo que vale para todo el repo. El detalle de cada lado está en `docs/` (ver "Documentación") y se lee antes de tocar esa parte.

## Next.js 16

Antes de escribir código que dependa del comportamiento de Next, leer la guía en `node_modules/next/dist/docs/` (ver bloque de arriba) y no asumir. Ya confirmado para Next 16.3.5:

- `middleware` está deprecado y se llama **`proxy`** (`src/proxy.ts`, `export function proxy`, corre en Node).
- Los `params` de los Route Handlers y de las páginas dinámicas son una `Promise`.

## Comandos

Node 24.19.0 y pnpm 11.21.0 (`corepack enable`). Scripts de `package.json`:

| Comando                                         | Qué hace                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev` / `build` / `start`                  | Servidor de desarrollo / build / servidor de producción             |
| `pnpm typecheck`                                | `next typegen` + `tsc --noEmit`                                     |
| `pnpm lint`                                     | ESLint (incluye las reglas de arquitectura)                         |
| `pnpm format`                                   | Prettier sobre todo el repo (`--write`)                             |
| `pnpm test`                                     | Vitest en **modo watch** (uso interactivo local)                    |
| `pnpm test:run`                                 | Vitest una sola pasada: **es el que se usa para verificar y en CI** |
| `pnpm check`                                    | `typecheck` + `lint` + `test:run`. Debe pasar antes de cada push    |
| `pnpm services:up` / `services:down`            | Levanta / baja Postgres y MinIO (Docker Compose)                    |
| `pnpm db:migrate` / `db:generate` / `db:studio` | Migraciones, cliente Prisma, explorador visual                      |

`postinstall` genera el cliente Prisma y `prepare` instala husky. Hooks: `pre-commit` corre lint-staged (eslint --fix + prettier) y `pre-push` corre `pnpm check`. El CI (`.github/workflows/ci.yml`) corre `pnpm check` en push a `main` y en cada PR.

## Mapa del repositorio

Next.js (App Router) aloja el frontend y la API en el mismo proyecto.

```
src/
├── app/                   # FRONTEND: rutas (páginas y layouts)
│   └── api/               # BACKEND: adaptadores de Hono (/api/v1) y Better Auth (/api/auth)
├── features/<entidad>/    # FRONTEND: todo lo de una entidad (api, hooks, components, schema, types)
├── components/            # FRONTEND: UI que no pertenece a ninguna entidad (ui/, layout/)
├── hooks/ types/ utils/   # FRONTEND: utilidades genéricas
├── proxy.ts               # redirige a /login si no hay cookie de sesión; nunca decide roles
├── config/env.ts          # BACKEND: único lugar que lee process.env
├── server/                # BACKEND: la API (Hono + OpenAPI), por feature y en capas
├── lib/                   # BACKEND: prisma.ts, auth.ts, storage.ts (solo servidor)
└── generated/prisma/      # cliente generado de Prisma: no se edita ni se commitea
```

Fuera de `src/`: `prisma/schema.prisma`, `prisma7.config.ts` (config del CLI de Prisma), `docker-compose.yml`, `.env.example`, `vitest.config.mts`, `eslint.config.mjs`.

**Vocabulario.** "Feature de API" = `src/server/features/<dominio>/`. "Feature de UI" = `src/features/<entidad>/`. Usan el mismo nombre (plural, minúsculas, sin acentos: `alumnos`, `profesores`, `materias`, `turnos`), pero son independientes: se comunican solo por HTTP.

## Documentación

| Archivo                                                          | Contenido                                                                                                 | Leer antes de…                                                                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [`docs/arquitectura-backend.md`](docs/arquitectura-backend.md)   | Capas, router, errores, auth, configuración, Prisma, archivos, tests                                      | tocar `src/server`, `src/lib`, `src/config`, `src/app/api` o `prisma/`                                   |
| [`docs/convenciones-backend.md`](docs/convenciones-backend.md)   | Fechas, paginación, búsqueda, auditoría, concurrencia, seguridad de cuentas y especificación de `shared/` | implementar cualquier endpoint o repository                                                              |
| [`docs/arquitectura-frontend.md`](docs/arquitectura-frontend.md) | Carpetas, features de UI, roles y URLs, datos, auth en el cliente, formularios, fechas, errores           | tocar `src/app` (salvo `api/`), `src/features`, `src/components`, `src/hooks`, `src/types` o `src/utils` |
| [`docs/contrato-api.md`](docs/contrato-api.md)                   | Lo que front y back acuerdan: URLs, formatos, paginación, filtros, errores                                | cualquier cambio que cruce el límite HTTP                                                                |
| [`docs/dominio.md`](docs/dominio.md)                             | Roles y reglas de negocio del Sprint 1                                                                    | implementar, validar o mostrar reglas de negocio                                                         |
| [`docs/decisiones.md`](docs/decisiones.md)                       | Decisiones tomadas (con su porqué) y decisiones abiertas                                                  | implementar algo que dependa de una decisión                                                             |
| [`docs/dependencias.md`](docs/dependencias.md)                   | Cada paquete de `package.json`, para qué sirve y de qué lado vive                                         | agregar o sacar una dependencia                                                                          |

## Reglas transversales

1. **Front y back se hablan solo por HTTP.** El frontend no importa nada de `src/server`, `src/lib`, `src/config` ni `src/generated` (lo hace cumplir ESLint). El contrato es `docs/contrato-api.md` más el OpenAPI de `/api/v1/openapi.json`.
2. **La autorización vive en la API.** `src/proxy.ts` solo redirige a `/login` si no hay cookie de sesión. Los segmentos de URL por rol (`/mesa`, `/profesor`, `/gerente`, `/portal`) y el rol que ve el frontend sirven para armar la UI, nunca como seguridad. Cada endpoint declara su rol con `requireAuth()` + `requireRole(...)`.
3. **Solo los repositories usan Prisma.** Excepciones: `src/lib/prisma.ts`, que lo instancia, y `src/lib/auth.ts`, que lo pasa al adaptador de Better Auth.
4. **`process.env` solo en `src/config/env.ts`** (excepción: `prisma7.config.ts`, que corre fuera de Next). Variable nueva = se agrega al schema de `env.ts` y a `.env.example`, que deben tener exactamente las mismas variables. Nunca leer ni abrir `.env`.
5. **Idioma.** El dominio va en español (rutas, campos JSON, códigos de error como `BLOQUE_LLENO`, textos de la UI). La infraestructura y el código genérico van en inglés.
6. **Piezas "A construir".** Lo marcado **A construir** en los docs (por ejemplo `src/server/shared/`, el `Actor`, `disableSignUp`, `AppShell`) todavía no existe. Si una tarea lo necesita, avisar a la persona antes de crearlo: se construye una sola vez, en un PR propio, con sus tests y según su especificación. Nunca se inventa una versión propia dentro de una feature.
7. **Decisiones abiertas.** Lo que depende de una decisión abierta de `docs/decisiones.md` no se implementa suponiendo una respuesta: se pregunta.
8. **Dependencias.** No se agregan sin acordarlo; versiones fijadas (Next, Prisma, Zod, `@hono/zod-openapi`). Si se agrega o se saca un paquete, `docs/dependencias.md` se actualiza en el mismo PR.
9. **Documentación viva.** Un PR que cambia una regla, la estructura de carpetas, el contrato de la API o `eslint.config.mjs` actualiza el doc correspondiente en el mismo PR. Los estados temporales ("todavía no se usa", "hoy está vacío") no van en los docs: van en un issue.
10. **Herramientas de IA (git y migraciones).**
    - **No crean ramas ni hacen commits o push**, salvo que la persona lo pida explícitamente en ese momento (un pedido anterior no vale para el siguiente). Dejan los cambios sin commitear y los resumen.
    - **Pueden editar `prisma/schema.prisma`** cuando la tarea lo requiera, pero **no generan migraciones**: no ejecutan `pnpm db:migrate`, `prisma migrate ...` ni `prisma db push`, y no crean ni editan nada en `prisma/migrations/`. Al terminar avisan qué cambió en el schema y que la persona debe coordinar con quien lleve el modelo de datos y correr `pnpm db:migrate` ella misma. `pnpm db:generate` sí está permitido (no toca la base).
    - No editan el bloque `nextjs-agent-rules` de este archivo.
    - Si una sugerencia rompe alguna regla, se corrige antes de commitear.

## Reglas que hace cumplir ESLint

Están en `eslint.config.mjs`. `pnpm lint` (y por lo tanto `pnpm check`, el pre-push y el CI) falla si se rompen. "Carpeta" incluye importarla entera (`@/types`) o cualquier cosa adentro (`@/types/index`).

| Regla                      | Qué prohíbe                                                                                                           | Dónde aplica                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `no-restricted-properties` | `process.env`                                                                                                         | todo `src/**`, salvo `src/config/env.ts`                                                                                      |
| OpenAPIHono                | importar `OpenAPIHono` de `@hono/zod-openapi` (los routers se crean con `createRouter()`)                             | todo `src/**`, salvo `src/server/router.ts` y `src/server/app.ts`                                                             |
| Prisma                     | importar `@/lib/prisma` o `@/generated/*`                                                                             | `src/server/**` y `src/app/api/**`, salvo `*.repository.ts` (en `src/lib/` sí se permite)                                     |
| Entre features de API      | importar `*.service`, `*.controller` o `*.routes` de otra feature (con alias `@/server/features/*/…` o `../…`)        | `src/server/features/**` (el repository de otra feature sí se puede importar)                                                 |
| `shared` → features        | importar `@/server/features/*` o `../features/*` (y Prisma)                                                           | `src/server/shared/**`                                                                                                        |
| Backend → frontend         | importar las carpetas `@/app`, `@/features`, `@/components`, `@/hooks`, `@/types` o `@/utils`                         | `src/server/**`, `src/lib/**`, `src/config/**` y `src/app/api/**`                                                             |
| Frontend → backend         | importar las carpetas `@/server`, `@/lib`, `@/config` o `@/generated`, con alias o con ruta relativa (`../../server`) | `src/app/**` (salvo `src/app/api/**`), `src/features/**`, `src/components/**`, `src/hooks/**`, `src/types/**`, `src/utils/**` |
| `components` → `features`  | importar la carpeta `@/features` (alias o relativo)                                                                   | `src/components/**`                                                                                                           |
| Genéricos → UI             | importar las carpetas `@/features` o `@/components` (alias o relativo)                                                | `src/hooks/**`, `src/types/**`, `src/utils/**`                                                                                |
| `proxy.ts` aislado         | importar cualquier módulo del proyecto (`@/…` o rutas relativas); solo `next/*` y paquetes como `better-auth/*`       | `src/proxy.ts`                                                                                                                |

Dentro de una misma feature de API los imports son **relativos** (`./alumnos.service`, o `../alumnos.service` desde `__tests__`): con alias, la regla entre features lo toma como si fuera otra feature.

ESLint no puede verificar el resto (por ejemplo `try/catch` en controllers, endpoints sin todos sus status codes, que una feature de UI use de otra algo que no sean sus hooks, o páginas de un rol fuera de su segmento): eso se revisa en el PR.

## Flujo de trabajo del equipo

- Ramas por feature (`feat/alumnos-...`), PR a `main`; nadie commitea directo a `main`. Antes de pushear: `pnpm check`.
- Puntos de conflicto frecuentes: `package.json`, `pnpm-lock.yaml`, `prisma/schema.prisma`, `src/server/app.ts` y `eslint.config.mjs`. Los cambios en esos archivos van en PRs chicos y frecuentes. Cada feature de API se registra en `src/server/app.ts` con una sola línea (`app.route(...)`).
- Los cambios al `schema.prisma` y sus migraciones se coordinan con quien lleve el modelo de datos; no se generan migraciones en paralelo sin avisar.
- Un cambio en el contrato de la API (un campo, un formato, un código de error) se avisa al otro lado y se refleja en `docs/contrato-api.md` en el mismo PR.
- El bloque `nextjs-agent-rules` de arriba lo regenera `next dev`: no editarlo; si aparece en un diff, commitearlo junto con el trabajo.
