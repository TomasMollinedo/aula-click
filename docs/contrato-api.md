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

El DNI de un alumno o de un profesor no se puede modificar después del alta : un `dni` en el `PATCH` responde 400 `VALIDACION` (`"El DNI no se puede modificar"`), en vez de ignorarse. El email y el teléfono del alumno son `nullable` (pueden llegar `null`) y obligatorios solo si es mayor de edad; si es menor, valen en cambio los datos del tutor (ver `dominio.md` → Alumnos).

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
- Se pagina todo listado de entidades, incluida la agenda diaria (decisión T-35). **No** se paginan los selectores de catálogo (por ejemplo materias activas para un dropdown), un horario semanal completo (bloques de un profesor) ni la agenda de un profesor ni la del centro (`/agendas/propia`, `/agendas/profesor` y `/agendas/centro`), acotadas por su rango de fechas (decisiones T-43 y T-68): esos devuelven un arreglo.
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
| `GET /api/v1/agendas/materias?fecha?` y `GET /api/v1/agendas/aulas?fecha?`    | Materias y aulas con turno en una fecha, para los filtros de la agenda. Ver Agendas                                                                                                                                                                                                                                                                                                                  |

| `GET /api/v1/turnos/disponibilidad?materiaId&diaSemana?&profesorId?&fecha?` | Horas donde buscar un turno de esa materia: las filas activas de los profesores **activos** que la dictan (asignación activa), agrupadas como bloques (mismo profesor, día y aula, horas contiguas; dos tramos del mismo día son dos resultados), cada hora con su capacidad efectiva y su ocupación en `fecha`. Las horas llenas vienen igual, con `lleno: true`. Ver Turnos |

Ejemplo: `GET /api/v1/aulas/disponibles?diaSemana=1&horaInicio=14:00&horaFin=16:00&excluirBloqueId=10` → `[{ "id": 1, "nombre": "Aula 1", "capacidad": 8 }, { "id": 3, "nombre": "Aula 3", "capacidad": 10 }]`.

## Materias

HU-12 (T-39). El catálogo lo administra el **gerente**; mesa de entradas conserva la lectura (la necesita para registrar turnos y exámenes). Asignar materias a un profesor sigue siendo de mesa de entradas (`/profesores/{id}/materias`).

| Endpoint                                      | Roles                      | Qué hace                                                                                                                                                                                    |
| --------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/materias?q&estado&page&pageSize` | `MESA_ENTRADAS`, `GERENTE` | Listado paginado por nombre: `[{ "id", "nombre", "estado", "precioHora", "sinPrecio" }]`. `estado` = `ACTIVO` (por defecto), `INACTIVO` o `TODOS`                                           |
| `GET /api/v1/materias/selector`               | `MESA_ENTRADAS`, `GERENTE` | Materias activas `[{ "id", "nombre" }]` (ver Selectores de catálogo). Toda materia activa tiene precio                                                                                      |
| `GET /api/v1/materias/{id}`                   | `MESA_ENTRADAS`, `GERENTE` | `{ "id", "nombre", "descripcion", "estado", "precioHora", "sinPrecio", "profesores": [{ "id", "apellido", "nombre", "estado" }] }` más la auditoría plana. 404 si no existe                 |
| `POST /api/v1/materias`                       | `GERENTE`                  | Alta: `{ "nombre", "precioHora", "descripcion"? }`. 201 con el detalle. 409 `CONFLICTO` si el nombre ya existe                                                                              |
| `PATCH /api/v1/materias/{id}`                 | `GERENTE`                  | Edición parcial de `nombre`, `descripcion` y `precioHora` (al menos uno; lo omitido no cambia). También sobre una inactiva. 200 con el detalle; 404; 409 `CONFLICTO` si el nombre ya existe |
| `PATCH /api/v1/materias/{id}/baja`            | `GERENTE`                  | Baja lógica (`INACTIVO`). 409 `MATERIA_CON_PROFESORES` si tiene profesores asignados                                                                                                        |
| `PATCH /api/v1/materias/{id}/reactivacion`    | `GERENTE`                  | Vuelve a `ACTIVO` (si ya lo estaba, 200 igual). 409 `MATERIA_SIN_PRECIO` si no tiene precio: primero se carga con `PATCH /materias/{id}`                                                    |

Cualquier otro rol recibe 403 `SIN_PERMISO`, también en las escrituras llamadas por fuera de la pantalla.

**Campos:**

- `nombre`: obligatorio en el alta, hasta 100 caracteres, único sin distinguir mayúsculas ni tildes (`"Matemática"` y `"matematica"` chocan). En el `PATCH` no acepta `null` ni vacío. El 409 marca `details: [{ "path": ["nombre"], "message" }]`.
- `descripcion`: opcional, hasta 500 caracteres; `""` o `null` la dejan vacía (`null`).
- `precioHora`: **importe en pesos**, número JSON (no string) mayor a 0, con hasta dos decimales y como máximo `99999999.99` (`8000`, `8000.5`, `8000.25`). `0`, un negativo, uno con tres decimales (`100.005`), un string o `null` responden 400 `VALIDACION` sobre `["precioHora"]`. Obligatorio en el alta; opcional en el `PATCH`, pero nunca `null`: desde la API una materia no puede quedar sin precio. En la respuesta llega como número (`8000.5`, no `"8000.50"`); la UI le da el formato de pesos con dos decimales.
- `precioHora: null` y `sinPrecio: true` solo en materias anteriores a HU-12 que nunca tuvieron precio: quedaron `INACTIVO` al migrar y no salen en el selector hasta que el gerente les carga el precio y las reactiva. `sinPrecio` es `precioHora === null`, calculado por la API.
- Cambiar el precio no modifica los pagos ya registrados: rige para los cobros siguientes (ver `dominio.md` → Materias).

## Horario de un profesor (bloques)

- **`GET /api/v1/bloques?profesorId=`** devuelve un arreglo (es un horario semanal, sin paginar) de filas de una hora, ordenadas por día y hora. Además de `id`, `diaSemana`, `horaInicio`, `horaFin`, `aula` (`{ id, nombre }`) y `capacidadEfectiva`, cada fila trae:

  | Campo          | Formato      | Qué es                                                                                                                                                                                                                                                                 |
  | -------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `proximaFecha` | `YYYY-MM-DD` | Próxima fecha de ese `diaSemana` a partir de hoy, **hoy incluido** (aunque la hora de hoy ya haya pasado)                                                                                                                                                              |
  | `ocupacion`    | entero       | Ocurrencias que ocupan lugar en esa hora en `proximaFecha` (no cuentan las canceladas ni las posteriores al fin efectivo de una serie finalizada). Se compara con `capacidadEfectiva`; no es la suma de todos los turnos futuros (ver `dominio.md` → Bloques de clase) |

- **`GET /api/v1/bloques/{bloqueId}`** devuelve el detalle de una hora, activa o dada de baja (recurso individual, sin `{ data }`): los mismos campos que una fila del horario (con `proximaFecha` y `ocupacion` calculadas igual), más `estado` (`ACTIVO` / `INACTIVO`), `aula` con su `capacidad` (`{ id, nombre, capacidad }`), `profesor` (`{ id, nombre, apellido }`) y la auditoría (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`; ver Recursos individuales). 404 `NO_ENCONTRADO` si la fila no existe.

