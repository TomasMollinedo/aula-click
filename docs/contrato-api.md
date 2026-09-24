# Contrato de la API — Aula Click

Lo que el frontend y el backend acuerdan. Es el único documento que los dos lados necesitan leer para hablarse. El detalle de cada endpoint (paths, campos, status codes) está en el OpenAPI: Swagger UI en `/api/v1/docs` y JSON en `/api/v1/openapi.json`.

Si algo de este archivo cambia, se avisa al otro lado y se actualiza acá en el mismo PR (`AGENTS.md`, regla 9).

## URLs

| Prefijo         | Qué es                              | Quién lo llama desde el frontend                      |
| --------------- | ----------------------------------- | ----------------------------------------------------- |
| `/api/v1/...`   | API de negocio (Hono + OpenAPI)     | Solo `fetchJson`, desde `src/features/<entidad>/api/` |
| `/api/auth/...` | Better Auth: login, logout y sesión | Solo el `authClient` de `src/features/auth/`          |

Todo es mismo origen: la sesión viaja en una cookie y no hay tokens que manejar a mano.

## Idioma y nombres

- Rutas, campos JSON, valores de enums y códigos de error en español (`/api/v1/alumnos`, `materiaId`, `ACTIVO`, `BLOQUE_LLENO`).
- Los campos JSON van en camelCase.
- `message` en los errores es un texto en español apto para mostrar al usuario.

## Formatos

| Dato                                           | Formato en la API                                                        | Ejemplo                    |
| ---------------------------------------------- | ------------------------------------------------------------------------ | -------------------------- |
| Fecha de calendario                            | string `YYYY-MM-DD`                                                      | `2026-09-22`               |
| Hora                                           | string `HH:mm` (00:00 a 23:59)                                           | `09:30`                    |
| Día de la semana                               | entero ISO: 1 = lunes … 7 = domingo                                      | `3`                        |
| Instante (auditoría: `createdAt`, `updatedAt`) | string ISO 8601 en UTC                                                   | `2026-09-22T13:45:00.000Z` |
| DNI                                            | se devuelve solo con dígitos; en la entrada se aceptan puntos y espacios | `30123456`                 |
| Email                                          | se guarda en minúsculas y sin espacios alrededor                         | `ana.perez@mail.com`       |
| Teléfono                                       | solo dígitos, de 8 a 20 (sin `+`, `-`, espacios ni paréntesis)           | `387154123456`             |
| Nombre y apellido de una persona               | letras (con tildes, ñ, ü) y espacios; sin números, guiones ni apóstrofos | `María José Pérez`         |

La zona horaria del negocio es `America/Argentina/Salta`. Qué fecha es "hoy" para las reglas (vigencia, prioridad) lo decide la API.

## Listados paginados

Query: `page` (entero >= 1, default 1) y `pageSize` (entero de 1 a 100, default 20).

Respuesta:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 }
}
```

- `totalPages` es 0 cuando no hay resultados.
- Se pagina todo listado de entidades. **No** se paginan los selectores de catálogo (por ejemplo materias activas para un dropdown) ni la agenda diaria, que se filtra por fecha: esos devuelven un arreglo.
- En el frontend, el tipo de la respuesta es `PaginatedResponse<T>` de `src/types/index.ts`, que debe coincidir exactamente con esta forma.

## Selectores de catálogo

Listas cortas para los dropdowns de los formularios. Devuelven un **arreglo**, no `{ data, meta }`: no se paginan, no aceptan filtros y traen solo lo activo (lo dado de baja no se puede elegir).

| Ruta                            | Devuelve                                                       |
| ------------------------------- | -------------------------------------------------------------- |
| `GET /api/v1/materias/selector` | Materias activas: `[{ "id", "nombre" }]`, ordenadas por nombre |

Uno nuevo se agrega a esta tabla.

### Selectores con filtros

Como un selector de catálogo (arreglo, sin paginar, solo lo activo), pero la lista **depende de lo que el usuario eligió antes en el formulario**, así que sí acepta query. Si no hay ninguna opción, responde `200` con `[]`: no es un error, y la UI muestra su propio mensaje. Un query inválido da 400 `VALIDACION` como cualquier otro.

| Ruta                                                                          | Devuelve                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/aulas/disponibles?diaSemana&horaInicio&horaFin&excluirBloqueId?` | Aulas activas libres **durante todo** el horario pedido ese día (ninguna de sus horas ocupada por un bloque activo de cualquier profesor): `[{ "id", "nombre", "capacidad" }]`, ordenadas por nombre. Mismo formato que el alta de bloques: `diaSemana` 1–7, horas `HH:mm` en punto y `horaFin` posterior a `horaInicio`. `excluirBloqueId` (opcional) es para la edición: esa fila no ocupa su aula |

