<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Proyecto: AulaClick (Nexo Académico)

Sistema de gestión de un centro de atención académica: alumnos, profesores, materias, bloques de horario y turnos. Equipo de 6 personas, 3 sprints de una semana. Alcance del Sprint 1: `alumnos`, `profesores`, `materias`, `turnos` (incluye agenda diaria). `pagos` e `indicadores` NO se crean todavía.

Antes de escribir código, leer la guía de Next en `node_modules/next/dist/docs/` (ver bloque de arriba). Si algo depende del comportamiento de esta versión, confirmarlo ahí y no asumir. Ya confirmado para Next 16.3.5: `middleware` está deprecado y se llama **`proxy`** (`src/proxy.ts`, `export function proxy`, corre en Node); los `params` de los Route Handlers son una `Promise`.

## Comandos

Node 24.19.0 y pnpm 11.21.0 (`corepack enable`). Scripts de `package.json`:

| Comando                                         | Qué hace                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev` / `build` / `start`                  | Servidor de desarrollo / build / servidor de producción             |
| `pnpm typecheck`                                | `tsc --noEmit`                                                      |
| `pnpm lint`                                     | ESLint (incluye las reglas de arquitectura)                         |
| `pnpm format`                                   | Prettier sobre todo el repo (`--write`)                             |
| `pnpm test`                                     | Vitest en **modo watch** (uso interactivo local)                    |
| `pnpm test:run`                                 | Vitest una sola pasada: **es el que se usa para verificar y en CI** |
| `pnpm check`                                    | `typecheck` + `lint` + `test:run`. Debe pasar antes de cada push    |
| `pnpm services:up` / `services:down`            | Levanta / baja Postgres y MinIO (Docker Compose)                    |
| `pnpm db:migrate` / `db:generate` / `db:studio` | Migraciones, cliente Prisma, explorador visual                      |

`postinstall` genera el cliente Prisma y `prepare` instala husky. Hooks: `pre-commit` corre lint-staged (eslint --fix + prettier) y `pre-push` corre `pnpm check`. El CI (`.github/workflows/ci.yml`) corre `pnpm check` en push a `main` y en cada PR.

Comandos de Claude Code (`.claude/commands/`): `/nueva-feature <dominio>` crea el esqueleto de una feature; `/revisar-arquitectura` revisa el diff contra estas reglas (solo lectura).

## Arquitectura

Next.js (App Router) aloja el frontend y la API. La API es Hono + OpenAPI (Zod), organizada por feature. Las páginas solo consumen la API con `fetch`: nunca llaman a Prisma ni a services desde componentes o Server Components.

```
src/
├── app/
│   ├── login/page.tsx
│   ├── alumnos/ profesores/ materias/ turnos/     # solo páginas
│   └── api/
│       ├── v1/[[...route]]/route.ts               # adaptador de Hono (hono/vercel)
│       └── auth/[...all]/route.ts                 # Better Auth (no se mezcla con v1)
├── components/<entidad>/                          # componentes agrupados por entidad
├── proxy.ts                                       # solo redirige a /login si no hay sesión
├── config/env.ts                                  # único lugar que lee process.env; fail-fast con Zod
├── server/
│   ├── app.ts                                     # basePath('/api/v1'), onError, notFound, doc y Swagger UI
│   ├── router.ts                                  # createRouter() y el tipo AppEnv
│   ├── features/<dominio>/
│   │   ├── <dominio>.routes.ts                    # createRoute(): contrato HTTP y OpenAPI
│   │   ├── <dominio>.controller.ts                # recibe el dato validado, llama al service, arma la respuesta
│   │   ├── <dominio>.validation.ts                # schemas Zod de entrada y salida
│   │   ├── <dominio>.service.ts                   # reglas de negocio
│   │   ├── <dominio>.repository.ts                # único que usa Prisma
│   │   └── __tests__/<dominio>.service.test.ts
│   ├── middlewares/auth.ts                        # requireAuth() + requireRole(...)
│   ├── shared/                                    # (A construir) paginación, primitivas Zod, búsqueda, fechas, Actor
│   └── errors/                                    # AppError y subclases, error-handler, ErrorResponseSchema
├── lib/
│   ├── prisma.ts                                  # singleton (globalThis) con adaptador pg
│   ├── auth.ts                                    # Better Auth
│   └── storage.ts                                 # único punto que conoce MinIO/S3
└── generated/prisma/                              # cliente generado; NO se edita ni se commitea
```

Features: `alumnos`, `profesores` (incluye materias asignadas y bloques de clase), `materias`, `turnos` (prioridad, capacidad, solapamientos, agenda).

Fuera de `src/`: `prisma/schema.prisma`, `prisma7.config.ts` (config del CLI de Prisma; el nombre está confirmado, el CLI lo toma), `docker-compose.yml`, `.env.example`, `vitest.config.mts`.

### Responsabilidad de cada capa

| Capa       | Hace                                                                          | NO hace                                        |
| ---------- | ----------------------------------------------------------------------------- | ---------------------------------------------- |
| routes     | Contrato HTTP: path, método, schemas, status codes, OpenAPI                   | Lógica                                         |
| controller | Recibe el dato ya validado, llama al service, arma la respuesta (201, 204...) | Acceder a la base, aplicar reglas, `try/catch` |
| validation | Schemas Zod de entrada/salida/params                                          | Reglas de negocio                              |
| service    | Reglas de negocio y de dominio                                                | Conocer HTTP ni Prisma                         |
| repository | Operaciones con Prisma; traduce errores del motor (P2002 -> `ConflictError`)  | Reglas de negocio                              |
| errors     | Clases de error + handler que las convierte en respuesta HTTP                 | —                                              |
| config     | Variables de entorno validadas al arrancar                                    | —                                              |

Flujo: cliente -> routes (valida con Zod) -> controller -> service -> repository -> Postgres. Cualquier error lanzado lo captura `app.onError`.

### Router y registro de features

- **Toda feature crea su router con `createRouter()` de `src/server/router.ts`, nunca con `new OpenAPIHono()`.** `createRouter()` instala un `defaultHook` que convierte un dato inválido en `ValidationError` (400, con las issues de Zod en `details`), de modo que llega a `app.onError` con el mismo formato que cualquier otro error. Con `new OpenAPIHono()` directo, Hono respondería su propio 400 con otro formato.
- `<dominio>.routes.ts` exporta `<dominio>Routes = createRouter()` y le agrega los endpoints declarados con `createRoute()`.
- `createRouter()` devuelve `OpenAPIHono<AppEnv>`: en los handlers, `c.get('user')` y `c.get('session')` están tipados (los setea `requireAuth()`).
- Cada feature se registra en `src/server/app.ts` con **una sola línea**: `app.route('/<dominio>', <dominio>Routes)`.

## Convenciones transversales (backend)

Se aplican a todas las features. Lo que se sabe que se repite vive en `src/server/shared/`; ninguna feature lo reimplementa.

**Estado: las convenciones valen desde ya para todo código nuevo, pero el código de apoyo todavía NO existe** (`src/server/shared/`, el Actor en `requireAuth()` y `disableSignUp` están "A construir"). Si una tarea necesita una de esas piezas y aún no existe, **avisar a la persona antes de crearla**: se construye una sola vez, en un PR propio y con sus tests, siguiendo la especificación de más abajo. Nunca se inventa una versión propia dentro de la feature.

| Pieza                                                                                                           | Estado                                                                          |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Convenciones de idioma, nombres de query, formato de fechas/horas, paginación y respuestas (secciones de abajo) | **Vigentes**                                                                    |
| `src/server/shared/` (`actor`, `paginacion`, `zod`, `busqueda`, `fechas`) con sus tests                         | **A construir** (no depende del schema; es lo primero)                          |
| Regla de ESLint `shared` -> `features`                                                                          | **A construir**, junto con `shared/`                                            |
| `Actor` en el contexto desde `requireAuth()` (403 si el usuario no tiene rol)                                   | **A construir**                                                                 |
| `disableSignUp: true` en `src/lib/auth.ts`                                                                      | **A construir** (una línea). **Hoy el registro público por email está abierto** |
| Columna `busqueda`, enum `estado` (`ACTIVO` / `INACTIVO`), campos de auditoría                                  | **A construir** (dependen del `schema.prisma`)                                  |
| Consulta de "turno vigente" y transacción con bloqueo de fila en `turnos.repository`                            | **A construir** (dependen de la feature `turnos`)                               |
| Auditoría completada por el repository, y seed                                                                  | **A construir**                                                                 |

### `server/shared/`

Contiene solo código sin significado de negocio: paginación, primitivas de Zod, normalización de búsqueda, fechas y el tipo `Actor`.

- `shared` NO importa de `features`. Las features sí importan de `shared`.
- Se construye de entrada solo lo que ya sabemos que se va a repetir. Cualquier otra cosa se extrae recién en la tercera repetición.
- Lo que tiene significado de negocio NO va a `shared`: vive en su feature y otras lo consumen por su repository (regla 2).

### Fechas y horas

- Zona horaria del negocio: `America/Argentina/Salta`. El servidor puede correr en UTC, así que nunca usar `new Date()` para "hoy".
- Existe un único `hoy()` en `shared/fechas.ts`. Los services reciben el reloj inyectable (parámetro con `hoy()` por defecto) para poder testearlos.
- Las fechas de calendario se guardan como `@db.Date` (sin hora) y en la API viajan como string `YYYY-MM-DD`. Nunca como `DateTime`.
- La hora se guarda como minutos desde medianoche (`Int`: 09:30 = 570); en la API viaja como `HH:mm`. Comparar solapamientos es comparar enteros.
- El día de la semana sigue ISO: 1 = lunes ... 7 = domingo.
- Las marcas de auditoría (`createdAt`, `updatedAt`) sí son `DateTime` (instante).

### Paginación

- Por offset: query `page` (default 1) y `pageSize` (default 20, máximo 100). Se valida con el schema de `shared`.
- Respuesta de listados: `{ data: [...], meta: { page, pageSize, total, totalPages } }`.
- El repository ejecuta `findMany` y `count` en una sola transacción y el orden siempre incluye `id` como desempate, para que las páginas no se mezclen.
- Se pagina todo listado de entidades. No se pagina: los selectores de catálogo (por ejemplo materias activas para un dropdown) y la agenda diaria, que se filtra por fecha.

### Filtros y respuestas

- Nombres fijos de query: `q` (búsqueda), `estado`, `materiaId`. Un filtro nuevo se agrega a esta lista.
- El recurso individual se devuelve directo, sin `{ data }`. Los errores usan siempre `ErrorResponseSchema`.
- Idioma: el dominio en español (rutas, campos JSON, códigos de error como `BLOQUE_LLENO`, mensajes al usuario). La infraestructura y el código genérico en inglés.

### Búsqueda sin tildes

- Prisma `mode: 'insensitive'` no resuelve tildes. Las entidades buscables (alumnos, profesores) tienen una columna `busqueda`, calculada al guardar con `normalizarBusqueda()` (minúsculas, sin tildes, espacios colapsados) sobre apellido, nombre y DNI.
- La búsqueda normaliza `q` con la misma función y usa `contains` sobre `busqueda`. Si cambian nombre, apellido o DNI, se recalcula.
- No se usa la extensión `unaccent` de Postgres.

### Auditoría y actor

- Toda entidad de negocio lleva `createdById`, `updatedById`, `createdAt`, `updatedAt`.
- `requireAuth()` deja el `Actor` (`{ userId, role }`) en el contexto de Hono (`c.set('actor', ...)`; se agrega `actor: Actor` a `AppEnv` en `src/server/router.ts`, así `c.get('actor')` sale tipado en los controllers). El controller lo pasa al service y el service al repository, que completa los campos. No se usan extensiones de Prisma ni magia.
- Si el usuario autenticado no tiene rol, `requireAuth()` responde 403 (`SIN_PERMISO`). Siguen en el contexto `user` y `session`, y `requireRole(...roles)` no cambia su contrato.
- El detalle de una entidad devuelve quién la creó y quién la modificó por última vez (nombre y fecha/hora).

### Baja lógica

- Profesores y materias: enum `estado` (`ACTIVO` / `INACTIVO`). Nada se borra. Los listados aceptan `?estado=` con `ACTIVO` por defecto. Los alumnos no tienen baja lógica.

### Regla de "turno vigente"

- "Vigente" (turno recurrente sin fecha de fin o con fin >= hoy, o sesión única con fecha >= hoy) se define una sola vez, en una consulta de `turnos.repository`.
- Profesores y materias la usan desde sus services (HU-03 a HU-06), importando ese repository. Prohibido reescribir la condición en otro lado.

### Concurrencia en la capacidad de un bloque

- La verificación de capacidad y la inserción del turno se hacen en una sola transacción de `turnos.repository` que bloquea la fila del bloque (`SELECT ... FOR UPDATE` dentro de `$transaction`). El service decide la regla; el repository la ejecuta de forma atómica.
- Debe existir un test que cubra dos reservas simultáneas del último lugar.

### Seguridad de cuentas

- El registro público debe estar deshabilitado (**A construir**; hoy está abierto). Los usuarios los crea un gerente (o el seed en desarrollo). No se expone ningún endpoint de sign-up abierto.
- La opción es `emailAndPassword.disableSignUp: true` en `src/lib/auth.ts` (existe en el tipo de Better Auth 1.7.5). Con ella, `POST /api/auth/sign-up/email` responde 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED`. El chequeo no exime las llamadas desde el servidor: **`auth.api.signUpEmail` también queda bloqueado, así que el seed no puede usarlo** (ver "Decisiones abiertas").
- Cómo verificarlo: mientras la base no tenga las tablas de Better Auth, el endpoint da 500 (`Prisma schema mismatch`) con o sin la opción, así que no prueba nada. Con el schema creado, `POST /api/auth/sign-up/email` con un cuerpo válido debe dar 400 y no crear la cuenta.
- El campo `role` nunca lo define el usuario (`input: false`).