- **`DELETE /api/v1/bloques`** da de baja varias horas juntas (el bloque que la UI muestra agrupado). Body `{ "bloqueIds": [10, 11, 12] }`: los ids explícitos de las filas que el usuario ve, de 1 a 24 (las horas de un día), sin repetir. Todo o nada. Responde `200` con `{ "cantidad", "bloques" }` (la misma forma que el alta, `BloquesLote`), ordenados por día y hora. Errores, en este orden:
  - 400 `VALIDACION`: lista vacía o de más de 24, ids repetidos o no enteros (issues de Zod), o filas de más de un profesor (`details: [{ "path": ["bloqueIds"], "message" }]`).
  - 404 `NO_ENCONTRADO`: alguna fila no existe o ya fue dada de baja; `details` marca cada una con `path` `["bloqueIds", <posición>]`.
  - 409 `TURNOS_VIGENTES`: alguna fila tiene turnos vigentes; una entrada por fila con `path`, `message` y `cantidad` (ver Errores).

## Turnos

Todos los endpoints son de `MESA_ENTRADAS`. En `turnos` quedan la disponibilidad, el alta y el detalle; las agendas se movieron a `/api/v1/agendas/*` (T-30, ver Agendas). Reglas en `dominio.md` → Turnos.

- **Estado:** `ACTIVO` / `CANCELADO`. La UI muestra `ACTIVO` como **"Agendado"**: es el texto de la pantalla, no un valor del enum, y el frontend no lo inventa como estado.
- **Tipos:** `SESION_UNICA` (una fecha, `fechaFin = fechaInicio`) o `RECURRENTE` (de `fechaInicio` a `fechaFin`, o sin fin con `fechaFin: null`). Las dos fechas caen en el día de la semana de la hora.
- **Un recurrente creado con huecos aparece como varios turnos** (tramos), cada uno con su id y su rango. Las fechas salteadas no se guardan: se informan en el alta (`fechasSinTurno`).
- **`GET /api/v1/turnos/disponibilidad`** (selector con filtros, sin paginar): `materiaId` obligatorio; `diaSemana`, `profesorId` y `fecha` opcionales y combinables.
  - Con `fecha` (hoy o posterior), la ocupación es la de esa fecha y el día sale de ella; si también viene `diaSemana` y no coincide → 400 en `fecha`. Sin `fecha`, la próxima ocurrencia de cada día, hoy incluido (como el horario de bloques).
  - Un `profesorId` que no dicta la materia da `[]`. Materia inexistente → 404; inactiva → 409 `MATERIA_INACTIVA` sin `details`.
  - Orden: profesor (apellido y nombre), día y hora. `lleno = ocupacion >= capacidadEfectiva`. Que un recurrente entre en todas sus fechas no se decide acá: lo decide el alta.
  - `ocupacion` cuenta las ocurrencias que ocupan lugar en esa fecha: una cancelada, o posterior al fin efectivo de una serie finalizada, deja su lugar libre (T-30). Una pagada o pasada ocupa lugar igual.

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
    "observaciones": "Repaso de funciones",
    "temas": "Funciones cuadráticas",
    "asignarDondeHayLugar": false
  }
  ```

  - `bloqueIds`: 1 a 24 ids de filas, sin repetir, del mismo profesor y el mismo día.
  - `fechaInicio`: hoy o posterior. `fechaFin`: opcional y nullable; en `RECURRENTE`, `>= fechaInicio`; en `SESION_UNICA`, si viene, igual a `fechaInicio`.
  - `observaciones` (T-29; antes `motivoConsulta`): opcional, hasta 500 caracteres; vacío se guarda como `null`.
  - `temas` ("Temas a trabajar", HU-08): opcional y hasta 500 caracteres en `RECURRENTE`; **obligatorio** en `SESION_UNICA` (400 `VALIDACION` en `temas` si falta o queda vacío). Con "Asignar igual", todos los tramos creados de una hora llevan las mismas `observaciones` y `temas` del pedido.
  - `asignarDondeHayLugar` (default `false`): con un 409 `BLOQUE_LLENO` por fechas llenas, la UI ofrece "Asignar igual" (con la aclaración "Se crea solo en las fechas con lugar") o "Cancelar" y reenvía con `true`. En `SESION_UNICA` no cambia nada. Todo se recalcula al reenviar.
  - Respuesta `201`: `{ "cantidad", "turnos", "fechasSinTurno" }`. `cantidad` = filas creadas (puede ser mayor que la cantidad de horas, por los tramos); `turnos` (detalle, ver abajo) ordenados por hora y fecha de inicio; `fechasSinTurno` es `[]` sin conflictos, o `[{ "bloqueId", "horaInicio", "horaFin", "fechas", "completoDesde" }]` con lo que la UI muestra en el mensaje de éxito ("en estas fechas no hay turno").
  - Errores, agrupados por status (no es el orden en que se validan: por ejemplo, `PROFESOR_INACTIVO` se decide antes que el 404 de materia): 400 (formato, fecha pasada, horas de más de un profesor o día, fechas que no caen en el día, `temas` faltante en una sesión única), 404 (alumno, horas por posición en `bloqueIds`, materia), 409 `PROFESOR_INACTIVO`, `MATERIA_INACTIVA`, `MATERIA_NO_ASIGNADA`, `ALUMNO_SUPERPUESTO` y `BLOQUE_LLENO` (ver Errores).

- **`GET /api/v1/turnos/{turnoId}`**: `{ "id", "tipo", "estado", "fechaInicio", "fechaFin", "diaSemana", "horaInicio", "horaFin", "bloqueId", "alumno": { "id", "nombre", "apellido", "dni" }, "profesor": { "id", "nombre", "apellido" }, "materia": { "id", "nombre" }, "aula": { "id", "nombre" }, "observaciones", "temas" }` más la auditoría plana. `fechaFin` es `null` en un recurrente sin fin. 404 si no existe.

## Agendas

> **El frontend tiene que pasar a estas URLs; lo conecta T-35.** T-30 movió las agendas de `turnos` a su propia feature sin cambiar el contrato (query, roles, respuesta, errores, paginación, orden y tope de 31 días): sólo cambió la URL. Las viejas ya no existen (no hay alias).

| Antes                                | Ahora                          | Rol             |
| ------------------------------------ | ------------------------------ | --------------- |
| `GET /api/v1/turnos/agenda`          | `GET /api/v1/agendas/diaria`   | `MESA_ENTRADAS` |
| `GET /api/v1/turnos/agenda-propia`   | `GET /api/v1/agendas/propia`   | `PROFESOR`      |
| `GET /api/v1/turnos/agenda-profesor` | `GET /api/v1/agendas/profesor` | `MESA_ENTRADAS` |
| `GET /api/v1/turnos/materias`        | `GET /api/v1/agendas/materias` | `MESA_ENTRADAS` |
| `GET /api/v1/turnos/aulas`           | `GET /api/v1/agendas/aulas`    | `MESA_ENTRADAS` |

Las agendas leen **ocurrencias** (un turno en una fecha, ver `convenciones-backend.md` → Ocurrencias) y **muestran todas, también las canceladas** (HU-13, T-57: se siguen viendo con su estado; antes de T-57 no salían). Una ocurrencia posterior al fin efectivo de una serie finalizada no existe y no sale.

### La ocurrencia de una agenda

Las cuatro agendas (`diaria`, `propia`, `profesor` y `centro`) devuelven ocurrencias con **los mismos campos**; `diaria` y `centro` suman el `profesor` del bloque (en las de un solo profesor es el de la consulta y no viaja):

```json
{
  "turnoId": 31,
  "fecha": "2026-09-28",
  "bloqueAgendaId": 8,
  "diaSemana": 1,
  "horaInicio": "09:00",
  "horaFin": "10:00",
  "alumno": { "id": 12, "apellido": "González", "nombre": "Lucía" },
  "profesor": { "id": 3, "apellido": "Pérez", "nombre": "Ana" },
  "materia": { "id": 3, "nombre": "Matemática" },
  "aula": { "id": 3, "nombre": "Aula 3" },
  "tipo": "RECURRENTE",
  "estado": "AGENDADO",
  "estadoPago": "PENDIENTE",
  "prioridad": "ALTA",
  "examen": {
    "id": 5,
    "fecha": "2026-10-02",
    "tipo": "PARCIAL",
    "materiaNombre": "Matemática",
    "dias": 4
  }
}
```

- La ocurrencia se identifica por `turnoId` + `fecha` (`turnoId` se repite en un recurrente): es el identificador de `GET /api/v1/ocurrencias/{turnoId}/{fecha}`. `bloqueAgendaId` identifica la clase junto con `fecha`: dos ocurrencias con la misma `fecha` y el mismo `bloqueAgendaId` son la misma clase, y agruparlas es presentación (lo hace el cliente).
- `estado`: `AGENDADO`, `SIN_REGISTRAR` (pasada, sin asistencia: HU-22 es del próximo sprint) o `CANCELADO` (definición F). La UI muestra `AGENDADO` como "Agendado".
- `estadoPago`: `PAGADO` si la ocurrencia tiene un pago aplicado, si no `PENDIENTE` (una cancelada nunca se cobró: `PENDIENTE`).
- `prioridad` (`ALTA`, `MEDIA`, `BAJA`) y `examen` (el que la determina, T-31): `null` en una ocurrencia **cancelada**; `examen` también es `null` si no hay un examen próximo. Es la misma regla que el detalle y las ocurrencias del alumno.
- **No hay `fechaOriginal` ni `reprogramada`**: un turno reprogramado es un turno más, en su fecha y bloque nuevos (definiciones A y B). Tampoco hay `id` ni el `estado: "ACTIVO"` de antes: `estado` es el de la ocurrencia y el id es `turnoId`.
- **Filtros `estado` y `prioridad`**, opcionales y combinables entre sí y con los demás filtros de cada agenda. `prioridad` deja afuera las canceladas (no tienen). Valores inválidos: 400 `VALIDACION`.

### Agenda diaria

**`GET /api/v1/agendas/diaria?fecha&page&pageSize&materiaId&aulaId&profesorId&estado&prioridad&q`** (rol `MESA_ENTRADAS`): las ocurrencias de una fecha (sin `fecha`, hoy), paginadas (decisión T-35).

- Filtros: `materiaId`, `aulaId`, `profesorId` (vista personal de ese profesor, T-42), `estado`, `prioridad` y `q` (T-36: todas las palabras en el nombre del alumno o todas en el del profesor; con `profesorId`, sólo en el del alumno). El total de `meta` es el de lo filtrado.
- Orden: hora de inicio, dentro de la hora por profesor (apellido y nombre) y por id del turno.
- Ítem: el de "La ocurrencia de una agenda", con `profesor`.
- Errores: 400 `VALIDACION` (fecha, ids, `estado`, `prioridad`, `q` de más de 100 caracteres, paginación); 403 para cualquier rol que no sea `MESA_ENTRADAS`.

### Selectores de la agenda

**`GET /api/v1/agendas/materias?fecha?`** y **`GET /api/v1/agendas/aulas?fecha?`** (rol `MESA_ENTRADAS`, selectores con filtros): las materias o las aulas con al menos una ocurrencia no cancelada en `fecha` (`YYYY-MM-DD`; sin ella, hoy), `[{ "id", "nombre" }]`, sin paginar y ordenadas por nombre. No filtran por el estado de la materia o del aula: con una fecha pasada traen también una hoy `INACTIVO` si tuvo turno ese día. Siguen igual que antes de T-57: no consideran las canceladas. 400 si `fecha` es inválida.

### Agenda propia del profesor

**`GET /api/v1/agendas/propia?desde&hasta&estado&prioridad`** (rol `PROFESOR`, sólo lectura): los turnos del profesor **de la sesión** para un día o un rango. El profesor sale de la sesión, **nunca de un parámetro**: no hay forma de pedir la agenda de otro, y un `profesorId` en el query se ignora.

- `desde` (`YYYY-MM-DD`, opcional): primer día. Sin `desde`, hoy. `hasta` (opcional): último día, incluido; sin `hasta`, el mismo día que `desde` (la vista por día). Se admiten fechas pasadas.
- Devuelve un **arreglo sin paginar** (decisión T-43), ordenado por fecha y, dentro del día, por hora de inicio e id del turno.
- Cada ítem es una **ocurrencia**, no un turno: un recurrente aparece una vez por cada fecha del rango que cae en el día de su bloque, así que `turnoId` se repite. Es el de "La ocurrencia de una agenda", **sin `profesor`**.
- Errores: 400 `VALIDACION` si una fecha tiene formato inválido, si `hasta` es anterior a `desde`, si el rango supera los **31 días** (`details` sobre `hasta`) o si `estado` o `prioridad` no son válidos; 404 `NO_ENCONTRADO` si el usuario de la sesión no tiene ficha de profesor; 403 para cualquier rol que no sea `PROFESOR`.

### Agenda de un profesor (mesa de entradas)

**`GET /api/v1/agendas/profesor?profesorId&desde&hasta&estado&prioridad`** (rol `MESA_ENTRADAS`, sólo lectura; decisión T-44): la agenda de cualquier profesor para un día o un rango, para la vista semanal de la ficha del profesor (HU-02).

- `profesorId` (obligatorio): el profesor. `desde`, `hasta`, `estado` y `prioridad` funcionan igual que en la agenda propia (mismos defaults y mismo tope de 31 días).
- La respuesta tiene **exactamente la forma de "Agenda propia del profesor"** (arreglo sin paginar de ocurrencias `turnoId` + `fecha`, mismo orden, con las canceladas y sin `profesor`): el frontend reutiliza el mismo tipo.
- Un profesor **inactivo** también se puede consultar: sus turnos históricos siguen existiendo.
- Errores: 400 `VALIDACION` por los mismos motivos que la agenda propia y además si `profesorId` falta o no es un entero positivo; 404 `NO_ENCONTRADO` si el profesor no existe (se decide antes que el rango); 403 para cualquier rol que no sea `MESA_ENTRADAS`.

### Agenda del centro (mesa de entradas)

**`GET /api/v1/agendas/centro?desde&hasta&profesorId?&materiaId?&aulaId?&estado?&prioridad?`** (rol `MESA_ENTRADAS`, sólo lectura; T-57, decisión T-68): las ocurrencias de **todos los profesores** en un rango, para el calendario semanal de la agenda del centro (HU-19).

- `desde` y `hasta` (`YYYY-MM-DD`, extremos incluidos) son **obligatorios**. El rango no puede superar los **31 días** ni estar invertido (400 `VALIDACION` sobre `hasta`).
- Filtros opcionales y combinables: `profesorId`, `materiaId`, `aulaId`, `estado` y `prioridad`. Un `profesorId` que no existe no es 404: devuelve un arreglo vacío.
- Devuelve un **arreglo sin paginar**, ordenado por fecha, hora de inicio, profesor (apellido y nombre) e id del turno. Ítem: el de "La ocurrencia de una agenda", con `profesor`. Incluye las canceladas.
- **Agrupar por clase (`fecha` + `bloqueAgendaId`) lo hace el cliente**: la API no devuelve clases.
- Errores: 400 `VALIDACION` si falta `desde` o `hasta`, si una fecha o un id es inválido, si `estado` o `prioridad` no son válidos, si `hasta` es anterior a `desde` o si el rango supera los 31 días; 403 para cualquier rol que no sea `MESA_ENTRADAS`.

## Ocurrencias

El detalle de un turno en una fecha, y los turnos de un alumno (T-43): la lectura desde la que se opera (cancelar, finalizar, reprogramar, registrar pago, T-44 en adelante). La API calcula qué acciones están permitidas en `acciones`; ninguna pantalla repite esas reglas.

> **Sin `pago`.** El ticket original pedía un campo `pago` (`PENDIENTE`/`PAGADO`, importe, forma de pago, comprobante) y que `acciones.cancelar` viniera deshabilitado con "El turno está pagado: no se puede cancelar" en una ocurrencia pagada. Decisión explícita de este incremento: **no hay hoy una fuente de datos de `Pago` de la que traerlo**, así que ninguno de los dos sale. `acciones.cancelar` es `{ visible, habilitada }` sin `motivo`, y depende únicamente de si la ocurrencia está `AGENDADO`; no mira el pago para nada. Se retoma cuando `pagos` (T-51) esté disponible.

### Detalle de una ocurrencia

**`GET /api/v1/ocurrencias/{turnoId}/{fecha}`** (roles `MESA_ENTRADAS` y `PROFESOR`): la ocurrencia `turnoId` + `fecha` (mismo identificador que en las agendas). `PROFESOR` sólo puede pedir un turno suyo: si no lo es, 403 con las cuatro acciones en `false`. Con `MESA_ENTRADAS` o con el profesor dueño del turno, el resto de la respuesta es igual — salvo `acciones`, que para `PROFESOR` siempre viene con las cuatro en `false` (el profesor no cancela, finaliza, reprograma ni registra pagos en este incremento; sólo lee).

```json
{
  "turnoId": 31,
  "fecha": "2026-09-28",
  "alumno": { "id": 12, "nombre": "Lucía", "apellido": "González", "dni": "40123456" },
  "materia": { "id": 3, "nombre": "Matemática" },
  "profesor": { "id": 3, "nombre": "Ana", "apellido": "Pérez" },
  "aula": { "id": 3, "nombre": "Aula 3" },
  "horaInicio": "09:00",
  "horaFin": "10:00",
  "tipo": "RECURRENTE",
  "serie": {
    "fechaInicio": "2026-03-02",
    "fechaFin": null,
    "finalizacion": null
  },
  "estado": "AGENDADO",
  "observaciones": null,
  "temas": null,
  "cancelacion": null,
  "prioridad": "ALTA",
  "examen": {
    "id": 8,
    "fecha": "2026-10-05",
    "tipo": "PARCIAL",
    "materiaNombre": "Matemática",
    "dias": 7
  },
  "acciones": {
    "cancelar": { "visible": true, "habilitada": true },
    "finalizar": { "visible": true },
    "reprogramar": { "visible": true },
    "registrarPago": { "visible": true }
  },
  "createdAt": "2026-08-01T13:00:00.000Z",
  "updatedAt": "2026-08-01T13:00:00.000Z",
  "createdBy": { "id": "usr_mesa_01", "nombre": "Ana", "apellido": "Pérez" },
  "updatedBy": { "id": "usr_mesa_01", "nombre": "Ana", "apellido": "Pérez" }
}
```

- `estado`: sólo `AGENDADO`, `CANCELADO` o `SIN_REGISTRAR` (definición F de las PO: cancelada, o pasada sin cancelar, o de hoy en adelante).
- `serie`: período del turno o tramo (`fechaInicio`, `fechaFin`, `null` sin fin) y, si tiene una, la `finalizacion` (`fechaDesde` es el fin efectivo, definición C, más `motivo`, `detalle`, `createdBy`, `createdAt`); `null` si no está finalizada. La finalización es **de la hora** (decisión T-104): la del propio turno o, si no tiene, la de otro tramo de su misma hora en su serie, así que un tramo anterior también la muestra. El `serieId` que agrupa los turnos de un alta no viaja en la respuesta. Sin sección de reprogramación: un turno reprogramado ya está en su fecha y bloque nuevos, y no muestra desde cuándo se movió (definición A).
- `cancelacion`: `null` salvo `estado = "CANCELADO"` (`motivo`, `detalle`, `createdBy`, `createdAt`).
- `prioridad` y `examen` (el examen que la determina, T-31): `null` en una ocurrencia cancelada.
- `acciones`: `cancelar` sólo mira si está `AGENDADO` (agendada, hoy o posterior); `finalizar`, si el turno es `RECURRENTE`, su hora está vigente (algún tramo de esa hora en su serie tiene `fechaFin` nula o de hoy en adelante) y **ningún tramo de esa hora tiene una finalización** (decisión T-104: si se ve, `POST /finalizaciones` no rechaza por "no vigente" ni por "ya finalizado"; la otra hora de la misma serie se evalúa aparte); `reprogramar`, igual que `cancelar`; `registrarPago`, si no está `CANCELADO`.
- `createdBy`/`updatedBy`: quién creó el turno y quién lo modificó por última vez. Si el turno se reprogramó, quien lo modificó es quien lo reprogramó (no hay un campo aparte).
- Errores: 400 `VALIDACION` (`turnoId` o `fecha` inválidos); 401 `NO_AUTENTICADO`; 403 `SIN_PERMISO` (rol distinto de `MESA_ENTRADAS`/`PROFESOR`, o un `PROFESOR` que no es dueño del turno) o `USUARIO_INHABILITADO`; 404 `NO_ENCONTRADO` si el turno no existe o esa fecha no es una de sus ocurrencias (incluida una posterior al fin efectivo de una serie ya finalizada).

### Turnos de un alumno

**`GET /api/v1/ocurrencias?alumnoId&desde?&hasta?`** (rol `MESA_ENTRADAS`): las ocurrencias del alumno en `[desde, hasta]`, para la pestaña "Turnos" de su ficha (HU-02). Incluye las canceladas (a diferencia de las agendas): se siguen viendo con su estado.

- `alumnoId` (obligatorio). `desde`/`hasta` (`YYYY-MM-DD`, opcionales, extremos incluidos): sin `desde`, 30 días atrás de hoy; sin `hasta`, 8 semanas (56 días) adelante. El rango pedido no puede exceder esa misma ventana (30 atrás / 56 adelante de hoy), ni venir invertido.
- Devuelve un **arreglo sin paginar**, ordenado por fecha y hora.

  ```json
  [
    {
      "turnoId": 31,
      "fecha": "2026-09-28",
      "diaSemana": 1,
      "horaInicio": "09:00",
      "horaFin": "10:00",
      "profesor": { "id": 3, "nombre": "Ana", "apellido": "Pérez" },
      "materia": { "id": 3, "nombre": "Matemática" },
      "tipo": "RECURRENTE",
      "estado": "AGENDADO",
      "prioridad": "ALTA",
      "cancelable": true
    }
  ]
  ```

- `prioridad`: `null` en una ocurrencia cancelada. `cancelable`: mismas reglas que `acciones.cancelar` del detalle.
- Errores: 400 `VALIDACION` (`alumnoId` faltante o inválido, `hasta` anterior a `desde`, o rango fuera de la ventana permitida, `details` sobre `hasta`); 401 `NO_AUTENTICADO`; 403 para cualquier rol que no sea `MESA_ENTRADAS`.

Todo sale de `leerOcurrencias` (T-30) y `leerPrioridades` (T-31): la feature no reimplementa ninguna de las dos.

## Cancelaciones

HU-13 (T-45). Cancelar una o varias ocurrencias de un alumno. Reglas en `dominio.md` → Cancelación.

| Endpoint                     | Roles           | Qué hace                                                                                       |
| ---------------------------- | --------------- | ---------------------------------------------------------------------------------------------- |
| `POST /api/v1/cancelaciones` | `MESA_ENTRADAS` | Cancela las ocurrencias, todo o nada. 201 con `{ cantidad }`; 400; 409 `TURNOS_NO_CANCELABLES` |

Cualquier otro rol recibe 403 `SIN_PERMISO`.

**Body de `POST /cancelaciones`:**

```json
{
  "ocurrencias": [
    { "turnoId": 41, "fecha": "2026-10-12" },
    { "turnoId": 57, "fecha": "2026-10-14" }
  ],
  "motivo": "CANCELACION_ALUMNO",
  "detalle": "El alumno viaja esa semana"
}
```

- `ocurrencias`: de 1 a 200 pares `(turnoId, fecha)` sin repetir (un repetido: 400 en `["ocurrencias", <posición>]`). El alumno no viaja: sale de las ocurrencias, que tienen que ser todas del mismo alumno (si no, 400 `VALIDACION` con un detalle en `["ocurrencias", <posición>]` por cada una ajena).
- `motivo`: `CANCELACION_ALUMNO`, `CANCELACION_PROFESOR`, `PROBLEMA_ADMINISTRATIVO` u `OTRO`.
- `detalle`: opcional, hasta 500 caracteres; `""`, espacios o `null` = sin detalle. **Obligatorio si `motivo = OTRO`**: 400 `VALIDACION` en `["detalle"]`.

**Respuesta 201:** `{ "cantidad": 2 }` (una `CancelacionTurno` por ocurrencia, con `fechaOcurrencia` = la fecha de la ocurrencia, también para una sesión única).

**Todo o nada.** Se cancela sólo si **todas** son cancelables; si alguna no, 409 `TURNOS_NO_CANCELABLES` (forma de `details` en Errores) con **todas** las que fallan y no se cancela ninguna. Cada una lleva un solo `motivo`, el primero que se cumple:

| `motivo`       | Mensaje                                    | Cuándo                                                           |
| -------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| `NO_EXISTE`    | El turno no existe en esa fecha            | El turno no genera esa fecha (o no existe)                       |
| `YA_CANCELADO` | El turno ya está cancelado                 | Ya tiene su cancelación                                          |
| `PAGADO`       | El turno está pagado: no se puede cancelar | Tiene un pago (en este sprint no se anulan pagos). Suma `pagoId` |
| `PASADO`       | El turno ya pasó: no se puede cancelar     | Su fecha es anterior a hoy                                       |

Una cancelación sólo afecta a esa fecha: el resto de la serie sigue agendado y la hora vuelve a tener lugar ese día.

## Finalizaciones

HU-14 (T-47). Finalizar un turno recurrente desde una fecha. **Actúa por hora** (decisión T-104): finaliza la hora del turno pedido en todos los tramos de su serie; las otras horas de la serie se informan y no se tocan. Reglas en `dominio.md` → Finalización.

| Endpoint                            | Roles           | Qué hace                                                                                                           |
| ----------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/finalizaciones/previa` | `MESA_ENTRADAS` | Qué se libera si se finaliza desde esa fecha, los turnos pagados que lo impiden y las otras horas de la serie. 200 |
| `POST /api/v1/finalizaciones`       | `MESA_ENTRADAS` | Finaliza el turno desde esa fecha. 201 con `{ turnoId, cantidad, desde, hasta }`; 400; 404; 409 (`TURNOS_PAGADOS`) |

