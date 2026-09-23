# Convenciones transversales del backend — Aula Click

Se aplican a todas las features de API. Lo que se sabe que se repite vive en `src/server/shared/`; ninguna feature lo reimplementa. El formato con el que estos datos viajan al frontend está en [`contrato-api.md`](./contrato-api.md); este documento cubre cómo se implementan y se guardan.

## Estado

Las convenciones valen desde ya para todo código nuevo, pero **parte del código de apoyo todavía no existe**. Si una tarea necesita una pieza **A construir** y aún no existe, se avisa antes de crearla: se construye una sola vez, en un PR propio, con sus tests y siguiendo la especificación de abajo. Nunca se inventa una versión propia dentro de la feature.

| Pieza                                                                                                      | Estado                                                                                 |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Convenciones de idioma, nombres de query, formato de fechas y horas, paginación y respuestas               | **Vigentes**                                                                           |
| `src/server/shared/` completo (`actor`, `estado`, `paginacion`, `zod`, `busqueda`, `fechas`) con sus tests | **Construido**                                                                         |
| Schema de salida de auditoría (`shared/auditoria.ts`) con sus tests                                        | **Construido**                                                                         |
| Regla de ESLint `shared` → `features` / Prisma                                                             | **Vigente** (`eslint.config.mjs`; la prueba `shared/__tests__/eslint-limites.test.ts`) |
| `Actor` en el contexto desde `requireAuth()` (403 si el usuario no tiene rol)                              | **Construido** (`src/server/middlewares/auth.ts`)                                      |
| `disableSignUp: true` en `src/lib/auth.ts`                                                                 | **Construido**                                                                         |
| Columna `busqueda`, enum `estado` (`ACTIVO` / `INACTIVO`), campos de auditoría en el schema                | **Construido** (`prisma/schema.prisma`)                                                |
| Consulta de "turno vigente" en `turnos.repository`                                                         | **Construido** (`condicionTurnoVigente` y `contarVigentesPorMateria`)                  |
| Transacción con bloqueo de fila en `turnos.repository`                                                     | **A construir** (depende de la feature `turnos`)                                       |
| Seed (`prisma/seed.ts`)                                                                                    | **Construido**                                                                         |
| Auditoría completada por el repository                                                                     | **Construido** (patrón en `alumnos.repository`)                                        |

## `src/server/shared/`

Contiene solo código **sin significado de negocio**: paginación, primitivas de Zod, normalización de búsqueda, fechas, el tipo `Actor`, los valores de `estado` de la baja lógica y la forma de salida de la auditoría.

- `shared` no importa de `features`. Las features sí importan de `shared`.
- De entrada se construye solo lo que ya sabemos que se va a repetir. Cualquier otra cosa se extrae recién en la tercera repetición.
- Lo que tiene significado de negocio no va a `shared`: vive en su feature y las otras lo consumen por su repository.

## Fechas y horas

- Zona horaria del negocio: `America/Argentina/Salta`. El servidor puede correr en UTC, así que **nunca se usa `new Date()` para "hoy"**.
- Existe un único `hoy()`, en `shared/fechas.ts`. Los services que dependen de "hoy" reciben el reloj inyectable (un parámetro con `hoy()` por defecto) para poder testearlos.
- Las fechas de calendario se guardan como `@db.Date` (sin hora) y en la API viajan como string `YYYY-MM-DD`. Nunca como `DateTime`.
- La hora se guarda como minutos desde medianoche (`Int`: 09:30 = 570) y en la API viaja como `HH:mm`. Comparar solapamientos es comparar enteros.
- El día de la semana sigue ISO: 1 = lunes … 7 = domingo.
- Las marcas de auditoría (`createdAt`, `updatedAt`) sí son `DateTime` (instantes).

## Paginación

- Por offset: query `page` (default 1) y `pageSize` (default 20, máximo 100), validados con `paginacionQuerySchema`.
- Respuesta de listados: `{ data: [...], meta: { page, pageSize, total, totalPages } }`, con `paginatedSchema(itemSchema)`.
- El repository ejecuta `findMany` y `count` en una sola transacción, usa `calcularSkipTake` y `armarMeta`, y el orden siempre incluye `id` como desempate, para que las páginas no se mezclen.
- Se pagina todo listado de entidades. No se paginan los selectores de catálogo (por ejemplo materias activas para un dropdown) ni la agenda diaria, que se filtra por fecha.

## Filtros y respuestas

