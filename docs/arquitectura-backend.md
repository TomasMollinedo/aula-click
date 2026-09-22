# Arquitectura del backend — Aula Click

Cómo está armada la API y qué reglas sigue cada capa. Las convenciones que se repiten en todas las features (fechas, paginación, búsqueda, auditoría y la especificación de `src/server/shared/`) están en [`convenciones-backend.md`](./convenciones-backend.md). Lo que ve el frontend (URLs, formatos, errores) está en [`contrato-api.md`](./contrato-api.md). Las reglas transversales y las de ESLint, en `AGENTS.md`.

## Stack

- **Next.js 16**: el `app/` sirve las páginas y los Route Handlers que exponen la API.
- **Hono + `@hono/zod-openapi`**: el framework de la API, montado adentro de Next.
- **Prisma 7** (`@prisma/adapter-pg`, driver `pg`): ORM contra Postgres.
- **Better Auth**: autenticación y sesiones, con adaptador de Prisma.
- **Zod 4**: validación de entrada y salida; genera el spec de OpenAPI.
- **MinIO / S3** (`@aws-sdk/client-s3`): almacenamiento de archivos.
- **Docker Compose**: levanta Postgres y MinIO en desarrollo (`pnpm services:up`).
- **Vitest**: tests de services y de `shared/`.

## Cómo arrancan las piezas

1. `docker-compose.yml` levanta Postgres y MinIO.
2. `src/config/env.ts` valida **todas** las variables de entorno con Zod al importarse por primera vez. Si falta o está mal una, tira una excepción con el detalle de qué falta: la app no puede arrancar "a medias".
3. `src/lib/prisma.ts`, `src/lib/auth.ts` y `src/lib/storage.ts` crean las instancias únicas de Prisma Client, Better Auth y el cliente de S3/MinIO, leyendo de `env`.
4. `src/server/app.ts` arma la instancia de Hono (`createRouter().basePath('/api/v1')`), instala `app.onError(errorHandler)` y el `notFound`, registra un router por feature y expone `/api/v1/openapi.json` y Swagger UI en `/api/v1/docs`.
5. Dos adaptadores en `src/app/api/` conectan Hono y Better Auth con Next:
   - `app/api/v1/[[...route]]/route.ts`: `handle(app)` de `hono/vercel`; expone la API de negocio.
   - `app/api/auth/[...all]/route.ts`: `toNextJsHandler(auth)`; expone Better Auth con su propio prefijo (`/api/auth/...`), sin mezclarse con `/api/v1`.

## Estructura

```
src/
├── config/env.ts                     # único lugar que lee process.env; fail-fast con Zod
├── lib/
│   ├── prisma.ts                     # singleton (globalThis) con adaptador pg
│   ├── auth.ts                       # Better Auth
│   └── storage.ts                    # único punto que conoce MinIO/S3
├── proxy.ts                          # redirección a /login (ver "Autenticación y autorización")
├── server/
│   ├── app.ts                        # basePath('/api/v1'), onError, notFound, OpenAPI y Swagger UI
│   ├── router.ts                     # createRouter() y el tipo AppEnv
│   ├── errors/                       # AppError y subclases, errorHandler, ErrorResponseSchema
│   ├── middlewares/auth.ts           # requireAuth() + requireRole(...)
│   ├── shared/                       # A construir (ver convenciones-backend.md)
│   └── features/<dominio>/
│       ├── <dominio>.routes.ts
│       ├── <dominio>.controller.ts
│       ├── <dominio>.validation.ts
│       ├── <dominio>.service.ts
│       ├── <dominio>.repository.ts
│       └── __tests__/<dominio>.service.test.ts
└── generated/prisma/                 # cliente generado: no se edita ni se commitea
```

Features de API del Sprint 1: `alumnos`, `profesores` (incluye materias asignadas y bloques de clase), `materias` y `turnos` (prioridad, capacidad, solapamientos, agenda). La referencia para copiar el patrón es `alumnos`; una feature nueva se crea con `/nueva-feature-api <dominio>` (Claude Code) o copiando `alumnos` a mano.

## Capas de una feature