Cualquier otro rol recibe 403 `SIN_PERMISO`.

**Query de `GET /finalizaciones/previa`:** `turnoId` (entero mayor a 0) y `fechaDesde` (`YYYY-MM-DD`), los dos obligatorios.

**Body de `POST /finalizaciones`:**

```json
{
  "turnoId": 41,
  "fechaDesde": "2026-10-19",
  "motivo": "CANCELACION_ALUMNO",
  "detalle": "El alumno deja de venir"
}
```

- `turnoId`: el turno `RECURRENTE` desde cuyo detalle se opera (cualquier tramo). Se finaliza **su hora**: los turnos `RECURRENTE` `ACTIVO` de su serie con su misma hora (`bloqueAgendaId`), en todos sus tramos. Si el turno no tiene serie (anterior a la decisión T-103), sólo él.
- `fechaDesde`: la primera fecha que se libera. De hoy en adelante, en el día de la semana de la serie, **posterior** al primer inicio de esa hora y no posterior a su último fin (si todos sus tramos tienen fin). Una fecha que cae en un hueco entre dos tramos es válida.
- `motivo` y `detalle`: las mismas reglas que en Cancelaciones (`detalle` opcional, hasta 500 caracteres; `""`, espacios o `null` = sin detalle; **obligatorio si `motivo = OTRO`**: 400 en `["detalle"]`).