- Nombres fijos de query: `q` (búsqueda), `estado`, `materiaId`. Un filtro nuevo se agrega a esta lista y a `contrato-api.md`.
- El recurso individual se devuelve directo, sin `{ data }`. Los errores usan siempre `ErrorResponseSchema`.
- Idioma: el dominio en español (rutas, campos JSON, códigos de error, mensajes al usuario); la infraestructura y el código genérico en inglés.

## Búsqueda sin tildes

- `mode: 'insensitive'` de Prisma no resuelve tildes. Las entidades buscables tienen una columna `busqueda`, calculada al guardar con `normalizarBusqueda()`:
  - Alumnos y usuarios (los profesores buscan por su `Usuario`): sobre apellido, nombre y DNI.
  - Materias: sobre el nombre. En materias la columna es **`UNIQUE`**: así la unicidad del nombre no distingue mayúsculas ni tildes ("Matemática" y "matematica" chocan).
- La búsqueda es **por palabras**: `q` se normaliza con la misma función, se le quitan los puntos (`30.123` encuentra el DNI `30123456`) y se parte en palabras (hasta 5; el resto se ignora). Cada palabra es un `contains` sobre `busqueda` y se combinan con AND: `"juan gonz"` encuentra a "González, Juan". `q` admite hasta 100 caracteres.
- `busqueda` se recalcula en cada alta y edición con el estado resultante (aunque cambie solo uno de los datos).
- Los listados con buscador se ordenan por `busqueda` y luego `id`: como `busqueda` empieza por el apellido normalizado, el orden es por apellido y nombre sin depender de la collation de Postgres con las tildes ("Álvarez" no queda después de "Zapata").
- No se usa la extensión `unaccent` de Postgres.

## Auditoría y Actor

- Toda entidad de negocio lleva `createdById`, `updatedById`, `createdAt` y `updatedAt`.
- `requireAuth()` deja el `Actor` (`{ userId, role }`) en el contexto de Hono con `c.set('actor', ...)`. `AppEnv` (`src/server/router.ts`) declara `actor: Actor`, así `c.get('actor')` sale tipado en los controllers.
- El controller pasa el `Actor` al service y el service al repository, que completa los campos: en el alta `createdById` y `updatedById` con `actor.userId`, en la edición solo `updatedById` (`updatedAt` lo pone Prisma con `@updatedAt`). No se usan extensiones de Prisma ni magia. Patrón en `alumnos.repository`.
- Si el usuario autenticado no tiene rol, o su rol no es uno de `ROLES` (se comprueba con `esRole`), `requireAuth()` responde 403 (`SIN_PERMISO`) y no deja nada en el contexto.
- `requireRole(...roles)` recibe `[Role, ...Role[]]`: un rol mal escrito o una llamada sin roles no compila. Detalle en `arquitectura-backend.md` → Autenticación y autorización.
- El detalle de una entidad devuelve quién la creó y quién la modificó por última vez (nombre y fecha/hora).
- Esa salida sale de `shared/auditoria.ts` y es igual en todas las entidades:
  - El schema de detalle la mezcla plana: `z.object({ ...campos, ...auditoriaSchema.shape })`. Queda `createdAt` / `updatedAt` (ISO 8601 UTC) y `createdBy` / `updatedBy` (`{ id, nombre, apellido }`, componente OpenAPI `UsuarioAuditoria`).
  - El repository trae los usuarios con `include: { createdBy: { select: SELECT_USUARIO_AUDITORIA }, updatedBy: { select: SELECT_USUARIO_AUDITORIA } }`.
  - La fila se convierte con `{ ...campos, ...armarAuditoria(fila) }`: pasa los `Date` a ISO y descarta lo que no es auditoría.
  - `createdBy` / `updatedBy` son `null` solo cuando el registro lo creó el seed (caso de `Usuario`, cuyos `createdById` / `updatedById` son opcionales). En las entidades de negocio son obligatorios.

## Baja lógica

- Los valores (`ACTIVO` / `INACTIVO`) salen de `ESTADOS` y el tipo `Estado` de `shared/estado.ts`: ninguna feature los repite.
- Materias, asignaciones de materias, bloques y alumnos tienen el enum `estado` (`ACTIVO` / `INACTIVO`). El profesor usa el `estado` de su `Usuario`. Nada se borra.
- Sus listados aceptan `?estado=`, con `ACTIVO` por defecto.
- Los alumnos tienen `estado`, pero su baja no se implementa en este release: su listado no filtra por estado.

## Turno vigente