### Especificación de `src/server/shared/` (A construir)

Cada archivo con su test en `shared/__tests__/`, con tests reales (no `it.todo`). Usar el `z` de `@hono/zod-openapi` para poder llamar a `.openapi()`.

| Archivo         | Exporta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actor.ts`      | `type Actor = { userId: string; role: string }` (`role` como string hasta decidir sus valores).                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `paginacion.ts` | `paginacionQuerySchema` (`page`: entero >= 1, default 1; `pageSize`: entero 1..100, default 20; ambos coercionados desde string), `paginatedSchema(itemSchema)` (respuesta `{ data, meta }`), `calcularSkipTake(query)` -> `{ skip, take }` y `armarMeta(query, total)` (`totalPages` = techo de `total / pageSize`, 0 si no hay resultados).                                                                                                                                                                                                              |
| `zod.ts`        | `dni`: se limpian puntos y espacios y luego se valida 7 u 8 dígitos; **se guarda solo con dígitos**. `email`: trim, minúsculas, email válido de hasta 254 caracteres. `telefono`: trim; solo dígitos, espacios, `+`, `-` y paréntesis; entre 8 y 20 caracteres con al menos 8 dígitos; **se guarda como lo escribió el usuario**. `textoRequerido(max)`: trim, entre 1 y `max`. `fechaISO`: `YYYY-MM-DD` y fecha real de calendario. `horaHHmm`: `HH:mm` de 00:00 a 23:59. `horaAMinutos` / `minutosAHora` (0 a 1439; lanzan `RangeError` si es inválido). |
| `busqueda.ts`   | `normalizarBusqueda(texto)`: minúsculas, sin tildes ni diacríticos, espacios colapsados y recortados. `"González"` -> `"gonzalez"`; `"  Ñandú  Pérez "` -> `"nandu perez"`.                                                                                                                                                                                                                                                                                                                                                                                |
| `fechas.ts`     | `hoy(reloj?)` -> `YYYY-MM-DD` en `America/Argentina/Salta` (`reloj` inyectable, por defecto el del sistema; es el único lugar que usa `new Date()`), `fechaADate` / `dateAFecha` entre `YYYY-MM-DD` y `Date` en UTC a medianoche (lo que Prisma devuelve para `@db.Date`) y `diaSemanaISO(fecha)` (1 = lunes ... 7 = domingo).                                                                                                                                                                                                                             |

Casos de test obligatorios: `hoy()` a las 23:30 hora Salta (02:30 UTC del día siguiente) devuelve el día correcto, y `normalizarBusqueda` con los dos ejemplos de arriba.

Notas de implementación (verificadas con Zod 4.6.5, `@hono/zod-openapi` 1.6.3 y Node 24):

- `z.iso.date()` ya rechaza fechas inexistentes (`2026-02-30`, `2026-02-29`).
- `dni` y `email` usan `.pipe()`, y en el OpenAPI aparecen solo como `string`: agregarles `.openapi({ description, example })`.
- El `tsconfig` apunta a ES2017: quitar tildes con `/[̀-ͯ]/g` (no con `\p{M}`), y armar `hoy()` con `Intl.DateTimeFormat(...).formatToParts()` (no depender del formato del locale).
- Con `createRouter()`, un query inválido llega como 400 `VALIDACION` (con `app.onError(errorHandler)` instalado).
- Tests del middleware de auth: `vi.mock('@/lib/auth')` con `vi.hoisted`, sin base ni variables de entorno.
- Regla de ESLint a agregar: `src/server/shared/**` no importa `@/server/features/**` ni `**/features/**` (ni Prisma). Probarla en negativo con un archivo descartable y en positivo con una feature que importe de `shared`.

## Reglas obligatorias

1. **Solo el repository toca Prisma.** Ningún service, controller ni componente importa `@/lib/prisma` ni el cliente generado (`@/generated/prisma/client`). Única excepción: `src/lib/auth.ts`, que pasa `prisma` al adaptador de Better Auth.
2. **Dependencias entre features:** una feature solo puede importar el `repository` de otra (lecturas), nunca su service ni su controller. Los repositories solo importan `lib/prisma`. Así el grafo no tiene ciclos (turnos <-> profesores <-> materias).
3. **Errores:** los services lanzan `AppError` o sus subclases (`throw new ConflictError("DNI ya registrado")`), importadas de `@/server/errors`. Un error desconocido responde 500 sin exponer detalles. `AppError(message, statusCode = 500, { code?, details?, cause? })` lleva `statusCode`, `code` y `details` opcional (por ejemplo `BLOQUE_LLENO` con la lista de fechas llenas: `new ConflictError("...", { code: "BLOQUE_LLENO", details: fechas })`). No hacer `try/catch` en controllers.

   | Clase               | Status                              | `code` por defecto |
   | ------------------- | ----------------------------------- | ------------------ |
   | `AppError`          | el que se indique (500 por defecto) | `ERROR_INTERNO`    |
   | `ValidationError`   | 400                                 | `VALIDACION`       |
   | `UnauthorizedError` | 401                                 | `NO_AUTENTICADO`   |
   | `ForbiddenError`    | 403                                 | `SIN_PERMISO`      |
   | `NotFoundError`     | 404                                 | `NO_ENCONTRADO`    |
   | `ConflictError`     | 409                                 | `CONFLICTO`        |

   Todo error se responde como `{ "error": { "code", "message", "details"? } }`. Ese cuerpo está definido por `ErrorResponseSchema` (`src/server/errors/error-response.ts`): **es el schema que se declara en `createRoute()` para las respuestas 400/401/403/404/409**. Las rutas inexistentes de `/api/v1` responden 404 con el mismo formato.

4. **Config:** prohibido leer `process.env` fuera de `config/env.ts` (única excepción: `prisma7.config.ts`, que corre fuera de Next). Variable nueva = se agrega al schema de `env.ts` y a `.env.example`; los dos deben tener exactamente las mismas variables (`NODE_ENV` queda fuera del `.env`: tiene default y lo fija Next). Si falta o es inválida alguna variable, la app no arranca.
5. **Validación:** todo dato de entrada se valida con Zod en la ruta. Los schemas de la API son la fuente del OpenAPI: no duplicar tipos a mano.
6. **Documentación:** cada endpoint se declara con `createRoute()` con todos sus status codes (incluidos 400/401/403/404/409 cuando apliquen). Swagger UI queda en `/api/v1/docs` y el JSON en `/api/v1/openapi.json`. Si los ejemplos ensucian el archivo, moverlos a otro.
7. **Auth:** dos chequeos separados.
   - `src/proxy.ts` solo redirige a `/login` si no hay cookie de sesión (`getSessionCookie`, que verifica presencia, no validez) y nunca decide roles. Aplica a `/` y a las secciones `alumnos`, `profesores`, `materias` y `turnos` (su `matcher`); una sección protegida nueva se agrega ahí. Es código que puede correr separado de la app: no depende de módulos ni estado compartidos.
   - `src/server/middlewares/auth.ts`: `requireAuth()` responde 401 y `requireRole(...roles)` responde 403, ambos en JSON (lanzan `UnauthorizedError` / `ForbiddenError`). `requireRole` se usa después de `requireAuth()`. Cada endpoint declara su rol.
   - La autorización real vive siempre en la API. En Better Auth, `role` se declara en `additionalFields` con `input: false` para que nadie se asigne un rol al registrarse.
8. **Archivos:** solo `lib/storage.ts` conoce MinIO (`putObject`, `deleteObject`, `getPresignedUrl`). En la base se guarda la clave del objeto, no la URL; para mostrarlo se genera una URL prefirmada (TTL por defecto: 900 s = 15 min, para que la foto no venza mientras el usuario está en pantalla). La foto del profesor (JPG/PNG, chica) sube por multipart a la API.
9. **Prisma:** el cliente se instancia una sola vez en `lib/prisma.ts` (patrón `globalThis`, para que el hot reload no abra pools nuevos) usando el adaptador `@prisma/adapter-pg`. Se importa `prisma` de ahí (solo desde repositories). Nunca `new PrismaClient()` en otro archivo.
10. **Frontend:** componentes chicos, estado lo más arriba posible, datos hacia abajo por props y eventos hacia arriba. Efectos y llamadas a la API con `fetch` a `/api/v1`. Sin lógica de negocio en componentes ni imports de `src/server`.
11. **Criterio:** si un service solo reenvía una llamada al repository en un caso trivial, es aceptable. Lo que no se negocia es la regla 1.
12. **Git y migraciones (herramientas de IA):**
    - **No crea ramas, no hace commits ni push**, salvo que la persona lo pida explícitamente en ese momento (un pedido anterior no vale para el siguiente). Deja los cambios sin commitear y los resume.
    - **Puede editar `prisma/schema.prisma`** cuando la tarea lo requiera, pero **no genera migraciones**: no ejecuta `pnpm db:migrate`, `prisma migrate ...` ni `prisma db push`, y no crea ni edita archivos dentro de `prisma/migrations/`. Al terminar avisa qué cambió en el schema y que la persona debe coordinar con quien lleve el modelo de datos y correr `pnpm db:migrate` ella misma. Regenerar el cliente con `pnpm db:generate` sí está bien (no toca la base).
    - `.claude/settings.json` lo respalda con permisos en `ask`: pide confirmación antes de cualquier `git commit`, de crear una rama y de cualquier comando de migración. Es una red de seguridad; la regla es esta.

### Reglas que hace cumplir ESLint

Están en `eslint.config.mjs` y `pnpm lint` (y por lo tanto `pnpm check`, el pre-push y el CI) las hacen fallar:

| Regla                                    | Qué prohíbe                                                                                                             | Dónde aplica                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `no-restricted-properties`               | `process.env`                                                                                                           | todo `src/**`, salvo `src/config/env.ts`                                      |
| `no-restricted-imports` (Prisma)         | importar `@/lib/prisma` o `@/generated/*`                                                                               | `src/server/**`, `src/app/**` y `src/components/**`, salvo `*.repository.ts`  |
| `no-restricted-imports` (entre features) | importar `*.service`, `*.controller` o `*.routes` de otra feature (con alias `@/server/features/*/…` o relativo `../…`) | `src/server/features/**` (el repository de otra feature sí se puede importar) |
| `no-restricted-imports` (frontend)       | importar `@/server/*`, `@/lib/auth` o `@/lib/storage`                                                                   | `src/app/**` y `src/components/**`, salvo `src/app/api/**`                    |
| `no-restricted-imports` (OpenAPIHono)    | importar `OpenAPIHono` de `@hono/zod-openapi` (crear routers con `createRouter()`)                                      | todo `src/**`, salvo `src/server/router.ts` y `src/server/app.ts`             |

**A construir** (junto con `src/server/shared/`): `no-restricted-imports` que impide a `src/server/shared/**` importar de `src/server/features/**` (con alias o relativo). Las features sí pueden importar de `shared`.

ESLint no puede verificar el resto (por ejemplo `try/catch` en controllers, o endpoints sin todos sus status codes): eso se revisa en el PR, con ayuda de `/revisar-arquitectura`.

## Tests

- Vitest, un archivo por service dentro de su feature: `server/features/<dominio>/__tests__/<dominio>.service.test.ts`. Se ejecutan con `pnpm test:run` (`pnpm test` es modo watch).
- El repository se reemplaza por un mock: sin Docker ni Postgres. Los tests no importan `config/env.ts` (los services no dependen de él); por eso el CI no define variables de entorno.
- Casos mínimos: el camino feliz + uno por cada error que el service puede lanzar (uno por cada 4xx que declara su ruta).
- Las funciones puras (por ejemplo `prioridad.ts` en turnos) se testean directo.
- Antes de cada push deben pasar `pnpm typecheck`, `pnpm lint` y `pnpm test:run`, es decir `pnpm check` (lo corre el hook `pre-push`).

## Reglas de dominio (Sprint 1)

- DNI único entre alumnos; DNI y matrícula únicos entre profesores (activos e inactivos). Los alumnos no tienen baja lógica.
- Profesores y materias tienen baja lógica (estado activo/inactivo); nada se borra. Un profesor inactivo no recibe materias, bloques ni turnos nuevos.
- No se puede dar de baja un profesor, quitarle una materia, dar de baja una materia con profesores, ni editar/eliminar un bloque, si hay turnos vigentes (recurrentes sin fin o con fin >= hoy, y sesiones únicas con fecha >= hoy).
- Turno: une un alumno con un bloque de un profesor, indicando materia; la materia debe estar asignada a ese profesor. Tipo `RECURRENTE` (fecha de inicio, fin opcional) o `SESION_UNICA` (fecha). Las fechas deben coincidir con el día de la semana del bloque.
- Capacidad del bloque: se controla por cada fecha en que aplica el turno. Si una fecha puntual de un recurrente está llena, se informa qué fechas no pueden (`details`); la regla de excepciones está pendiente de definir.
- Un alumno no puede tener dos turnos superpuestos en fecha y horario.
- Prioridad (no se ingresa a mano): Alta si el examen cae dentro de 10 días de la fecha del turno, Media entre 11 y 20, Baja en otro caso o sin fecha de examen.
- Auditoría en todas las entidades: `createdById`, `updatedById`, `createdAt`, `updatedAt`.

## Decisiones abiertas (resolver antes de codear lo que las usa)

- Nombre del rol de mesa de entradas (`RECEPCION` en el doc de arquitectura vs. "mesa de entradas" en el backlog). Hasta decidirlo, `role` en `src/lib/auth.ts` no tiene valores ni `defaultValue`, y `requireRole` recibe `string[]`.
- Modelo de turnos recurrentes: propuesta = guardar la regla y expandir las ocurrencias al consultar; prioridad calculada al leer.
- Excepciones al registrar un recurrente cuando alguna fecha está llena.
- Cómo se crea el primer gerente con el registro público deshabilitado. Con `disableSignUp`, `auth.api.signUpEmail` también queda bloqueado, así que **el seed no puede usarlo**. Opciones a confirmar (verificar la API exacta en la versión instalada de Better Auth): (a) el `internalAdapter` del contexto de Better Auth (`auth.$context`), para crear el usuario y su cuenta con contraseña desde un script o el seed; (b) el plugin `admin` (`createUser`), que trae su propio campo `role` y podría chocar con el `additionalFields.role` de `src/lib/auth.ts`.

## Flujo de trabajo del equipo

- Ramas por feature (`feat/alumnos-...`), PR a `main`; nadie commitea directo a `main`. Antes de pushear: `pnpm check`.
- Puntos de conflicto seguros: `package.json`, `pnpm-lock.yaml`, `prisma/schema.prisma` y `server/app.ts`. Cambios en esos archivos, en PRs chicos y frecuentes. Cada feature se registra en `server/app.ts` con una sola línea (`app.route(...)`).
- Cambios al `schema.prisma` y sus migraciones se coordinan con quien lleve el modelo de datos; no generar migraciones en paralelo sin avisar.
- No agregar dependencias sin acordarlo; versiones fijadas (Next, Prisma, Zod, `@hono/zod-openapi`).
- El bloque `nextjs-agent-rules` de arriba lo regenera `next dev`: no editarlo; si aparece en un diff, commitearlo junto con el trabajo.
- Herramientas de IA: respetan esta arquitectura. Si una sugerencia rompe alguna regla de arriba, se corrige antes de commitear. La configuración compartida de Claude Code está en `.claude/settings.json` (permisos; pide confirmación para commits, ramas y migraciones) y `.claude/commands/`. Límites en la regla 12.