**Respuesta 200 de la previa:**

```json
{
  "cantidad": 7,
  "desde": "2026-10-19",
  "hasta": "2026-11-30",
  "pagadas": [],
  "ultimaFechaPagada": null,
  "fechaDesdeMinima": null,
  "otrasHoras": [
    { "turnoId": 42, "fecha": "2026-10-19", "horaInicio": "10:00", "horaFin": "11:00" }
  ]
}
```

- `cantidad`: turnos **no cancelados** que se liberan, de `desde` a `hasta`, **contando todos los tramos de la hora** (los cancelados ya están libres). `null` si algún tramo no tiene fin.
- `desde`: igual a `fechaDesde`. `hasta`: la última ocurrencia de la hora (no la `fechaFin` guardada, si no cae en una fecha de la serie); `null` si algún tramo no tiene fin. Con `hasta` el mensaje es "Se liberan 7 turnos, del 19/10 al 30/11"; con `null`, "Se liberan todos los turnos desde el 19/10".
- `pagadas`: `[{ fecha, horaInicio, horaFin, importe }]`, los turnos pagados desde `fechaDesde` en cualquier tramo de la hora, por fecha (`importe` = lo cobrado). **Si hay alguno, no se puede finalizar desde esa fecha.**
- `ultimaFechaPagada`: la fecha del último pagado; `null` si no hay pagados.
- `fechaDesdeMinima`: la primera `fechaDesde` que se puede elegir (la ocurrencia siguiente a la última pagada). `null` si no hay pagados, o si los pagados llegan hasta el final de la serie: en ese caso (`ultimaFechaPagada` con valor y `fechaDesdeMinima` `null`) el turno no se puede finalizar.
- `otrasHoras`: `[{ turnoId, fecha, horaInicio, horaFin }]`, las **otras horas de la misma serie** (las que se registraron en el mismo alta) que no están finalizadas y tienen alguna ocurrencia desde `fechaDesde`, por hora. No se finalizan con este pedido: cada una, desde su propio detalle. `turnoId` + `fecha` es la primera ocurrencia de esa hora desde `fechaDesde` (el identificador de su detalle: `GET /ocurrencias/{turnoId}/{fecha}`); si la hora tiene varios tramos, la del tramo que la tiene. Una hora que termina antes de `fechaDesde` no viene. Reemplaza a `otrosTramos`: los tramos de la hora ya se finalizan juntos.