| Capa       | Hace                                                                                                                                              | No hace                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| routes     | Contrato HTTP: path, método, schemas, status codes y middlewares de auth. Cada endpoint se declara con `createRoute()` y es la fuente del OpenAPI | Lógica                                                    |
| controller | Recibe el dato ya validado, obtiene el `Actor` con `c.get('actor')` (A construir), llama al service y arma la respuesta (200, 201, 204…)          | Acceder a la base, aplicar reglas de negocio, `try/catch` |
| validation | Schemas Zod de entrada, salida y params                                                                                                           | Reglas de negocio                                         |
| service    | Reglas de negocio y de dominio. Lanza `AppError` o sus subclases                                                                                  | Conocer HTTP (Hono, `Context`, status codes) ni Prisma    |
| repository | Operaciones con Prisma; traduce errores del motor (`P2002` → `ConflictError`); completa la auditoría con el `Actor`                               | Reglas de negocio                                         |

Flujo: cliente → routes (valida con Zod) → controller → service → repository → Postgres. Cualquier error lanzado lo captura `app.onError`.

**Criterio:** si un service solo reenvía una llamada al repository en un caso trivial, es aceptable. Lo que no se negocia es que solo el repository toque Prisma.

## Router y registro de features

- **Toda feature crea su router con `createRouter()` de `src/server/router.ts`, nunca con `new OpenAPIHono()`.** `createRouter()` instala un `defaultHook` que convierte un dato inválido en `ValidationError` (400, con las issues de Zod en `details`), así llega a `app.onError` con el mismo formato que cualquier otro error. Con `new OpenAPIHono()` directo, Hono respondería su propio 400 con otro formato.
- `<dominio>.routes.ts` exporta `<dominio>Routes = createRouter()` y le agrega los endpoints declarados con `createRoute()`.
- `createRouter()` devuelve `OpenAPIHono<AppEnv>`: en los handlers, `c.get('user')` y `c.get('session')` están tipados (los setea `requireAuth()`).
- Cada feature se registra en `src/server/app.ts` con **una sola línea**: `app.route('/<dominio>', <dominio>Routes)`.

## Dependencias entre features

Una feature solo puede importar el **repository** de otra, y solo para lecturas; nunca su service, controller ni routes. Ejemplo: si `turnos` necesita confirmar que un alumno existe, lee `alumnos.repository.ts`, pero no usa las reglas de `alumnos.service.ts`.

Un repository importa Prisma, `@/server/errors` y `@/server/shared/*`; no importa otros repositories ni services. Así el grafo no tiene ciclos (turnos ↔ profesores ↔ materias) y las reglas de negocio de una feature no quedan acopladas a las de otra. ESLint hace cumplir la parte de imports entre features.

Dentro de una misma feature, los imports son relativos (`./alumnos.repository`, o `../alumnos.service` desde `__tests__`). Con alias (`@/server/features/alumnos/...`), ESLint no distingue la propia feature de otra y lo marca como error.

## Errores