- La definición de "vigente" está en [`dominio.md`](./dominio.md#turnos). Se implementa **una sola vez**, en `turnos.repository`: `condicionTurnoVigente(fechaHoy)` arma la condición (`fechaFin` nula o >= hoy, y estado `ACTIVO`) y `contarVigentesPorMateria({ fechaHoy, profesorId?, materiaIds? })` cuenta los vigentes por materia. Una consulta nueva de vigentes se agrega como método de `turnos.repository` y reutiliza `condicionTurnoVigente`; las otras features la llaman desde su **service** (un repository no importa otros repositories).
- `fechaHoy` la calcula el service con `hoy()` y su reloj inyectable, y se la pasa al repository.
- Profesores y materias la usan desde sus services (HU-03 a HU-06), importando ese repository. Está prohibido reescribir la condición en otro lado.

## Concurrencia en la capacidad de un bloque

- La verificación de capacidad y la inserción del turno se hacen en una sola transacción de `turnos.repository` que bloquea la fila del bloque (`SELECT ... FOR UPDATE` dentro de `$transaction`). El service decide la regla; el repository la ejecuta de forma atómica.
- Debe existir un test que cubra dos reservas simultáneas del último lugar.

## Seguridad de cuentas

- El registro público está deshabilitado. Las cuentas se crean desde el servidor escribiendo `Usuario` + `Account` con `hashPassword()` (decisión T-21): el seed en desarrollo y mesa de entradas al dar de alta un profesor (T-22). No se expone ningún endpoint de sign-up abierto.
- La opción es `emailAndPassword.disableSignUp: true` en `src/lib/auth.ts`. Con ella, `POST /api/auth/sign-up/email` responde 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED`.
- El chequeo no exime las llamadas desde el servidor: **`auth.api.signUpEmail` también queda bloqueado, así que el seed no puede usarlo** (ver decisión T-21).
- Cómo verificarlo: mientras la base no tenga las tablas de Better Auth, el endpoint da 500 (`Prisma schema mismatch`) con o sin la opción, así que no prueba nada. Con el schema creado, `POST /api/auth/sign-up/email` con un cuerpo válido debe dar 400 **con el código `EMAIL_PASSWORD_SIGN_UP_DISABLED`** y no crear la cuenta. Un 400 solo no alcanza: los campos de dominio de `Usuario` están declarados en `additionalFields` con `required: true` e `input: false`, así que sin la opción el alta ya responde 400 (`<campo> is required`).
- El campo `role` nunca lo define el usuario (`input: false`).
- La contraseña de una cuenta nueva se valida con `LARGO_MINIMO_PASSWORD` / `LARGO_MAXIMO_PASSWORD` de `src/lib/auth-reglas.ts`, los mismos que usa Better Auth.
- Un usuario con `estado` distinto de `ACTIVO` no puede iniciar sesión ni usar `/api/v1` (403 `USUARIO_INHABILITADO`). Al darlo de baja se revocan sus sesiones. Detalle en `arquitectura-backend.md` → Usuario inactivo.

## Especificación de `src/server/shared/`

Cada archivo lleva su test en `shared/__tests__/`, con tests reales (no `it.todo`). Se usa el `z` de `@hono/zod-openapi`, para poder llamar a `.openapi()`.

| Archivo         | Exporta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `estado.ts`     | `ESTADOS = ['ACTIVO', 'INACTIVO'] as const` (valores del enum `Estado` de Prisma) y `type Estado = (typeof ESTADOS)[number]`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `actor.ts`      | `ROLES = ['MESA_ENTRADAS', 'PROFESOR', 'GERENTE', 'ALUMNO'] as const`, `type Role = (typeof ROLES)[number]`, `type Actor = { userId: string; role: Role }` y `esRole(valor): valor is Role`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `paginacion.ts` | `paginacionQuerySchema` (`page`: entero >= 1, default 1; `pageSize`: entero 1..100, default 20; ambos coercionados desde string; un `pageSize` mayor a 100 se rechaza, no se recorta) y su tipo `PaginacionQuery` (`{ page, pageSize }`; las features lo extienden con `.extend(...)`), `metaPaginacionSchema` (`{ page, pageSize, total, totalPages }`, componente OpenAPI `MetaPaginacion`) y su tipo `MetaPaginacion`, `paginatedSchema(itemSchema)` (respuesta `{ data, meta }`), `calcularSkipTake(query)` → `{ skip, take }` y `armarMeta(query, total)` (`totalPages` = techo de `total / pageSize`, 0 si no hay resultados).                                                                                                                             |
| `zod.ts`        | `dni`: se limpian puntos y espacios y luego se valida 7 u 8 dígitos; **se guarda solo con dígitos**. `email`: trim, minúsculas, email válido de hasta 254 caracteres (medidos después del trim). `telefono`: trim; solo dígitos, espacios, `+`, `-` y paréntesis; entre 8 y 20 caracteres con al menos 8 dígitos; **se guarda como lo escribió el usuario**. `textoRequerido(max)`: trim, entre 1 y `max` (lanza `RangeError` si `max` no es un entero >= 1). `fechaISO`: `YYYY-MM-DD` y fecha real de calendario; sale como string. `horaHHmm`: `HH:mm` de 00:00 a 23:59. `horaAMinutos(hora)` / `minutosAHora(minutos)` (0 a 1439; lanzan `RangeError` si la entrada es inválida: `minutosAHora(1440)` también lanza). Los mensajes de error están en español. |
| `busqueda.ts`   | `normalizarBusqueda(texto)`: minúsculas, sin tildes ni diacríticos, espacios colapsados y recortados. `"González"` → `"gonzalez"`; `"  Ñandú  Pérez "` → `"nandu perez"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `fechas.ts`     | `type Reloj = () => Date`, `ZONA_HORARIA = 'America/Argentina/Salta'`, `hoy(reloj?)` → `YYYY-MM-DD` en esa zona (`reloj` inyectable, por defecto el del sistema; es el único lugar que usa `new Date()`), `fechaADate` / `dateAFecha` entre `YYYY-MM-DD` y `Date` en UTC a medianoche (lo que Prisma devuelve para `@db.Date`; lanzan `RangeError` ante un formato inválido, una fecha inexistente o un `Invalid Date`) y `diaSemanaISO(fecha)` (1 = lunes … 7 = domingo).                                                                                                                                                                                                                                                                                       |
| `auditoria.ts`  | `usuarioAuditoriaSchema` (`{ id, nombre, apellido }`, componente OpenAPI `UsuarioAuditoria`) y su tipo `UsuarioAuditoria`; `auditoriaSchema` (`{ createdAt, updatedAt, createdBy, updatedBy }`: instantes con `z.iso.datetime()`, usuarios con `usuarioAuditoriaSchema.nullable()`; se mezcla con `...auditoriaSchema.shape`) y su tipo `Auditoria`; `SELECT_USUARIO_AUDITORIA = { id: true, nombre: true, apellido: true } as const` (objeto plano, sin importar Prisma); `type FilaAuditable` (estructural: `createdAt` y `updatedAt` como `Date`, `createdBy` y `updatedBy` como `UsuarioAuditoria` o `null`) y `armarAuditoria(fila)` → `Auditoria` (instantes con `toISOString()`; ignora los campos extra; lanza `RangeError` ante un `Invalid Date`).     |

Casos de test obligatorios: `hoy()` a las 23:30 hora Salta (02:30 UTC del día siguiente) devuelve el día correcto, y `normalizarBusqueda` con los dos ejemplos de arriba.

Notas de implementación (verificadas con Zod 4.6.5, `@hono/zod-openapi` 1.6.3 y Node 24):

- `z.iso.date()` ya rechaza fechas inexistentes (`2026-02-30`, `2026-02-29`).
- `z.iso.datetime()` sin opciones exige la `Z` final: rechaza un instante con offset (`-03:00`). Es lo buscado, porque la salida siempre es `toISOString()`.
- `dni` y `email` usan `.pipe()` y en el OpenAPI aparecen solo como `string`: agregarles `.openapi({ description, example })`.
- El `tsconfig` apunta a ES2017: quitar tildes con `/[\u0300-\u036f]/g` (rango de diacríticos combinantes), no con `\p{M}`, y armar `hoy()` con `Intl.DateTimeFormat(...).formatToParts()` (no depender del formato del locale).
- Con `createRouter()`, un query inválido llega como 400 `VALIDACION` (con `app.onError(errorHandler)` instalado).
- Zod da sus mensajes por defecto en inglés: cada primitiva declara el suyo en español (`{ error: '...' }`), porque viajan al usuario en `details` del 400.
- En Zod 4, `.trim()` y `.toLowerCase()` son transformaciones de `ZodString` que corren en el orden en que se declaran: se ponen antes de `.min()` / `.max()` para medir el texto ya recortado.
- La regla de ESLint que impide a `src/server/shared/**` importar features, `src/lib` (Prisma, auth, storage), `src/config`, `src/generated` o el frontend (con alias y con ruta relativa) está en `eslint.config.mjs`. La prueba, en negativo y en positivo, `shared/__tests__/eslint-limites.test.ts` con la API de Node de ESLint: si otro bloque del config la pisa, el test falla.