**Respuesta 201 del POST:** `{ "turnoId": 41, "cantidad": 7, "desde": "2026-10-19", "hasta": "2026-11-30" }`, con el mismo significado de `cantidad`, `desde` y `hasta` que en la previa; `turnoId` es el turno pedido. Se registra una `FinalizacionRecurrencia` con la misma `fechaDesde` en cada tramo de la hora que tiene fechas desde ahí.

**Errores**, en orden (el primero que se cumple gana), evaluados sobre **los tramos de la hora** del turno pedido. La previa aplica los mismos, salvo el último: los pagados van en la respuesta y no son un error.

| Status | Código           | Mensaje                                                                                                 | Cuándo                                                                               |
| ------ | ---------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 400    | `VALIDACION`     | (el de cada campo)                                                                                      | Formato del query o del body; `detalle` obligatorio con `OTRO`                       |
| 404    | `NO_ENCONTRADO`  | "Turno no encontrado"                                                                                   | El turno no existe                                                                   |
| 409    | `CONFLICTO`      | "Sólo se puede finalizar un turno recurrente"                                                           | Es una sesión única                                                                  |
| 409    | `CONFLICTO`      | "El turno ya no está vigente: no se puede finalizar"                                                    | No está `ACTIVO`, o ningún tramo de la hora llega a hoy (`fechaFin` anterior a hoy)  |
| 409    | `CONFLICTO`      | "El turno ya fue finalizado"                                                                            | Algún tramo de la hora ya tiene una finalización (o entró otra al mismo tiempo)      |
| 400    | `VALIDACION`     | "La fecha no puede ser anterior a hoy"                                                                  | `fechaDesde` anterior a hoy. `details` en `["fechaDesde"]`, como los tres que siguen |
| 400    | `VALIDACION`     | "La fecha debe caer en lunes" (el día de la serie)                                                      | `fechaDesde` en otro día de la semana                                                |
| 400    | `VALIDACION`     | "Elegí una fecha posterior al inicio del turno (05/10). Para liberar sólo esa fecha, cancelá el turno." | `fechaDesde` no es posterior al primer inicio de la hora                             |
| 400    | `VALIDACION`     | "La fecha es posterior al fin del turno (30/11)"                                                        | `fechaDesde` posterior al último fin de la hora                                      |
| 409    | `TURNOS_PAGADOS` | "Hay turnos pagados desde esa fecha: elegí una fecha posterior al último turno pagado (16/11)"          | Hay pagados desde `fechaDesde` y queda alguna fecha posterior (`fechaDesdeMinima`)   |
| 409    | `TURNOS_PAGADOS` | "Los turnos pagados llegan hasta el final de la serie (30/11): no se puede finalizar"                   | Hay pagados hasta la última fecha de la serie (`fechaDesdeMinima: null`)             |