Jerarquía en `src/server/errors/`; todas las clases heredan de `AppError(message, statusCode = 500, { code?, details?, cause? })`. La tabla de clases, status y códigos es parte del contrato con el frontend y está en [`contrato-api.md` → Errores](./contrato-api.md#errores).

- Los services lanzan las clases importadas de `@/server/errors`: `throw new ConflictError('DNI ya registrado')`. Para un código específico: `new ConflictError('...', { code: 'BLOQUE_LLENO', details: fechas })`.
- `errorHandler` (`src/server/errors/error-handler.ts`, instalado con `app.onError`) serializa todo `AppError` con el formato `{ "error": { "code", "message", "details"? } }`.
- Un error no controlado (ni `AppError` ni `HTTPException` de Hono) se registra con `console.error` y responde 500 genérico, sin exponer detalles internos.
- Los fallos de validación de Zod los convierte el `defaultHook` de `createRouter()`: no se lanzan a mano en el controller.
- Las rutas inexistentes de `/api/v1` responden 404 con el mismo formato.
- En `createRoute()`, las respuestas 400/401/403/404/409 se declaran con `ErrorResponseSchema` (`src/server/errors/error-response.ts`).
- No hay `try/catch` en los controllers.

## Validación y OpenAPI

- Todo dato de entrada (params, query, body) se valida con Zod en la ruta.
- Los schemas viven en `<dominio>.validation.ts` y usan el `z` de `@hono/zod-openapi`, para poder llamar a `.openapi({ description, example })`.
- Los tipos se derivan de los schemas; no se duplican a mano.
- Cada endpoint declara todos sus status codes: 200/201/204 según corresponda; 400 si valida entrada; 401 y 403 si usa `requireAuth()`/`requireRole()`; 404 si busca por id; 409 si puede haber conflicto.
- Swagger UI queda en `/api/v1/docs` y el JSON en `/api/v1/openapi.json`. Si los ejemplos ensucian el archivo de rutas, se mueven a otro.

## Autenticación y autorización

`src/lib/auth.ts` configura Better Auth con `emailAndPassword` y un campo extra:

```ts
user: {
  additionalFields: {
    role: { type: 'string', required: false, input: false },
  },
},
```

`input: false` impide que alguien se asigne un rol al registrarse. No tiene `defaultValue`: la cuenta se crea con su rol explícito. Los valores válidos son `MESA_ENTRADAS`, `PROFESOR`, `GERENTE` y `ALUMNO` (decisión T-17); la fuente en código es `ROLES` de `src/server/shared/actor.ts` (**A construir**, ver `convenciones-backend.md`). En la base, `role` es un texto; lo que no esté en `ROLES` se trata como "sin rol".

Hay dos chequeos separados:

- **`src/proxy.ts`** solo redirige a `/login` si no hay cookie de sesión (`getSessionCookie`, que verifica presencia, no validez). Nunca decide roles. Es código que puede correr separado de la app: no depende de módulos ni de estado compartidos.
  - Protege **todas** las rutas salvo `/login`, `/api/*`, los internos de Next (`/_next/*`) y los archivos estáticos, con un `matcher` negativo, para que una sección nueva quede protegida sin tocar el proxy. Ejemplo de patrón (verificar la sintaxis en la guía de Next 16): `'/((?!login|api|_next/static|_next/image|.*\\..*).*)'`.
  - **A construir:** hoy el `matcher` lista `/`, `alumnos`, `profesores`, `materias` y `turnos` (le falta `calendario`).
- **`src/server/middlewares/auth.ts`**:
  - `requireAuth()` exige una sesión válida, guarda `user` y `session` en el contexto de Hono (y el `Actor`, **A construir**, ver `convenciones-backend.md`) o lanza `UnauthorizedError` (401).
  - `requireRole(...roles)` se usa después de `requireAuth()` y lanza `ForbiddenError` (403) si el rol del usuario no está en la lista.
  - Cada endpoint privado declara su rol.

El registro público debe estar deshabilitado (**A construir**; detalle en `convenciones-backend.md` → Seguridad de cuentas).

## Configuración

- `src/config/env.ts` es el único archivo que lee `process.env` (excepción: `prisma7.config.ts`, que corre fuera de Next y carga `.env` con `dotenv`).
- Variable nueva = se agrega al schema de `env.ts` y a `.env.example`; los dos deben tener exactamente las mismas variables (`NODE_ENV` queda fuera del `.env`: tiene default y lo fija Next).
- `env` se importa solo desde `src/lib/` y `src/config/`. Las features no dependen de la configuración; por eso sus tests no necesitan variables de entorno y el CI no las define.

## Prisma

El cliente se instancia una sola vez en `src/lib/prisma.ts`, con el patrón `globalThis` (para que el hot reload no abra pools nuevos) y el adaptador `@prisma/adapter-pg`. Se importa `prisma` de ahí, solo desde repositories (y desde `src/lib/auth.ts`). Nunca `new PrismaClient()` en otro archivo.

## Archivos

- Solo `src/lib/storage.ts` conoce MinIO/S3 (`putObject`, `deleteObject`, `getPresignedUrl`).
- En la base se guarda la **clave** del objeto, no la URL.
- Para mostrar un archivo se genera una URL prefirmada de lectura, con TTL por defecto de 900 s (15 min), para que no venza mientras el usuario está en pantalla.
- La foto del profesor (JPG/PNG, chica) sube por **multipart a la API**. El navegador no sube directo a MinIO.

## Tests

- Vitest, un archivo por service dentro de su feature: `server/features/<dominio>/__tests__/<dominio>.service.test.ts`. Se ejecutan con `pnpm test:run` (`pnpm test` es modo watch).
- El repository se reemplaza por un mock: sin Docker ni Postgres. Los tests no importan `@/config/env`.
- Casos mínimos: el camino feliz + uno por cada error que el service puede lanzar (uno por cada 4xx que declara su ruta). Un `it.todo` no cuenta como cobertura.
- Las funciones puras (por ejemplo `prioridad.ts` en `turnos`) se testean directo.
- Tests del middleware de auth: `vi.mock('@/lib/auth')` con `vi.hoisted`, sin base ni variables de entorno.
- `src/server/shared/` tiene sus propios tests en `shared/__tests__/` (ver `convenciones-backend.md`).
