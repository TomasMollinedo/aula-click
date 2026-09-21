# Aula Click

Sistema de gestión para un centro de atención académica — Ingeniería de Software (UCASAL).

Next.js (App Router) + API con Hono/OpenAPI + Prisma (PostgreSQL) + Better Auth + MinIO.

## Requisitos

- Node.js **24.19.0** (usar nvm / nvm-windows)
- pnpm **11.21.0**, vía corepack: `corepack enable` (toma la versión de `packageManager` en `package.json`)
- Docker Desktop (con WSL 2 en Windows)
- VS Code con las extensiones recomendadas del proyecto

## Puesta en marcha

1. Clonar el repositorio y entrar a la carpeta:

   ```bash
   git clone <url-del-repo>
   cd aula-click
   ```

2. Usar la versión de Node del proyecto y activar pnpm:

   ```bash
   nvm install 24.19.0 && nvm use 24.19.0
   corepack enable
   ```

3. Copiar las variables de entorno:

   ```bash
   cp .env.example .env        # PowerShell: Copy-Item .env.example .env
   ```

4. Generar un secreto y pegarlo en `BETTER_AUTH_SECRET` del `.env` (es obligatorio, mínimo 32 caracteres):

   ```bash
   openssl rand -base64 32
   # sin openssl: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

5. Levantar Postgres y MinIO:

   ```bash
   pnpm services:up
   ```

6. Instalar dependencias (esto ya ejecuta `prisma generate` y prepara los hooks de git):

   ```bash
   pnpm install
   ```

7. Generar el cliente de Prisma (necesario si cambió el `schema.prisma`):

   ```bash
   pnpm db:generate
   ```

8. Levantar la aplicación:

   ```bash
   pnpm dev
   ```

- App: http://localhost:3000
- API: http://localhost:3000/api/v1 — documentación Swagger en http://localhost:3000/api/v1/docs
- Consola MinIO: http://localhost:9001 (usuario `minioadmin`, clave `minioadmin123`)

> Las credenciales de MinIO y de Postgres que aparecen en este README y en `.env.example` son **solo para desarrollo local**. Nunca usarlas en un entorno compartido o de producción.

Si la app no arranca con `Variables de entorno inválidas o faltantes`, falta alguna variable en el `.env`: la lista de variables está en `.env.example`.

## Scripts

| Comando                                   | Descripción                                                  |
| ----------------------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                                | Servidor de desarrollo                                       |
| `pnpm build` / `pnpm start`               | Build de producción / servidor de producción                 |
| `pnpm typecheck`                          | Chequeo de tipos (`tsc --noEmit`)                            |
| `pnpm lint`                               | ESLint, incluye las reglas de arquitectura                   |
| `pnpm format`                             | Formatea todo el repo con Prettier                           |
| `pnpm test`                               | Tests con Vitest en modo watch (uso local)                   |
| `pnpm test:run`                           | Tests con Vitest, una sola pasada (verificaciones y CI)      |
| `pnpm check`                              | `typecheck` + `lint` + `test:run`. Correrlo antes de pushear |
| `pnpm services:up` / `pnpm services:down` | Levantar / detener Postgres y MinIO                          |
| `pnpm db:migrate`                         | Crear y aplicar migraciones (coordinar antes, ver más abajo) |
| `pnpm db:generate`                        | Generar el cliente de Prisma                                 |
| `pnpm db:studio`                          | Explorador visual de la base de datos                        |

## Estructura

```
src/
├── app/            # páginas (solo consumen la API por fetch) y rutas de Next
│   └── api/        # v1/[[...route]] (Hono) y auth/[...all] (Better Auth)
├── components/     # componentes, agrupados por entidad
├── config/env.ts   # variables de entorno validadas (único lugar que lee process.env)
├── proxy.ts        # redirige a /login si no hay sesión
├── server/         # app.ts, router.ts, middlewares/, errors/ y features/<dominio>/
│                   # (routes, controller, validation, service, repository, __tests__)
└── lib/            # prisma.ts, auth.ts, storage.ts
prisma/             # schema.prisma y migraciones
```

Features: `alumnos`, `profesores`, `materias`, `turnos`. El detalle de cada capa y de las reglas de dependencia está en AGENTS.md.

## Flujo de trabajo

- Una rama por feature (`feat/alumnos-...`) y PR a `main`. Nadie commitea directo a `main`.
- Antes de pushear, correr `pnpm check` (el hook `pre-push` y el CI lo corren igual).
- Al commitear, lint-staged corre ESLint y Prettier sobre los archivos modificados.
- Archivos donde es más probable tener conflictos: `package.json`, `pnpm-lock.yaml`, `prisma/schema.prisma` y `src/server/app.ts`. Cambiarlos en PRs chicos y frecuentes. Las migraciones se coordinan con quien lleve el modelo de datos: no generarlas en paralelo sin avisar.
- No agregar dependencias sin acordarlo con el equipo.

## Reglas de arquitectura

La fuente de las reglas (capas, errores, autenticación, tests, reglas de dominio y decisiones abiertas) es [AGENTS.md](./AGENTS.md). También es lo que leen las herramientas de IA del equipo.

## Notas

- No commitear el `.env`.
- Si pnpm muestra `ERR_PNPM_IGNORED_BUILDS`, ejecutar `pnpm approve-builds`.
- Postgres y MinIO se publican solo en `127.0.0.1`. Si el puerto 5432 está ocupado por un Postgres local, cambiar el mapeo a `127.0.0.1:5433:5432` en `docker-compose.yml` y el puerto en el `DATABASE_URL`.
