# Dependencias del proyecto — Aula Click

Todo lo que está en `package.json`, para qué se usa y de qué lado (backend o frontend) vive. Si se agrega o se saca una dependencia, esta lista se actualiza **en el mismo PR** (`AGENTS.md`, regla 8). Ninguna dependencia se agrega sin acordarlo con el equipo.

## `dependencies`

### Backend (`src/server`, `src/lib`, `src/config`)

| Paquete                         | Para qué                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hono`                          | Framework de la API, montado adentro de Next (`src/server/app.ts`). Incluye el adaptador `hono/vercel` que usa `app/api/v1/[[...route]]/route.ts`. |
| `@hono/zod-openapi`             | Extiende Hono para declarar rutas tipadas con Zod (`createRoute()`) y generar el spec de OpenAPI. Re-exporta el `z` que usa el backend.            |
| `@hono/swagger-ui`              | Sirve Swagger UI en `/api/v1/docs`, leyendo el spec generado.                                                                                      |
| `@prisma/client`                | Cliente del ORM. Lo usan solo los `*.repository.ts` y `src/lib/` (regla de ESLint).                                                                |
| `@prisma/adapter-pg`            | Conecta Prisma Client con el driver `pg` (en lugar del engine binario clásico de Prisma).                                                          |
| `pg`                            | Driver de Postgres para Node, usado por el adaptador de arriba.                                                                                    |
| `@aws-sdk/client-s3`            | Cliente de S3; apunta a MinIO en desarrollo. Lo usa solo `src/lib/storage.ts`.                                                                     |
| `@aws-sdk/s3-request-presigner` | Genera las URLs prefirmadas **de lectura** (TTL 900 s) para mostrar archivos. La subida no usa URLs prefirmadas: va por multipart a la API.        |
| `dotenv`                        | Carga `.env` en lo que corre fuera del runtime de Next (`prisma7.config.ts`, usado por el CLI de Prisma).                                          |

### Frontend (`src/app`, `src/features`, `src/components`, `src/hooks`, `src/types`, `src/utils`)

| Paquete                         | Para qué                                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tanstack/react-query`         | Cache y pedido de datos del lado del cliente. Lo usan los hooks de `src/features/*/hooks/` y `src/app/providers.tsx`.                                                                       |
| `react-hook-form`               | Manejo de formularios (`<Singular>Form.tsx` de cada feature).                                                                                                                               |
| `@hookform/resolvers`           | Conecta `react-hook-form` con un schema de Zod (`zodResolver`).                                                                                                                             |
| `clsx`                          | Arma `className` condicionales. Lo usa `utils/cn.ts`.                                                                                                                                       |
| `tailwind-merge`                | Resuelve conflictos cuando dos clases de Tailwind afectan la misma propiedad (por ejemplo, un `className` que pisa el `p-4` por defecto de un componente). También dentro de `utils/cn.ts`. |
| `lucide-react`                  | Íconos SVG como componentes de React (`<Search />`, `<Plus />`…).                                                                                                                           |
| `date-fns`                      | Manejo de fechas en la UI sin errores de zona (`parseISO`, `format`); ver `arquitectura-frontend.md` → Fechas y horas.                                                                      |
| `class-variance-authority`      | Variantes (`variant`, `size`) de los primitivos de `components/ui/` (T-13/T-26: shadcn/ui hecho a mano, sin el CLI).                                                                        |
| `@radix-ui/react-slot`          | `asChild` del primitivo `Button` (por ejemplo, para que se renderice como un `Link` en vez de un `<button>`).                                                                               |
| `@radix-ui/react-dialog`        | Accesibilidad (foco, `Escape`, overlay) del primitivo `Dialog`.                                                                                                                             |
| `@radix-ui/react-select`        | Accesibilidad de teclado del primitivo `Select`.                                                                                                                                            |
| `@radix-ui/react-avatar`        | Fallback automático del primitivo `Avatar` cuando la imagen no carga (por ejemplo, la foto del profesor).                                                                                   |
| `@radix-ui/react-dropdown-menu` | Accesibilidad de teclado del primitivo `DropdownMenu` (lo usa `UserMenu` para el menú de "Cerrar sesión").                                                                                  |
| `@radix-ui/react-label`         | Asociación label ↔ control del primitivo `Label` (por ejemplo, con `Checkbox`, que no es un `<input>` nativo).                                                                              |
| `@radix-ui/react-checkbox`      | Accesibilidad de teclado y estado del primitivo `Checkbox`.                                                                                                                                 |
| `@radix-ui/react-tabs`          | Accesibilidad de teclado (flechas, `Home`/`End`) del primitivo `Tabs`.                                                                                                                      |
| `@radix-ui/react-tooltip`       | Retraso, posición y foco del primitivo `Tooltip`.                                                                                                                                           |

