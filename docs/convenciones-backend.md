# Convenciones transversales del backend — Aula Click

Se aplican a todas las features de API. Lo que se sabe que se repite vive en `src/server/shared/`; ninguna feature lo reimplementa. El formato con el que estos datos viajan al frontend está en [`contrato-api.md`](./contrato-api.md); este documento cubre cómo se implementan y se guardan.

## Estado

Las convenciones valen desde ya para todo código nuevo, pero **parte del código de apoyo todavía no existe**. Si una tarea necesita una pieza **A construir** y aún no existe, se avisa antes de crearla: se construye una sola vez, en un PR propio, con sus tests y siguiendo la especificación de abajo. Nunca se inventa una versión propia dentro de la feature.

| Pieza                                                                                        | Estado                                                                          |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Convenciones de idioma, nombres de query, formato de fechas y horas, paginación y respuestas | **Vigentes**                                                                    |
| `src/server/shared/` (`actor`, `paginacion`, `zod`, `busqueda`, `fechas`) con sus tests      | **A construir** (no depende del schema; es lo primero)                          |
| Regla de ESLint `shared` → `features`                                                        | **A construir**, junto con `shared/`                                            |
| `Actor` en el contexto desde `requireAuth()` (403 si el usuario no tiene rol)                | **A construir**                                                                 |
| `disableSignUp: true` en `src/lib/auth.ts`                                                   | **A construir** (una línea). **Hoy el registro público por email está abierto** |
| Columna `busqueda`, enum `estado` (`ACTIVO` / `INACTIVO`), campos de auditoría               | **A construir** (dependen del `schema.prisma`)                                  |
| Consulta de "turno vigente" y transacción con bloqueo de fila en `turnos.repository`         | **A construir** (dependen de la feature `turnos`)                               |
| Auditoría completada por el repository, y seed                                               | **A construir**                                                                 |

## `src/server/shared/`

Contiene solo código **sin significado de negocio**: paginación, primitivas de Zod, normalización de búsqueda, fechas y el tipo `Actor`.

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

- `mode: 'insensitive'` de Prisma no resuelve tildes. Las entidades buscables (alumnos, profesores) tienen una columna `busqueda`, calculada al guardar con `normalizarBusqueda()` sobre apellido, nombre y DNI.
- La búsqueda normaliza `q` con la misma función y usa `contains` sobre `busqueda`. Si cambian nombre, apellido o DNI, se recalcula.
- No se usa la extensión `unaccent` de Postgres.

## Auditoría y Actor

- Toda entidad de negocio lleva `createdById`, `updatedById`, `createdAt` y `updatedAt`.
- `requireAuth()` deja el `Actor` (`{ userId, role }`) en el contexto de Hono con `c.set('actor', ...)`. Se agrega `actor: Actor` a `AppEnv` en `src/server/router.ts`, así `c.get('actor')` sale tipado en los controllers.
- El controller pasa el `Actor` al service y el service al repository, que completa los campos. No se usan extensiones de Prisma ni magia.
- Si el usuario autenticado no tiene rol, `requireAuth()` responde 403 (`SIN_PERMISO`). Siguen en el contexto `user` y `session`, y `requireRole(...roles)` no cambia su contrato.
- El detalle de una entidad devuelve quién la creó y quién la modificó por última vez (nombre y fecha/hora).

## Baja lógica

- Profesores y materias tienen el enum `estado` (`ACTIVO` / `INACTIVO`). Nada se borra.
- Sus listados aceptan `?estado=`, con `ACTIVO` por defecto.
- Los alumnos no tienen baja lógica.

## Turno vigente