La fecha entre paréntesis va en formato `DD/MM`. La forma de `details` de `TURNOS_PAGADOS` está en Errores.

Finalizar **no modifica** `fechaFin` de ningún turno: `GET /turnos/{id}` y el detalle de la ocurrencia la siguen mostrando, junto con la finalización. Desde `fechaDesde` esa hora deja de aparecer en las agendas, en los turnos del alumno y en la ocupación; las otras horas de la serie siguen como estaban.

## Reprogramaciones

HU-20 (T-49). Mover una ocurrencia a otra fecha, hora o profesor. Reglas en `dominio.md` → Reprogramación. No hay tabla de reprogramaciones (decisión T-47): la API **edita el turno** y el cliente no manda ni recibe nada sobre cómo se parte la serie. La búsqueda de horarios reutiliza `GET /turnos/disponibilidad` con `fecha`: no hay endpoint nuevo.

| Endpoint                        | Roles           | Qué hace                                                                             |
| ------------------------------- | --------------- | ------------------------------------------------------------------------------------ |
| `POST /api/v1/reprogramaciones` | `MESA_ENTRADAS` | Reprograma una ocurrencia, todo o nada. 200 con `{ turnoId, cambio }`; 400; 404; 409 |

Cualquier otro rol recibe 403 `SIN_PERMISO`.

**Body:**

```json
{
  "turnoId": 41,
  "fecha": "2026-10-12",
  "bloqueAgendaDestinoId": 18,
  "fechaDestino": "2026-10-15"
}
```

- `turnoId` + `fecha`: la ocurrencia que se mueve (definición B). `fecha` es la de la ocurrencia, no la del turno.
- `bloqueAgendaDestinoId`: la hora (fila del horario) de destino; `fechaDestino`: hoy o posterior y en el día de la semana de esa hora.

**Respuesta 200:**

```json
{
  "turnoId": 58,
  "cambio": "Del lunes 12/10 9:00–10:00 con Prof. Gómez al jueves 15/10 17:00–18:00 con Prof. Ruiz"
}
```

- `turnoId`: el turno de la fecha movida. Es el mismo `turnoId` si el turno era una sesión única (o la única fecha de un recurrente); si era una fecha de un recurrente, es la `SESION_UNICA` nueva. El cliente vuelve a pedir el detalle con ese id y `fechaDestino`.
- `cambio`: el texto para el mensaje de confirmación, armado por la API.

**Errores:**

| Status | Cuándo                                                                                                                                                                                               |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | Formato inválido; `fechaDestino` anterior a hoy o que no cae en el día de la hora de destino (`details` en `["fechaDestino"]`); mismo lugar que el de origen (misma hora y misma fecha)              |
| 404    | El turno no existe, el turno no tiene una ocurrencia en `fecha`, o la hora de destino no existe o está dada de baja                                                                                  |
| 409    | La ocurrencia está cancelada o ya pasó; `PROFESOR_INACTIVO`, `MATERIA_INACTIVA` o `MATERIA_NO_ASIGNADA` en el destino; `BLOQUE_LLENO`; `ALUMNO_SUPERPUESTO` (mismos códigos y `details` que el alta) |

`BLOQUE_LLENO` y `ALUMNO_SUPERPUESTO` **no cuentan la ocurrencia que se mueve**: mover una fecha a otro profesor a la misma hora no choca con sí misma.

**Efecto sobre los turnos (lo ve el cliente al releer):** una ocurrencia pagada se puede reprogramar y conserva su pago; en un recurrente, el resto de la serie queda igual en las agendas. Cada turno creado o modificado lleva como creador o modificador a quien reprogramó (`updatedBy` / `updatedAt` en el detalle).

## Pagos

HU-15 (T-51). Registrar el pago de una o varias ocurrencias de un alumno y leer su comprobante. Reglas en `dominio.md` → Pagos. **Los importes, el total y el vuelto los calcula la API**; el cliente sólo los muestra (con formato de pesos) y nunca los recalcula.

| Endpoint                 | Roles           | Qué hace                                                                                            |
| ------------------------ | --------------- | --------------------------------------------------------------------------------------------------- |
| `POST /api/v1/pagos`     | `MESA_ENTRADAS` | Registra el pago en efectivo, todo o nada. 201 con el resumen; 400; 404 si el alumno no existe; 409 |
| `GET /api/v1/pagos/{id}` | `MESA_ENTRADAS` | Datos del comprobante. 404 si el pago no existe                                                     |

Cualquier otro rol recibe 403 `SIN_PERMISO`.

**Body de `POST /pagos`:**

```json
{
  "alumnoId": 12,
  "ocurrencias": [
    { "turnoId": 41, "fecha": "2026-10-05" },
    { "turnoId": 57, "fecha": "2026-10-07" }
  ],
  "fechaPago": "2026-10-05",
  "montoRecibido": 20000,
  "observaciones": "Paga el mes de octubre"
}
```

- `ocurrencias`: de 1 a 200 pares `(turnoId, fecha)` sin repetir (un repetido: 400 en `["ocurrencias", <posición>]`). Todas del alumno.
- `fechaPago`: `YYYY-MM-DD`, obligatoria, hoy o anterior (400 en `["fechaPago"]`).
- `montoRecibido`: opcional (`null` u omitido = no se informó). Número JSON mayor a 0, con hasta dos decimales y hasta `99999999.99`; si viene, >= el total: si es menor, 400 `VALIDACION` en `["montoRecibido"]` con el total en el mensaje ("El monto recibido ($ 30.000) es menor al total ($ 32.000)").
- `observaciones`: opcional, hasta 500 caracteres; `""` o `null` = sin observaciones.
- La forma de pago no viaja: es "Efectivo" (única en este sprint).