Ejemplo: `GET /api/v1/aulas/disponibles?diaSemana=1&horaInicio=14:00&horaFin=16:00&excluirBloqueId=10` → `[{ "id": 1, "nombre": "Aula 1", "capacidad": 8 }, { "id": 3, "nombre": "Aula 3", "capacidad": 10 }]`.

## Horario de un profesor (bloques)

- **`GET /api/v1/bloques?profesorId=`** devuelve un arreglo (es un horario semanal, sin paginar) de filas de una hora, ordenadas por día y hora. Además de `id`, `diaSemana`, `horaInicio`, `horaFin`, `aula` (`{ id, nombre }`) y `capacidadEfectiva`, cada fila trae:

  | Campo          | Formato      | Qué es                                                                                                                                                                                         |
  | -------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `proximaFecha` | `YYYY-MM-DD` | Próxima fecha de ese `diaSemana` a partir de hoy, **hoy incluido** (aunque la hora de hoy ya haya pasado)                                                                                      |
  | `ocupacion`    | entero       | Turnos `ACTIVO` de esa hora en `proximaFecha` (los cancelados no cuentan). Se compara con `capacidadEfectiva`; no es la suma de todos los turnos futuros (ver `dominio.md` → Bloques de clase) |

- **`GET /api/v1/bloques/{bloqueId}`** devuelve el detalle de una hora, activa o dada de baja (recurso individual, sin `{ data }`): los mismos campos que una fila del horario (con `proximaFecha` y `ocupacion` calculadas igual), más `estado` (`ACTIVO` / `INACTIVO`), `aula` con su `capacidad` (`{ id, nombre, capacidad }`), `profesor` (`{ id, nombre, apellido }`) y la auditoría (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`; ver Recursos individuales). 404 `NO_ENCONTRADO` si la fila no existe.

- **`DELETE /api/v1/bloques`** da de baja varias horas juntas (el bloque que la UI muestra agrupado). Body `{ "bloqueIds": [10, 11, 12] }`: los ids explícitos de las filas que el usuario ve, de 1 a 24 (las horas de un día), sin repetir. Todo o nada. Responde `200` con `{ "cantidad", "bloques" }` (la misma forma que el alta, `BloquesLote`), ordenados por día y hora. Errores, en este orden:
  - 400 `VALIDACION`: lista vacía o de más de 24, ids repetidos o no enteros (issues de Zod), o filas de más de un profesor (`details: [{ "path": ["bloqueIds"], "message" }]`).
  - 404 `NO_ENCONTRADO`: alguna fila no existe o ya fue dada de baja; `details` marca cada una con `path` `["bloqueIds", <posición>]`.
  - 409 `TURNOS_VIGENTES`: alguna fila tiene turnos vigentes; una entrada por fila con `path`, `message` y `cantidad` (ver Errores).

## Filtros

Nombres fijos de query (un filtro nuevo se agrega a esta lista):

| Query                                | Qué hace                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`                                  | Búsqueda por palabras: cada palabra coincide en forma parcial y todas deben coincidir (`juan gonz` encuentra a "González, Juan"). No distingue mayúsculas ni tildes (`gonzalez` encuentra a "González") e ignora los puntos (`30.123` encuentra el DNI `30123456`). Hasta 100 caracteres; se usan las primeras 5 palabras |
| `estado`                             | `ACTIVO`, `INACTIVO` o `TODOS` (no filtra). Solo en entidades con baja lógica (profesores y materias); por defecto `ACTIVO`                                                                                                                                                                                               |
| `materiaId`                          | Filtra por materia                                                                                                                                                                                                                                                                                                        |
| `profesorId`                         | Filtra por profesor                                                                                                                                                                                                                                                                                                       |
| `diaSemana`, `horaInicio`, `horaFin` | Un horario semanal: día ISO (1 a 7) y rango de horas `HH:mm` en punto, con el fin posterior al inicio (aulas disponibles)                                                                                                                                                                                                 |
| `excluirBloqueId`                    | Fila de bloque que no cuenta como ocupación (la que se está editando)                                                                                                                                                                                                                                                     |

## Recursos individuales

- Se devuelven directo, **sin** envoltorio `{ data }`.
- El detalle de una entidad incluye quién la creó y quién la modificó por última vez (nombre y fecha/hora), con la misma forma en todas las entidades. Son cuatro campos al mismo nivel que los demás (no van anidados):

  | Campo       | Formato                                                                     |
  | ----------- | --------------------------------------------------------------------------- |
  | `createdAt` | instante ISO 8601 en UTC                                                    |
  | `updatedAt` | instante ISO 8601 en UTC                                                    |
  | `createdBy` | `{ id, nombre, apellido }` (componente OpenAPI `UsuarioAuditoria`) o `null` |
  | `updatedBy` | `{ id, nombre, apellido }` o `null`                                         |

  `createdBy` y `updatedBy` son `null` solo en registros creados por el seed (usuarios iniciales). Ejemplo del detalle de un alumno (campos propios abreviados):

  ```json
  {
    "id": 12,
    "nombre": "Lucía",
    "apellido": "González",
    "createdAt": "2026-09-22T13:45:00.000Z",
    "updatedAt": "2026-09-23T10:02:17.000Z",
    "createdBy": { "id": "usr_mesa_01", "nombre": "Ana", "apellido": "Pérez" },
    "updatedBy": { "id": "usr_mesa_02", "nombre": "Luis", "apellido": "Gómez" }
  }
  ```

## Errores

Todo error responde con este cuerpo (`details` es opcional):

```json
{
  "error": {
    "code": "CONFLICTO",
    "message": "Ya existe un alumno con ese DNI",
    "details": [{ "path": ["dni"], "message": "Ya existe un alumno con ese DNI" }]
  }
}
```

| Status | `code` por defecto | Clase en el backend              | Cuándo                                                                                                                                                                                                                                                                                               |
| ------ | ------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | `VALIDACION`       | `ValidationError`                | Entrada inválida. `details` trae las issues de Zod (cada una con `path` y `message`). Un 400 que arma un service por una regla (por ejemplo, datos del tutor de un menor) usa la misma forma, así la UI marca los campos igual                                                                       |
| 401    | `NO_AUTENTICADO`   | `UnauthorizedError`              | No hay sesión o la sesión no es válida                                                                                                                                                                                                                                                               |
| 403    | `SIN_PERMISO`      | `ForbiddenError`                 | El rol no alcanza para el endpoint, o el usuario no tiene rol                                                                                                                                                                                                                                        |
| 404    | `NO_ENCONTRADO`    | `NotFoundError`                  | El recurso no existe, o la ruta de `/api/v1` no existe. Si lo que no existe viene en una lista del body (por ejemplo `materiaIds` o `bloqueIds`), `details` marca cada elemento con la misma forma que el 400 (`path` con su posición)                                                               |
| 409    | `CONFLICTO`        | `ConflictError`                  | Conflicto con el estado actual (DNI duplicado, materia ya asignada al profesor, solapamiento de turno, turnos vigentes que impiden la baja). Si el conflicto es de un campo (DNI) o de elementos de una lista (`materiaIds`), `details` los marca con la misma forma que el 400 (`path` + `message`) |
| 500    | `ERROR_INTERNO`    | `AppError` o error no controlado | Error inesperado; no expone detalles                                                                                                                                                                                                                                                                 |

Códigos específicos (reemplazan al `code` por defecto; uno nuevo se agrega acá):

| Status | `code`                   | Mensaje / `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 403    | `USUARIO_INHABILITADO`   | "Su usuario no está habilitado". Sin `details`. En `/api/v1`, si el usuario fue dado de baja con la sesión abierta; también en el login (ver Autenticación)                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 409    | `BLOQUE_LLENO`           | `details`: lista de fechas en las que el bloque está lleno                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 409    | `PROFESOR_INACTIVO`      | "El profesor está inactivo: no se le pueden asignar materias". Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 409    | `TURNOS_VIGENTES`        | `details` según el recurso: al quitar materias de un profesor, una entrada por cada una con turnos vigentes (no cancelados), con `path` `["materiaIds", <posición>]`, `message` y `cantidad`; al dar de baja varias horas de un bloque (`DELETE /bloques`), lo mismo con `path` `["bloqueIds", <posición>]`; al editar o dar de baja una sola hora (un solo recurso, no una lista), `{ "cantidad" }` directo; al dar de baja un profesor, un arreglo con cada turno vigente: `{ "alumno": { "id", "nombre", "apellido" }, "materia": { "id", "nombre" }, "fecha", "horaInicio", "horaFin" }` |
| 409    | `MATERIA_INACTIVA`       | `details`: una entrada por cada materia inactiva pedida, con `path` `["materiaIds", <posición>]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 409    | `MATERIA_CON_PROFESORES` | "No se puede dar de baja una materia con profesores asignados". `details`: los profesores con una asignación activa, `[{ "id", "apellido", "nombre", "estado" }]`, para que la UI los liste y enlace a su ficha                                                                                                                                                                                                                                                                                                                                                                              |
| 409    | `PROFESOR_SIN_MATERIAS`  | "El profesor no tiene materias asignadas: no se le puede cargar un bloque". Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 409    | `BLOQUE_SUPERPUESTO`     | `details`: una entrada por cada hora en conflicto, `[{ "diaSemana", "horaInicio", "horaFin", "bloqueExistenteId" }]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 409    | `AULA_OCUPADA`           | "No hay un aula disponible en ese horario. Por favor, elija otro horario." `details`: una entrada por cada hora en conflicto, `[{ "diaSemana", "horaInicio", "horaFin", "profesorId" }]` (quién ocupa el aula a esa hora)                                                                                                                                                                                                                                                                                                                                                                    |

Qué hace la UI con cada caso está en `arquitectura-frontend.md` → Manejo de errores en la UI.

## Roles

Valores del campo `role` de la sesión: `MESA_ENTRADAS`, `PROFESOR`, `GERENTE` y `ALUMNO`. Un usuario tiene un solo rol.

| Valor           | Rol              |
| --------------- | ---------------- |
| `MESA_ENTRADAS` | Mesa de entradas |
| `PROFESOR`      | Profesor         |
| `GERENTE`       | Gerente          |
| `ALUMNO`        | Alumno           |

- Base de datos: catálogo `rol` (lo carga el seed); `Usuario.role` es un FK a él.
- Backend: `ROLES` en `src/server/shared/actor.ts`.
- Frontend: el tipo `Role` de `src/types/index.ts`.

Los dos lados no pueden compartir código, así que un rol nuevo o un cambio de valor se hace en el seed, en `actor.ts` y en `src/types/index.ts` en el mismo PR.

## Autenticación

- Login con email y contraseña contra `/api/auth/...`, siempre a través del `authClient`.
- No hay registro público: las cuentas se crean desde el servidor (el seed crea los usuarios de desarrollo y mesa de entradas crea la cuenta de cada profesor al darlo de alta). `POST /api/auth/sign-up/email` responde 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED` y el frontend no tiene pantalla de registro.
- `/api/auth/*` responde con el **formato de Better Auth**, `{ "code", "message" }` (el `authClient` lo expone como `error.code` / `error.message`), no con `{ "error": { … } }`. El `message` de Better Auth viene en inglés: la UI elige el texto según el `code`.
- Códigos que la UI maneja en el login (`POST /api/auth/sign-in/email`):

  | Status | `code`                      | Cuándo                                                                                        | Texto en la UI                     |
  | ------ | --------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------- |
  | 401    | `INVALID_EMAIL_OR_PASSWORD` | Email inexistente o contraseña incorrecta (siempre el mismo, sin indicar cuál falló)          | "Usuario o contraseña incorrectos" |
  | 403    | `USUARIO_INHABILITADO`      | Contraseña correcta, pero el usuario está inactivo (message: "Su usuario no está habilitado") | "Su usuario no está habilitado"    |
  | 400    | `INVALID_EMAIL`             | El email no tiene formato válido (el formulario lo valida antes de enviarlo)                  | Error de formato del campo         |

- La sesión vence por inactividad (60 minutos sin pedidos) y se renueva sola con el uso. `rememberMe` no cambia la duración. Una sesión vencida se ve en `/api/v1` como 401 `NO_AUTENTICADO`.
- Los endpoints de `/api/v1` responden 401 sin sesión válida, 403 `USUARIO_INHABILITADO` si el usuario fue dado de baja y 403 `SIN_PERMISO` si el rol no alcanza (ver tabla de errores).
- De qué capa sale cada respuesta: `arquitectura-backend.md` → Autenticación y autorización → Qué responde cada falla.
