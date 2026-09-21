# Arquitectura del backend — Aula Click

## Stack

- **Next.js 16** — el `app/` sirve tanto las páginas como los route handlers que exponen la API.
- **Hono + `@hono/zod-openapi`** — el framework de la API real, montado adentro de Next.
- **Prisma 7** (`@prisma/adapter-pg`, driver `pg`) — ORM contra Postgres.
- **better-auth** — sesión y autenticación, con adapter de Prisma.
- **Zod 4** — validación de entrada/salida, y genera el spec de OpenAPI.
- **MinIO / S3** (`@aws-sdk/client-s3`) — almacenamiento de archivos.
- **Docker Compose** — levanta Postgres y MinIO en desarrollo (`pnpm services:up`).

## Cómo arrancan las piezas

1. `docker-compose.yml` levanta Postgres y MinIO.
2. `src/config/env.ts` valida **todas** las variables de entorno con Zod al importarse por
   primera vez — si falta o está mal una, tira una excepción con el detalle de qué falta.
   Fail-fast: no hay forma de que la app arranque "a medias" por una env var mala.
3. `src/lib/prisma.ts`, `src/lib/auth.ts`, `src/lib/storage.ts` — instancias singleton de
   Prisma Client, better-auth y el cliente de S3/MinIO, cada uno leyendo de `env`.
4. `src/server/app.ts` arma la instancia de Hono (`createRouter().basePath('/api/v1')`),
   monta un router por feature, y expone `/api/v1/openapi.json` + Swagger UI en
   `/api/v1/docs`.
5. Dos adaptadores en `app/api/` conectan Hono/better-auth con Next:
   - `app/api/v1/[[...route]]/route.ts` — `handle(app)` de `hono/vercel`, expone la API de
     negocio.
   - `app/api/auth/[...all]/route.ts` — `toNextJsHandler(auth)`, expone better-auth aparte,
     con su propio prefijo (`/api/auth/...`), sin mezclarse con `/api/v1/...`.

## Capas de una feature (`server/features/<entidad>/`)

Cada entidad (`alumnos`, `profesores`, `materias`, `turnos`) tiene la misma forma, feature-first:

| Archivo                               | Responsabilidad (tal cual el comentario que dejó cada stub)                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<entidad>.routes.ts`                 | Contrato HTTP: cada endpoint se declara con `createRoute()` de `@hono/zod-openapi` y se registra acá. Es la fuente del spec de OpenAPI.              |
| `<entidad>.controller.ts`             | Recibe el dato ya validado, llama al service, arma la respuesta (201, 204...). No accede a la base, no aplica reglas de negocio, no usa `try/catch`. |
| `<entidad>.service.ts`                | Reglas de negocio. No conoce HTTP ni Prisma. Lanza `AppError` o sus subclases.                                                                       |
| `<entidad>.repository.ts`             | Único archivo de la feature que usa Prisma. Traduce errores del motor (ej. `P2002` → `ConflictError`). Sin reglas de negocio.                        |
| `<entidad>.validation.ts`             | Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio.                                                           |
| `__tests__/<entidad>.service.test.ts` | Un test automatizado (Vitest) por service.                                                                                                           |

Hoy los cinco archivos de cada entidad son literalmente `export {}` con el comentario de
arriba — es un esqueleto que define el contrato de dónde va cada cosa, sin lógica real
todavía.

## Manejo de errores

Jerarquía en `server/errors/`, todas heredan de `AppError`:

| Clase                 | HTTP            | `code`                                                 |
| --------------------- | --------------- | ------------------------------------------------------ |
| `ValidationError`     | 400             | `VALIDACION`                                           |
| `UnauthorizedError`   | 401             | `NO_AUTENTICADO`                                       |
| `ForbiddenError`      | 403             | `SIN_PERMISO`                                          |
| `NotFoundError`       | 404             | `NO_ENCONTRADO`                                        |
| `ConflictError`       | 409             | `CONFLICTO` (ej. solapamiento de turno, DNI duplicado) |
| `AppError` (genérica) | 500 por defecto | `ERROR_INTERNO`                                        |

`errorHandler` (`server/errors/error-handler.ts`) captura cualquier `AppError` y lo serializa
siempre con la misma forma — **este es el contrato real que tiene que conocer el frontend**:

```json
{ "error": { "code": "CONFLICTO", "message": "...", "details": { "...": "..." } } }
```

`details` es opcional. Un error no controlado (no es `AppError` ni `HTTPException` de Hono)
se loguea con `console.error` y responde 500 genérico sin exponer detalles internos.

`defaultHook` de `createRouter()` (`server/router.ts`) convierte automáticamente cualquier
fallo de validación de Zod en un `ValidationError` (400) con ese mismo formato — no hace
falta lanzarlo a mano en cada `controller`.

## Autenticación y roles

`src/lib/auth.ts` configura better-auth con `emailAndPassword` habilitado y un campo extra:

```ts
user: {
  additionalFields: {
    role: { type: 'string', required: false, input: false },
  },
},
```

`input: false` es importante: nadie puede asignarse un rol al registrarse, se setea después
por otro medio (a definir). **Los valores concretos del rol están pendientes** — el propio
comentario en el archivo lo marca como decisión abierta.

Dos middlewares en `server/middlewares/auth.ts`, para usar en cualquier `routes.ts`:

- `requireAuth()` — exige sesión válida, guarda `user`/`session` en el contexto de Hono, o
  tira `UnauthorizedError` (401).
- `requireRole(...roles)` — se usa después de `requireAuth()`; tira `ForbiddenError` (403) si
  el rol del usuario no está en la lista permitida.

`src/proxy.ts` (así se llama en Next 16, no `middleware.ts`) es deliberadamente simple: solo
redirige a `/login` si no hay cookie de sesión. No decide roles — esa decisión vive 100% en
la API, con los middlewares de arriba.

## Reglas de arquitectura forzadas por ESLint (`eslint.config.mjs`)

No son convenciones de palabra, son errores de lint si se rompen:

1. **`process.env` solo se lee en `config/env.ts`.** Cualquier otro archivo que lo toque
   directo (`no-restricted-properties`) rompe el lint.
2. **Solo `*.repository.ts` importa Prisma** (`@/lib/prisma`, `@/generated/*`). Ni el
   `service`, ni el `controller`, ni nada de `app/`/`components/` puede importarlo directo.
3. **Una feature de `server/` solo puede importar el `repository` de otra feature** (para
   lecturas cruzadas) — nunca su `service`, `controller` o `routes`. Ejemplo: si `turnos`
   necesita confirmar que un alumno existe, puede leer `alumnos.repository.ts`, pero no le
   toca las reglas de negocio de `alumnos.service.ts`. Esto evita que las features queden
   acopladas por sus reglas de negocio internas.
4. **El frontend nunca importa código de servidor** — `@/server/*`, `@/lib/auth`,
   `@/lib/storage` bloqueados desde `src/app/**` y `src/components/**`. Ver
   [`arquitectura-frontend.md`](./arquitectura-frontend.md) para el detalle completo de esta
   regla y lo que implica del lado del cliente.