**Respuesta 201:**

```json
{
  "pagoId": 31,
  "numeroComprobante": 1024,
  "cantidad": 2,
  "total": 17000,
  "montoRecibido": 20000,
  "vuelto": 3000
}
```

`montoRecibido` y `vuelto` son `null` si no se informó el monto. Con esto la UI arma "Pago registrado: 2 turnos por $ 17.000" y "Vuelto: $ 3.000". El vuelto no se guarda.

**Errores del `POST`**, en este orden (el primero que falla gana):

1. Body inválido → 400 `VALIDACION`.
2. `fechaPago` posterior a hoy → 400 en `["fechaPago"]`.
3. Alumno inexistente → 404 (su estado no importa).
4. Alguna ocurrencia es de otro alumno → 400 `VALIDACION`, `details`: `[{ "path": ["ocurrencias", <posición>], "message": "El turno no es del alumno", "turnoId", "fecha" }]`.
5. Alguna no se puede cobrar → 409 `TURNOS_NO_COBRABLES` con **todas** las que fallan (forma de `details` en Errores). Cada una lleva un solo `motivo`, el primero que se cumple en este orden:

   | `motivo`         | Cuándo                                                                                        | `message`                                                |
   | ---------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
   | `NO_EXISTE`      | El turno no existe, es un cancelado anterior al Sprint 2 o la fecha no es una ocurrencia suya | "El turno no existe en esa fecha"                        |
   | `CANCELADO`      | La ocurrencia está cancelada                                                                  | "El turno está cancelado"                                |
   | `YA_PAGADO`      | Ya tiene un pago (el detalle trae su `pagoId`)                                                | "El turno ya está pagado"                                |
   | `FUERA_DE_RANGO` | Su fecha es posterior a hoy + 56 días                                                         | "Sólo se pueden cobrar turnos de las próximas 8 semanas" |
   | `SIN_PRECIO`     | Su materia no tiene precio cargado                                                            | "La materia no tiene precio cargado"                     |

6. Total mayor a `99999999.99` → 400 en `["ocurrencias"]`; `montoRecibido` menor al total → 400 en `["montoRecibido"]`.

**Respuesta de `GET /pagos/{id}`:**

```json
{
  "id": 31,
  "numeroComprobante": 1024,
  "fechaPago": "2026-10-05",
  "alumno": { "id": 12, "nombre": "Lucía", "apellido": "Álvarez", "dni": "52345678" },
  "turnos": [
    {
      "turnoId": 41,
      "fecha": "2026-10-05",
      "horaInicio": "09:00",
      "horaFin": "10:00",
      "materia": { "id": 2, "nombre": "Matemática" },
      "profesor": { "id": 3, "nombre": "Ana", "apellido": "Gómez" },
      "importe": 8000
    }
  ],
  "total": 17000,
  "montoRecibido": 20000,
  "vuelto": 3000,
  "formaPago": { "id": 1, "nombre": "Efectivo" },
  "observaciones": null,
  "registradoPor": { "id": "usr_mesa_01", "nombre": "Laura", "apellido": "Gómez" },
  "registradoEl": "2026-10-05T14:30:00.000Z"
}
```

- `turnos`: ordenados por fecha, hora de inicio y `turnoId`, con los datos **actuales** de su turno (una ocurrencia pagada que se reprogramó muestra su fecha, hora y profesor nuevos) e `importe` = lo que se cobró (no cambia si después cambia el precio de la materia).
- `vuelto`: recalculado en cada lectura (`montoRecibido - total`); `null` sin monto recibido.
- `registradoPor` es un `UsuarioAuditoria`; `registradoEl`, un instante ISO 8601 en UTC.
- `numeroComprobante` es correlativo y único, pero puede tener huecos (decisión T-62).

## Cuentas

A completar por T-53.

## Exámenes

Carga de exámenes de un alumno (HU-17, T-55), de la que depende la prioridad de los turnos (HU-18, `examenes.condiciones.ts`, T-31). Roles: `MESA_ENTRADAS` y `PROFESOR` en los cinco endpoints. "Eliminar" un examen es darlo de baja (`PATCH /{id}/baja`): nada se borra.

**`GET /api/v1/examenes?alumnoId`**: exámenes `ACTIVO` del alumno, separados en `proximos` (fecha de hoy en adelante, orden ascendente, con `diasRestantes`) y `pasados` (sin `diasRestantes`). Cada uno trae su materia y la auditoría **con el rol** (`MESA_ENTRADAS` o `PROFESOR`) de quien lo cargó y de quien lo modificó por última vez.

```json
{
  "proximos": [
    {
      "id": 5,
      "materia": { "id": 3, "nombre": "Matemática" },
      "fecha": "2026-10-15",
      "tipo": "PARCIAL",
      "observaciones": "Trae calculadora y formulario",
      "pasado": false,
      "diasRestantes": 10,
      "createdAt": "2026-09-22T13:45:00.000Z",
      "updatedAt": "2026-09-22T13:45:00.000Z",
      "createdBy": {
        "id": "usr_prof_01",
        "nombre": "Luis",
        "apellido": "Gómez",
        "role": "PROFESOR"
      },
      "updatedBy": {
        "id": "usr_prof_01",
        "nombre": "Luis",
        "apellido": "Gómez",
        "role": "PROFESOR"
      }
    }
  ],
  "pasados": []
}
```

**`GET /api/v1/examenes/materias?alumnoId`**: materias ofrecibles para cargarle un examen a ese alumno. Mesa de entradas: activas del catálogo. Profesor: sólo las que le dicta a ese alumno (`materiasDelProfesorConAlumno`, T-29/T-30); sin turnos activos con ese profesor, la lista viene vacía.

**`POST /api/v1/examenes`**: `{ alumnoId, materiaId, fecha, tipo, observaciones? }`. `tipo` es uno de `PARCIAL`, `FINAL`, `RECUPERATORIO`, `TRABAJO_PRACTICO` u `OTRO`; `observaciones`, hasta 500 caracteres. Devuelve el detalle (`201`), con `pasado: true` si `fecha` ya pasó (se acepta igual, es sólo un aviso del front).

**`PATCH /api/v1/examenes/{id}`**: edición parcial de `materiaId`, `fecha`, `tipo` y `observaciones` (sin `alumnoId`: un examen no cambia de alumno). Si cambia `materiaId` o `fecha`, se vuelve a chequear el examen pendiente de la materia resultante, sin contar este examen.

**`PATCH /api/v1/examenes/{id}/baja`**: baja lógica ("eliminar" en la HU, con confirmación del front). Sin body.

- Reglas del alta y la edición:
  - Materia inexistente → 404; inactiva → 409 `MATERIA_INACTIVA`.
  - **Un examen pendiente por materia:** si el alumno ya tiene un examen `ACTIVO` con fecha `>= hoy` en la misma materia → 409 `EXAMEN_PENDIENTE`, con el existente (`{ id, tipo, fecha }`, sin arreglo) en `details`, para ofrecer editarlo. Un examen pasado no cuenta: después de la fecha, se puede cargar el siguiente.
  - **Profesor:** sólo puede cargar, editar o dar de baja un examen de una materia que le dicta a ese alumno; si no, 403 `SIN_PERMISO`.
- Errores comunes a los cinco endpoints: 401 `NO_AUTENTICADO`; 403 `SIN_PERMISO` para cualquier rol que no sea `MESA_ENTRADAS` o `PROFESOR`, o un usuario inhabilitado.