- La definición de "vigente" está en [`dominio.md`](./dominio.md#turnos). Se implementa **una sola vez**, en una consulta de `turnos.repository`.
- Profesores y materias la usan desde sus services (HU-03 a HU-06), importando ese repository. Está prohibido reescribir la condición en otro lado.

## Concurrencia en la capacidad de un bloque

- La verificación de capacidad y la inserción del turno se hacen en una sola transacción de `turnos.repository` que bloquea la fila del bloque (`SELECT ... FOR UPDATE` dentro de `$transaction`). El service decide la regla; el repository la ejecuta de forma atómica.
- Debe existir un test que cubra dos reservas simultáneas del último lugar.

## Seguridad de cuentas

- El registro público debe estar deshabilitado (**A construir**; hoy está abierto). Los usuarios los crea un gerente (o el seed, en desarrollo). No se expone ningún endpoint de sign-up abierto.
- La opción es `emailAndPassword.disableSignUp: true` en `src/lib/auth.ts` (existe en el tipo de Better Auth 1.7.5). Con ella, `POST /api/auth/sign-up/email` responde 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED`.
- El chequeo no exime las llamadas desde el servidor: **`auth.api.signUpEmail` también queda bloqueado, así que el seed no puede usarlo** (ver decisión D-05).
- Cómo verificarlo: mientras la base no tenga las tablas de Better Auth, el endpoint da 500 (`Prisma schema mismatch`) con o sin la opción, así que no prueba nada. Con el schema creado, `POST /api/auth/sign-up/email` con un cuerpo válido debe dar 400 y no crear la cuenta.
- El campo `role` nunca lo define el usuario (`input: false`).

## Especificación de `src/server/shared/` (A construir)

Cada archivo lleva su test en `shared/__tests__/`, con tests reales (no `it.todo`). Se usa el `z` de `@hono/zod-openapi`, para poder llamar a `.openapi()`.

| Archivo         | Exporta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actor.ts`      | `type Actor = { userId: string; role: string }` (`role` como string hasta decidir sus valores, D-01).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `paginacion.ts` | `paginacionQuerySchema` (`page`: entero >= 1, default 1; `pageSize`: entero 1..100, default 20; ambos coercionados desde string), `paginatedSchema(itemSchema)` (respuesta `{ data, meta }`), `calcularSkipTake(query)` → `{ skip, take }` y `armarMeta(query, total)` (`totalPages` = techo de `total / pageSize`, 0 si no hay resultados).                                                                                                                                                                                                               |
| `zod.ts`        | `dni`: se limpian puntos y espacios y luego se valida 7 u 8 dígitos; **se guarda solo con dígitos**. `email`: trim, minúsculas, email válido de hasta 254 caracteres. `telefono`: trim; solo dígitos, espacios, `+`, `-` y paréntesis; entre 8 y 20 caracteres con al menos 8 dígitos; **se guarda como lo escribió el usuario**. `textoRequerido(max)`: trim, entre 1 y `max`. `fechaISO`: `YYYY-MM-DD` y fecha real de calendario. `horaHHmm`: `HH:mm` de 00:00 a 23:59. `horaAMinutos` / `minutosAHora` (0 a 1439; lanzan `RangeError` si es inválido). |
| `busqueda.ts`   | `normalizarBusqueda(texto)`: minúsculas, sin tildes ni diacríticos, espacios colapsados y recortados. `"González"` → `"gonzalez"`; `"  Ñandú  Pérez "` → `"nandu perez"`.                                                                                                                                                                                                                                                                                                                                                                                  |
| `fechas.ts`     | `hoy(reloj?)` → `YYYY-MM-DD` en `America/Argentina/Salta` (`reloj` inyectable, por defecto el del sistema; es el único lugar que usa `new Date()`), `fechaADate` / `dateAFecha` entre `YYYY-MM-DD` y `Date` en UTC a medianoche (lo que Prisma devuelve para `@db.Date`) y `diaSemanaISO(fecha)` (1 = lunes … 7 = domingo).                                                                                                                                                                                                                                |

Casos de test obligatorios: `hoy()` a las 23:30 hora Salta (02:30 UTC del día siguiente) devuelve el día correcto, y `normalizarBusqueda` con los dos ejemplos de arriba.

Notas de implementación (verificadas con Zod 4.6.5, `@hono/zod-openapi` 1.6.3 y Node 24):

- `z.iso.date()` ya rechaza fechas inexistentes (`2026-02-30`, `2026-02-29`).
- `dni` y `email` usan `.pipe()` y en el OpenAPI aparecen solo como `string`: agregarles `.openapi({ description, example })`.
- El `tsconfig` apunta a ES2017: quitar tildes con `/[\u0300-\u036f]/g` (rango de diacríticos combinantes), no con `\p{M}`, y armar `hoy()` con `Intl.DateTimeFormat(...).formatToParts()` (no depender del formato del locale).
- Con `createRouter()`, un query inválido llega como 400 `VALIDACION` (con `app.onError(errorHandler)` instalado).
- Regla de ESLint a agregar: `src/server/shared/**` no importa `@/server/features/**` ni `**/features/**` (ni Prisma). Probarla en negativo con un archivo descartable y en positivo con una feature que importe de `shared`.
