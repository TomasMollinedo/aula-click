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
- Se pagina todo listado de entidades, incluida la agenda diaria (decisión T-35). **No** se paginan los selectores de catálogo (por ejemplo materias activas para un dropdown) ni un horario semanal completo (bloques de un profesor): esos devuelven un arreglo.
- En el frontend, el tipo de la respuesta es `PaginatedResponse<T>` de `src/types/index.ts`, que debe coincidir exactamente con esta forma.

## Selectores de catálogo

Listas cortas para los dropdowns de los formularios. Devuelven un **arreglo**, no `{ data, meta }`: no se paginan, no aceptan filtros y traen solo lo activo (lo dado de baja no se puede elegir).

| Ruta                            | Devuelve                                                       |
| ------------------------------- | -------------------------------------------------------------- |
| `GET /api/v1/materias/selector` | Materias activas: `[{ "id", "nombre" }]`, ordenadas por nombre |

Uno nuevo se agrega a esta tabla.

### Selectores con filtros

Como un selector de catálogo (arreglo, sin paginar, salvo aclaración solo lo activo), pero la lista **depende de lo que el usuario eligió antes en el formulario**, así que sí acepta query. Si no hay ninguna opción, responde `200` con `[]`: no es un error, y la UI muestra su propio mensaje. Un query inválido da 400 `VALIDACION` como cualquier otro.