## Tablero

A completar por T-61 (opcional).

## Centro

Los datos del centro para el encabezado de los documentos oficiales (turno, agenda, comprobante — HU-11, HU-15, T-60). Son constantes del backend, sin tabla: no hay pantalla para editarlos (definición G de las PO). Roles: `MESA_ENTRADAS`, `PROFESOR` y `GERENTE`.

**`GET /api/v1/centro`**: `{ "nombre", "direccion", "telefono" }`, los tres `string`.

```json
{
  "nombre": "Aula Click",
  "direccion": "Los Tarcos 300, Tres Cerritos",
  "telefono": "3875631032"
}
```

- Errores: 401 `NO_AUTENTICADO`; 403 `SIN_PERMISO` para cualquier rol que no sea uno de los tres.

**`GET /api/v1/centro/logo`**: la imagen del logo (`image/svg+xml`), con `Cache-Control` largo (`public, max-age=604800`): no hay pantalla para reemplazarlo, así que no hace falta revalidar seguido. Se lee de un archivo de la propia feature (`src/server/features/centro/assets/logo.svg`), no de `public/` (la imagen va detrás de la sesión, como el resto de la API) ni de `src/config`.

- Errores: los mismos 401/403 que el endpoint anterior.

## Filtros

Nombres fijos de query (un filtro nuevo se agrega a esta lista):

| Query                                | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`                                  | Búsqueda por palabras: cada palabra coincide en forma parcial y todas deben coincidir (`juan gonz` encuentra a "González, Juan"). No distingue mayúsculas ni tildes (`gonzalez` encuentra a "González") e ignora los puntos (`30.123` encuentra el DNI `30123456`). Hasta 100 caracteres; se usan las primeras 5 palabras. En la agenda (decisión T-36) busca por nombre de alumno **o** de profesor, nunca mezclando palabras entre los dos; si además se manda `profesorId`, busca sólo por alumno (T-42) |
| `estado`                             | `ACTIVO`, `INACTIVO` o `TODOS` (no filtra). Solo en entidades con baja lógica (profesores y materias); por defecto `ACTIVO`                                                                                                                                                                                                                                                                                                                                                                                 |
| `materiaId`                          | Filtra por materia                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `profesorId`                         | Filtra por profesor. En la agenda (decisión T-42) es la vista personal de su agenda ese día                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `aulaId`                             | Filtra por aula                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `fecha`                              | Fecha `YYYY-MM-DD`. En la agenda diaria (`/agendas/diaria`) y sus selectores, el día a consultar (sin fecha, el de hoy, zona del negocio). En la disponibilidad de turnos, la fecha de la ocupación: hoy o posterior, y el día de la semana sale de ella (sin fecha, la próxima ocurrencia de cada día)                                                                                                                                                                                                     |
| `diaSemana`, `horaInicio`, `horaFin` | Un horario semanal: día ISO (1 a 7) y rango de horas `HH:mm` en punto, con el fin posterior al inicio (aulas disponibles)                                                                                                                                                                                                                                                                                                                                                                                   |
| `desde`, `hasta`                     | Rango de fechas `YYYY-MM-DD`, extremos incluidos (`/agendas/propia` y `/agendas/profesor`; en `/agendas/centro` son obligatorios). Sin `desde`, hoy; sin `hasta`, el mismo día que `desde`. `hasta` no puede ser anterior a `desde` ni dejar un rango de más de 31 días                                                                                                                                                                                                                                     |
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
| 409    | `MATERIA_SIN_PRECIO`     | "La materia no tiene precio: cárguelo antes de reactivarla", al reactivar una materia sin precio (`PATCH /materias/{id}/reactivacion`): primero hay que cargarle el precio con `PATCH /materias/{id}`. Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 409    | `PROFESOR_SIN_MATERIAS`  | "El profesor no tiene materias asignadas: no se le puede cargar un bloque". Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 409    | `BLOQUE_SUPERPUESTO`     | `details`: una entrada por cada hora en conflicto, `[{ "diaSemana", "horaInicio", "horaFin", "bloqueExistenteId" }]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 409    | `AULA_OCUPADA`           | "No hay un aula disponible en ese horario. Por favor, elija otro horario." `details`: una entrada por cada hora en conflicto, `[{ "diaSemana", "horaInicio", "horaFin", "profesorId" }]` (quién ocupa el aula a esa hora)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 409    | `CAPACIDAD_INSUFICIENTE` | "La capacidad no puede ser menor que la cantidad de turnos que el profesor ya tiene a la vez en una hora", al editar la capacidad de un profesor (T-15). `details`: una entrada por hora en conflicto, sobre el campo: `[{ "path": ["capacidad"], "message", "bloqueId", "diaSemana", "horaInicio", "horaFin", "fecha", "cantidad" }]`, con la fecha en que esa hora tiene más turnos a la vez desde hoy y cuántos                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 409    | `ALUMNO_SUPERPUESTO`     | "El alumno ya tiene un turno en ese horario". Rechazo total (ninguna bandera lo saltea). `details`: un ítem por turno en conflicto (de cualquier profesor), `[{ "turnoId", "tipo", "fechaInicio", "fechaFin", "diaSemana", "horaInicio", "horaFin", "profesor": { "id", "nombre", "apellido" }, "materia": { "id", "nombre" } }]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 409    | `MATERIA_NO_ASIGNADA`    | "La materia no está asignada al profesor" (o su asignación está dada de baja), al registrar un turno. `details`: `[{ "path": ["materiaId"], "message" }]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 409    | `TURNOS_NO_COBRABLES`    | Registrar un pago, si alguna ocurrencia no se puede cobrar (no se registra ninguna): "Algunos turnos no se pueden cobrar". `details`: una entrada por cada ocurrencia que falla, `[{ "path": ["ocurrencias", <posición>], "message", "turnoId", "fecha", "motivo", "pagoId"? }]` (`pagoId` sólo con `YA_PAGADO`); motivos: ver Pagos. Si otro pago la registró al mismo tiempo (última red de la base), "Alguno de los turnos ya fue pagado" sin `details`                                                                                                                                                                                                                                                                                                                                                                                      |
| 409    | `TURNOS_NO_CANCELABLES`  | Cancelar turnos, si alguna ocurrencia no se puede cancelar (no se cancela ninguna): "Algunos turnos no se pueden cancelar". `details`: una entrada por cada ocurrencia que falla, `[{ "path": ["ocurrencias", <posición>], "message", "turnoId", "fecha", "motivo", "pagoId"? }]` (`pagoId` sólo con `PAGADO`); motivos: ver Cancelaciones. Si otra cancelación la registró al mismo tiempo (última red de la base), "Alguno de los turnos ya fue cancelado" sin `details`                                                                                                                                                                                                                                                                                                                                                                      |
| 409    | `TURNOS_PAGADOS`         | Finalizar un turno recurrente, si hay turnos pagados desde `fechaDesde` (no se finaliza): "Hay turnos pagados desde esa fecha: elegí una fecha posterior al último turno pagado (DD/MM)" o, si llegan hasta el final de la serie, "Los turnos pagados llegan hasta el final de la serie (DD/MM): no se puede finalizar". `details` es un **objeto**: `{ "ultimaFechaPagada", "fechaDesdeMinima", "pagadas": [{ "fecha", "horaInicio", "horaFin", "importe" }] }`; `fechaDesdeMinima` es la primera fecha que se puede elegir, o `null` si no queda ninguna; `pagadas` tiene la misma forma que en la previa (ver Finalizaciones)                                                                                                                                                                                                                |

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
