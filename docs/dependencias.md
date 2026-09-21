# Dependencias del proyecto

Todo lo que está en `package.json`, para qué se usa y de qué lado (backend/frontend) vive.
Actualizar esta lista cada vez que se agregue o saque una dependencia — es fácil que quede
desactualizada si no.

## `dependencies`

### Backend (`src/server`, `src/lib`)

| Paquete                         | Para qué                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `hono`                          | Framework de la API real, montado adentro de Next (`server/app.ts`).                                                                          |
| `@hono/zod-openapi`             | Extiende Hono para declarar rutas (`createRoute()`) tipadas con Zod y generar el spec de OpenAPI automáticamente.                             |
| `@hono/swagger-ui`              | Sirve la UI de Swagger en `/api/v1/docs`, leyendo el spec que genera lo de arriba.                                                            |
| `@prisma/client`                | Cliente generado del ORM — lo usan solo los `*.repository.ts` (regla de ESLint).                                                              |
| `@prisma/adapter-pg`            | Adapter que conecta Prisma Client con el driver `pg` (en vez del engine binario clásico de Prisma).                                           |
| `pg`                            | Driver de Postgres para Node, usado por el adapter de arriba.                                                                                 |
| `better-auth`                   | Autenticación y sesiones. Una instancia server (`lib/auth.ts`, usada por `server/middlewares/auth.ts` y el route handler de `/api/auth/...`). |
| `@aws-sdk/client-s3`            | Cliente de S3 — apunta a MinIO en desarrollo (`lib/storage.ts`).                                                                              |
| `@aws-sdk/s3-request-presigner` | Genera URLs prefirmadas para subir/descargar archivos directo desde el navegador sin pasar el archivo por el server.                          |
| `dotenv`                        | Carga `.env` en scripts que no pasan por el runtime de Next (ej. `prisma migrate`).                                                           |

### Frontend (`src/app`, `src/features`, `src/components`)

| Paquete                 | Para qué                                                                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tanstack/react-query` | Cache y fetching de datos del lado del cliente. Todos los `use-<entidad>s.ts` / `use-create-<entidad>.ts` de `features/*/hooks/` lo usan.                                                                                                                       |
| `react-hook-form`       | Manejo de forms (`ProfesorForm.tsx`, `AlumnoForm.tsx`, `MateriaForm.tsx`, `TurnoForm.tsx`).                                                                                                                                                                     |
| `@hookform/resolvers`   | Conecta `react-hook-form` con un schema de Zod (`zodResolver`) para validar sin escribir la validación a mano.                                                                                                                                                  |
| `clsx`                  | Arma className condicional. Lo usa `utils/cn.ts`.                                                                                                                                                                                                               |
| `tailwind-merge`        | Resuelve conflictos cuando dos clases de Tailwind afectan la misma propiedad CSS (ej. un `className` que pisa el `p-4` default de un componente). También adentro de `utils/cn.ts`.                                                                             |
| `lucide-react`          | Íconos SVG como componentes de React (`<Search />`, `<Plus />`, etc.). Se instaló con `pnpm add lucide-react` — todavía no se usa en ningún componente.                                                                                                         |
| `date-fns`              | Utilidades de fechas. **Instalada pero todavía no se usa en ningún archivo** — hoy `AgendaCentro.tsx` usa `Date` nativo. Si no se termina usando en un par de HU más (turnos/calendario tienen bastante manejo de fechas), sacarla en vez de dejarla de adorno. |

### Ambos lados

| Paquete               | Para qué                                                                                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zod`                 | Validación de schemas. Cada lado tiene los suyos y **no se comparten** (regla de arquitectura, ver `arquitectura-backend.md`): `server/features/*/*.validation.ts` del lado del backend, `features/*/*.schema.ts` del lado del frontend. |
| `next`                | El framework — sirve tanto las páginas (`app/`) como los route handlers que exponen Hono y better-auth.                                                                                                                                  |
| `react` / `react-dom` | UI.                                                                                                                                                                                                                                      |

## `devDependencies`

| Paquete                                                        | Para qué                                                                                                                      |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `typescript`                                                   | Compilador — `pnpm typecheck` corre `tsc --noEmit`.                                                                           |
| `@types/node`, `@types/pg`, `@types/react`, `@types/react-dom` | Tipos de TypeScript para librerías que no los traen incluidos.                                                                |
| `eslint`                                                       | Linter.                                                                                                                       |
| `eslint-config-next`                                           | Reglas base recomendadas por Next.js.                                                                                         |
| `eslint-config-prettier`                                       | Apaga las reglas de ESLint que pelean con el formateo de Prettier (evita que los dos se contradigan).                         |
| `prettier`                                                     | Formateador de código — `pnpm format`.                                                                                        |
| `prettier-plugin-tailwindcss`                                  | Ordena las clases de Tailwind dentro de cada `className` con un criterio consistente al formatear.                            |
| `tailwindcss`                                                  | El framework de CSS.                                                                                                          |
| `@tailwindcss/postcss`                                         | Plugin de Tailwind v4 para PostCSS — la integración que usa Next (no la de Vite, que es un paquete distinto y no aplica acá). |
| `prisma`                                                       | CLI del ORM (`prisma migrate`, `prisma generate`, `prisma studio`).                                                           |
| `tsx`                                                          | Corre archivos `.ts` directo con Node, sin compilar antes — para scripts sueltos.                                             |
| `vitest`                                                       | Test runner. Los tests de `server/features/*/__tests__/*.service.test.ts` corren acá.                                         |
| `husky`                                                        | Engancha git hooks (`prepare` los instala al hacer `pnpm install`).                                                           |
| `lint-staged`                                                  | Corre ESLint/Prettier solo sobre los archivos en stage antes de cada commit (configurado al final de `package.json`).         |

## Lo que NO se instaló (y por qué)

| Paquete        | Por qué no                                                                                                                                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-router` | Next.js ya rutea con `app/` — instalarlo sería tener dos sistemas de ruteo compitiendo.                                                                                                                                                                     |
| `axios`        | Las llamadas son mismo origen (`/api/v1/...`); el `fetch` nativo de Next ya viene con cache/revalidación integrada al App Router. `src/utils/fetch-json.ts` es el wrapper propio que reemplaza lo que axios daría de fábrica (parseo de error consistente). |
| shadcn/ui      | Se evaluó, quedó **abierto** (ver `arquitectura-frontend.md`). Por ahora `components/ui/` está hecho a mano con la misma API que tendría si se instala después.                                                                                             |