| Ruta                                                                          | Devuelve                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/aulas/disponibles?diaSemana&horaInicio&horaFin&excluirBloqueId?` | Aulas activas libres **durante todo** el horario pedido ese día (ninguna de sus horas ocupada por un bloque activo de cualquier profesor): `[{ "id", "nombre", "capacidad" }]`, ordenadas por nombre. Mismo formato que el alta de bloques: `diaSemana` 1–7, horas `HH:mm` en punto y `horaFin` posterior a `horaInicio`. `excluirBloqueId` (opcional) es para la edición: esa fila no ocupa su aula |
| `GET /api/v1/turnos/materias?fecha?`                                          | Materias con al menos un turno `ACTIVO` en `fecha` (`YYYY-MM-DD`; sin ella, hoy): `[{ "id", "nombre" }]`, ordenadas por nombre. Para el filtro de materia de la agenda (`GET /api/v1/turnos/agenda`). No filtra por el estado de la materia: con una fecha pasada trae también una materia hoy `INACTIVO` si tuvo un turno `ACTIVO` ese día                                                          |
| `GET /api/v1/turnos/aulas?fecha?`                                             | Aulas con al menos un turno `ACTIVO` en `fecha` (`YYYY-MM-DD`; sin ella, hoy): `[{ "id", "nombre" }]`, ordenadas por nombre. Para el filtro de aula de la agenda. Tampoco filtra por el estado del aula                                                                                                                                                                                              |

| `GET /api/v1/turnos/disponibilidad?materiaId&diaSemana?&profesorId?&fecha?` | Horas donde buscar un turno de esa materia: las filas activas de los profesores **activos** que la dictan (asignación activa), agrupadas como bloques (mismo profesor, día y aula, horas contiguas; dos tramos del mismo día son dos resultados), cada hora con su capacidad efectiva y su ocupación en `fecha`. Las horas llenas vienen igual, con `lleno: true`. Ver Turnos |

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

## Turnos

Todos los endpoints son de `MESA_ENTRADAS`. Reglas en `dominio.md` → Turnos.

- **Estado:** `ACTIVO` / `CANCELADO`. La UI muestra `ACTIVO` como **"Agendado"**: es el texto de la pantalla, no un valor del enum, y el frontend no lo inventa como estado.
- **Tipos:** `SESION_UNICA` (una fecha, `fechaFin = fechaInicio`) o `RECURRENTE` (de `fechaInicio` a `fechaFin`, o sin fin con `fechaFin: null`). Las dos fechas caen en el día de la semana de la hora.
- **Un recurrente creado con huecos aparece como varios turnos** (tramos), cada uno con su id y su rango. Las fechas salteadas no se guardan: se informan en el alta (`fechasSinTurno`).
- **`GET /api/v1/turnos/disponibilidad`** (selector con filtros, sin paginar): `materiaId` obligatorio; `diaSemana`, `profesorId` y `fecha` opcionales y combinables.
  - Con `fecha` (hoy o posterior), la ocupación es la de esa fecha y el día sale de ella; si también viene `diaSemana` y no coincide → 400 en `fecha`. Sin `fecha`, la próxima ocurrencia de cada día, hoy incluido (como el horario de bloques).
  - Un `profesorId` que no dicta la materia da `[]`. Materia inexistente → 404; inactiva → 409 `MATERIA_INACTIVA` sin `details`.
  - Orden: profesor (apellido y nombre), día y hora. `lleno = ocupacion >= capacidadEfectiva`. Que un recurrente entre en todas sus fechas no se decide acá: lo decide el alta.

  ```json
  [
    {
      "profesor": { "id": 4, "nombre": "Ana", "apellido": "Pérez" },
      "diaSemana": 1,
      "fecha": "2026-09-28",
      "aula": { "id": 3, "nombre": "Aula 3" },
      "horaInicio": "08:00",
      "horaFin": "10:00",
      "horas": [
        {
          "bloqueId": 10,
          "horaInicio": "08:00",
          "horaFin": "09:00",
          "capacidadEfectiva": 6,
          "ocupacion": 6,
          "lleno": true
        },
        {
          "bloqueId": 11,
          "horaInicio": "09:00",
          "horaFin": "10:00",
          "capacidadEfectiva": 6,
          "ocupacion": 2,
          "lleno": false
        }
      ]
    }
  ]
  ```

- **`POST /api/v1/turnos`**: un turno por hora elegida (y por tramo), todo o nada.

  ```json
  {
    "alumnoId": 12,
    "materiaId": 3,
    "bloqueIds": [10, 12],
    "tipo": "RECURRENTE",
    "fechaInicio": "2026-10-05",
    "fechaFin": "2026-11-30",
    "motivoConsulta": "Repaso de funciones",
    "asignarDondeHayLugar": false
  }
  ```

  - `bloqueIds`: 1 a 24 ids de filas, sin repetir, del mismo profesor y el mismo día.
  - `fechaInicio`: hoy o posterior. `fechaFin`: opcional y nullable; en `RECURRENTE`, `>= fechaInicio`; en `SESION_UNICA`, si viene, igual a `fechaInicio`.
  - `motivoConsulta`: opcional, hasta 500 caracteres; vacío se guarda como `null`.
  - `asignarDondeHayLugar` (default `false`): con un 409 `BLOQUE_LLENO` por fechas llenas, la UI ofrece "Asignar donde hay lugar" o "Cancelar" y reenvía con `true`. En `SESION_UNICA` no cambia nada. Todo se recalcula al reenviar.
  - Respuesta `201`: `{ "cantidad", "turnos", "fechasSinTurno" }`. `cantidad` = filas creadas (puede ser mayor que la cantidad de horas, por los tramos); `turnos` (detalle, ver abajo) ordenados por hora y fecha de inicio; `fechasSinTurno` es `[]` sin conflictos, o `[{ "bloqueId", "horaInicio", "horaFin", "fechas", "completoDesde" }]` con lo que la UI muestra en el mensaje de éxito ("en estas fechas no hay turno").
  - Errores, en este orden: 400 (formato, fecha pasada, horas de más de un profesor o día, fechas que no caen en el día), 404 (alumno, horas por posición en `bloqueIds`, materia), 409 `PROFESOR_INACTIVO`, `MATERIA_INACTIVA`, `MATERIA_NO_ASIGNADA`, `ALUMNO_SUPERPUESTO` y `BLOQUE_LLENO` (ver Errores).

- **`GET /api/v1/turnos/{turnoId}`**: `{ "id", "tipo", "estado", "fechaInicio", "fechaFin", "diaSemana", "horaInicio", "horaFin", "bloqueId", "alumno": { "id", "nombre", "apellido", "dni" }, "profesor": { "id", "nombre", "apellido" }, "materia": { "id", "nombre" }, "aula": { "id", "nombre" }, "motivoConsulta" }` más la auditoría plana. `fechaFin` es `null` en un recurrente sin fin. 404 si no existe.

## Filtros

Nombres fijos de query (un filtro nuevo se agrega a esta lista):

| Query                                | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`                                  | Búsqueda por palabras: cada palabra coincide en forma parcial y todas deben coincidir (`juan gonz` encuentra a "González, Juan"). No distingue mayúsculas ni tildes (`gonzalez` encuentra a "González") e ignora los puntos (`30.123` encuentra el DNI `30123456`). Hasta 100 caracteres; se usan las primeras 5 palabras. En la agenda (decisión T-36) busca por nombre de alumno **o** de profesor, nunca mezclando palabras entre los dos; si además se manda `profesorId`, busca sólo por alumno (T-41) |
| `estado`                             | `ACTIVO`, `INACTIVO` o `TODOS` (no filtra). Solo en entidades con baja lógica (profesores y materias); por defecto `ACTIVO`                                                                                                                                                                                                                                                                                                                                                                                 |
| `materiaId`                          | Filtra por materia                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `profesorId`                         | Filtra por profesor. En la agenda (decisión T-41) es la vista personal de su agenda ese día                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `aulaId`                             | Filtra por aula                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `fecha`                              | Fecha `YYYY-MM-DD`. En la agenda diaria, el día a consultar (sin fecha, el de hoy, zona del negocio). En la disponibilidad de turnos, la fecha de la ocupación: hoy o posterior, y el día de la semana sale de ella (sin fecha, la próxima ocurrencia de cada día)                                                                                                                                                                                                                                          |
| `diaSemana`, `horaInicio`, `horaFin` | Un horario semanal: día ISO (1 a 7) y rango de horas `HH:mm` en punto, con el fin posterior al inicio (aulas disponibles)                                                                                                                                                                                                                                                                                                                                                                                   |
| `excluirBloqueId`                    | Fila de bloque que no cuenta como ocupación (la que se está editando)                                                                                                                                                                                                                                                                                                                                                                                                                                       |

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

