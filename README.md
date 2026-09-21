# Aula Click

Sistema de gestión para un centro de atención académica — Ingeniería de Software (UCASAL).

## Requisitos

- Node.js 24.19.0 (usar nvm / nvm-windows)
- pnpm 11.21.0 (`npm install -g pnpm@11.21.0`)
- Docker Desktop (con WSL 2 en Windows)
- VS Code con las extensiones recomendadas del proyecto

## Puesta en marcha

```bash
git clone <url-del-repo>
cd aula-click
nvm install 24.19.0 && nvm use 24.19.0
pnpm install
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

Generar un secreto y pegarlo en `BETTER_AUTH_SECRET` del `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Levantar servicios y la aplicación:

```bash
pnpm services:up
pnpm dev
```

- App: http://localhost:3000
- Consola MinIO: http://localhost:9001 (minioadmin / minioadmin123)

## Scripts

| Comando                              | Descripción                           |
| ------------------------------------ | ------------------------------------- |
| `pnpm dev`                           | Servidor de desarrollo                |
| `pnpm lint` / `pnpm typecheck`       | Verificaciones de código              |
| `pnpm build`                         | Build de producción                   |
| `pnpm services:up` / `services:down` | Levantar / detener Postgres y MinIO   |
| `pnpm db:migrate`                    | Crear y aplicar migraciones           |
| `pnpm db:studio`                     | Explorador visual de la base de datos |
| `pnpm test`                          | Tests con Vitest                      |

## Notas

- No commitear el `.env`.
- Si pnpm muestra `ERR_PNPM_IGNORED_BUILDS`, ejecutar `pnpm approve-builds`.
- Si el puerto 5432 está ocupado por un Postgres local, cambiar el mapeo a `5433:5432` en `docker-compose.yml` y el puerto en el `DATABASE_URL`.