### Ambos lados

| Paquete               | Para qué                                                                                                                                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zod`                 | Validación de schemas. Cada lado tiene los suyos y **no se comparten** (decisión T-08): `src/server/features/*/*.validation.ts` en el backend (con el `z` de `@hono/zod-openapi`) y `src/features/*/*.schema.ts` en el frontend.                      |
| `better-auth`         | Autenticación y sesiones. Backend: la instancia del servidor (`src/lib/auth.ts`), usada por `src/server/middlewares/auth.ts` y el Route Handler de `/api/auth/...`. Frontend: el cliente de `better-auth/react` (`src/features/auth/auth-client.ts`). |
| `next`                | El framework: sirve las páginas (`app/`) y los Route Handlers que exponen Hono y Better Auth.                                                                                                                                                         |
| `react` / `react-dom` | UI.                                                                                                                                                                                                                                                   |

## `devDependencies`

| Paquete                                                        | Para qué                                                                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `typescript`                                                   | Compilador. `pnpm typecheck` corre `tsc --noEmit`.                                                                      |
| `@types/node`, `@types/pg`, `@types/react`, `@types/react-dom` | Tipos de TypeScript para librerías que no los traen incluidos.                                                          |
| `eslint`                                                       | Linter; incluye las reglas de arquitectura (`AGENTS.md` → Reglas que hace cumplir ESLint).                              |
| `eslint-config-next`                                           | Reglas base recomendadas por Next.js.                                                                                   |
| `eslint-config-prettier`                                       | Apaga las reglas de ESLint que pelean con el formateo de Prettier.                                                      |
| `prettier`                                                     | Formateador de código. `pnpm format`.                                                                                   |
| `prettier-plugin-tailwindcss`                                  | Ordena las clases de Tailwind dentro de cada `className` con un criterio consistente.                                   |
| `tailwindcss`                                                  | El framework de CSS.                                                                                                    |
| `@tailwindcss/postcss`                                         | Plugin de Tailwind v4 para PostCSS: la integración que usa Next (no la de Vite, que es otro paquete y no aplica acá).   |
| `prisma`                                                       | CLI del ORM (`prisma migrate`, `prisma generate`, `prisma studio`).                                                     |
| `tsx`                                                          | Corre archivos `.ts` directo con Node, sin compilar antes (scripts sueltos, seed).                                      |
| `vitest`                                                       | Test runner. Corre los tests de `src/server/features/*/__tests__/` y de `src/server/shared/__tests__/`.                 |
| `husky`                                                        | Engancha los git hooks (`prepare` los instala al hacer `pnpm install`).                                                 |
| `lint-staged`                                                  | Corre ESLint y Prettier solo sobre los archivos en stage antes de cada commit (configurado al final de `package.json`). |

## Lo que no se instaló (y por qué)

| Paquete                 | Por qué no                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-router`          | Next.js ya rutea con `app/`; instalarlo sería tener dos sistemas de ruteo compitiendo.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `axios`                 | Las llamadas son al mismo origen y siempre pasan por `utils/fetch-json.ts`, que da lo que axios daría de fábrica (parseo de error consistente en un `ApiError`). Cache, reintentos y estados de carga ya los da TanStack Query. Sería una capa de más.                                                                                                                                                                                                                                            |
| shadcn/ui (paquete/CLI) | Resuelto por T-26 (`decisiones.md`, antes D-08): se adopta su API y sus componentes, pero escritos a mano en `components/ui/`, no con el CLI. El CLI (`pnpm dlx shadcn@latest init`) trae un preset propio (paquete `cn`, `src/lib/utils.ts`, tokens de sidebar/charts, modo oscuro) que no encaja con esta arquitectura: `src/lib/` es zona backend y el frontend ya tiene su `utils/cn.ts`. Sí se instalan los `@radix-ui/react-*` de cada primitivo y `class-variance-authority`, uno por uno. |