| Status | `code`                   | Mensaje / `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 403    | `USUARIO_INHABILITADO`   | "Su usuario no está habilitado". Sin `details`. En `/api/v1`, si el usuario fue dado de baja con la sesión abierta; también en el login (ver Autenticación)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 409    | `BLOQUE_LLENO`           | Alta de turnos. Mensaje general: "No hay lugar: …" si alguna hora no tiene lugar en ninguna fecha (incluida una sesión única llena; se rechaza siempre, aun con `asignarDondeHayLugar`), o "Hay fechas sin lugar: …" si solo algunas fechas de un recurrente están llenas (se puede reenviar con `asignarDondeHayLugar: true`). `details`: una entrada por hora con problema, `{ "path": ["bloqueIds", <posición>], "message", "bloqueId", "horaInicio", "horaFin", "capacidadEfectiva", "fechas", "completoDesde", "sinLugar" }`. `fechas`: las fechas llenas (lista finita); `completoDesde`: la fecha desde la cual todas las siguientes están llenas, o `null`. `message` sigue la HU: "La hora de 9:00 a 10:00 está completa el lunes 26/10", "… está completa desde el lunes 02/11" o "… no tiene lugar en ninguna de las fechas pedidas" |
| 409    | `PROFESOR_INACTIVO`      | El mensaje depende de la operación: "El profesor está inactivo: no se le pueden asignar materias" (materias), "… no se le puede cargar un bloque" (bloques) o "… no se le pueden asignar turnos" (turnos). Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 409    | `TURNOS_VIGENTES`        | `details` según el recurso: al quitar materias de un profesor, una entrada por cada una con turnos vigentes (no cancelados), con `path` `["materiaIds", <posición>]`, `message` y `cantidad`; al dar de baja varias horas de un bloque (`DELETE /bloques`), lo mismo con `path` `["bloqueIds", <posición>]`; al editar o dar de baja una sola hora (un solo recurso, no una lista), `{ "cantidad" }` directo; al dar de baja un profesor, un arreglo con cada turno vigente: `{ "alumno": { "id", "nombre", "apellido" }, "materia": { "id", "nombre" }, "tipo", "fecha", "fechaFin", "horaInicio", "horaFin" }` (`fecha` es la de inicio; `fechaFin` es `null` en un recurrente sin fin)                                                                                                                                                       |
| 409    | `MATERIA_INACTIVA`       | Al asignar materias a un profesor, `details`: una entrada por cada materia inactiva pedida, con `path` `["materiaIds", <posición>]`. Al registrar un turno, `[{ "path": ["materiaId"], "message" }]`. En la disponibilidad de turnos, sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 409    | `MATERIA_CON_PROFESORES` | "No se puede dar de baja una materia con profesores asignados". `details`: los profesores con una asignación activa, `[{ "id", "apellido", "nombre", "estado" }]`, para que la UI los liste y enlace a su ficha                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 409    | `PROFESOR_SIN_MATERIAS`  | "El profesor no tiene materias asignadas: no se le puede cargar un bloque". Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 409    | `BLOQUE_SUPERPUESTO`     | `details`: una entrada por cada hora en conflicto, `[{ "diaSemana", "horaInicio", "horaFin", "bloqueExistenteId" }]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 409    | `AULA_OCUPADA`           | "No hay un aula disponible en ese horario. Por favor, elija otro horario." `details`: una entrada por cada hora en conflicto, `[{ "diaSemana", "horaInicio", "horaFin", "profesorId" }]` (quién ocupa el aula a esa hora)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 409    | `CAPACIDAD_INSUFICIENTE` | "La capacidad no puede ser menor que la cantidad de turnos que el profesor ya tiene a la vez en una hora", al editar la capacidad de un profesor (T-15). `details`: una entrada por hora en conflicto, sobre el campo: `[{ "path": ["capacidad"], "message", "bloqueId", "diaSemana", "horaInicio", "horaFin", "fecha", "cantidad" }]`, con la fecha en que esa hora tiene más turnos a la vez desde hoy y cuántos                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 409    | `ALUMNO_SUPERPUESTO`     | "El alumno ya tiene un turno en ese horario". Rechazo total (ninguna bandera lo saltea). `details`: un ítem por turno en conflicto (de cualquier profesor), `[{ "turnoId", "tipo", "fechaInicio", "fechaFin", "diaSemana", "horaInicio", "horaFin", "profesor": { "id", "nombre", "apellido" }, "materia": { "id", "nombre" } }]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 409    | `MATERIA_NO_ASIGNADA`    | "La materia no está asignada al profesor" (o su asignación está dada de baja), al registrar un turno. `details`: `[{ "path": ["materiaId"], "message" }]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

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
