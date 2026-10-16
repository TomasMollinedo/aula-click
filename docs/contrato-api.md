# Contrato de la API — Aula Click

Lo que el frontend y el backend acuerdan. Es el único documento que los dos lados necesitan leer para hablarse. El detalle de cada endpoint (paths, campos, status codes) está en el OpenAPI: Swagger UI en `/api/v1/docs` y JSON en `/api/v1/openapi.json`.

Si algo de este archivo cambia, se avisa al otro lado y se actualiza acá en el mismo PR (`AGENTS.md`, regla 9).

## URLs

| Prefijo         | Qué es                              | Quién lo llama desde el frontend                                                                                     |
| --------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/...`   | API de negocio (Hono + OpenAPI)     | Solo `fetchJson`, desde `src/features/<entidad>/api/` (salvo los documentos PDF, que se enlazan: ver Documentos PDF) |
| `/api/auth/...` | Better Auth: login, logout y sesión | Solo el `authClient` de `src/features/auth/`                                                                         |

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

Query: `page` (entero >= 1, default 1) y `pageSize` (entero de 1 a 100, default 10).

Respuesta:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 10, "total": 57, "totalPages": 3 }
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

| Ruta                                                                                 | Devuelve                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/aulas/disponibles?diaSemana&horaInicio&horaFin&excluirBloqueId?`        | Aulas activas libres **durante todo** el horario pedido ese día (ninguna de sus horas ocupada por un bloque activo de cualquier profesor): `[{ "id", "nombre", "capacidad" }]`, ordenadas por nombre. Mismo formato que el alta de bloques: `diaSemana` 1–7, horas `HH:mm` en punto y `horaFin` posterior a `horaInicio`. `excluirBloqueId` (opcional) es para la edición: esa fila no ocupa su aula |
| `GET /api/v1/agendas/materias?fecha?` y `GET /api/v1/agendas/aulas?fecha?`           | Materias y aulas con turno en una fecha, para los filtros de la agenda. Ver Agendas                                                                                                                                                                                                                                                                                                                  |
| `GET /api/v1/pagos/alumnos?q?&id?` y `GET /api/v1/pagos/profesores?q?&id?&alumnoId?` | Alumnos con algún pago y profesores con algún turno pagado, para los filtros de los pagos realizados: `[{ "id", "nombre", "apellido" }]`, hasta 20, por apellido y nombre. **Incluyen lo dado de baja** (un pago de un profesor que ya no está se sigue filtrando). Con `alumnoId`, los profesores se acotan a los pagos de ese alumno. Ver Pagos → Buscadores de los filtros                        |
| `GET /api/v1/pagos/materias?q?&id?&alumnoId?`                                        | Materias de algún turno pagado (de ese alumno, con `alumnoId`), para el filtro de materia de los pagos realizados: `[{ "id", "nombre" }]`, hasta 20, por nombre, **incluidas las dadas de baja**. Ver Pagos → Buscadores de los filtros                                                                                                                                                              |

| `GET /api/v1/turnos/disponibilidad?materiaId&diaSemana?&profesorId?&fecha?` | Horas donde buscar un turno de esa materia: las filas activas de los profesores **activos** que la dictan (asignación activa), agrupadas como bloques (mismo profesor, día y aula, horas contiguas; dos tramos del mismo día son dos resultados), cada hora con su capacidad efectiva y su ocupación en `fecha`. Las horas llenas vienen igual, con `lleno: true`. Ver Turnos |

Ejemplo: `GET /api/v1/aulas/disponibles?diaSemana=1&horaInicio=14:00&horaFin=16:00&excluirBloqueId=10` → `[{ "id": 1, "nombre": "Aula 1", "capacidad": 8 }, { "id": 3, "nombre": "Aula 3", "capacidad": 10 }]`.

## Alumnos

Rol `MESA_ENTRADAS`, salvo lo que diga cada fila. Reglas en `dominio.md` → Alumnos y Portal del alumno.

| Ruta                                                        | Rol                         | Qué hace                                                                                                 |
| ----------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/alumnos?page&pageSize&q`                       | `MESA_ENTRADAS`             | Listado paginado por apellido y nombre. Cada ítem: `id`, `apellido`, `nombre`, `dni` y `fotoUrl` (HU-26) |
| `GET /api/v1/alumnos/mis-alumnos?page&pageSize&q&materiaId` | `PROFESOR`                  | Alumnos con turno vigente con el profesor de la sesión; lo mismo más `materias`                          |
| `GET /api/v1/alumnos/usuario-sugerido?nombre&apellido&dni`  | `MESA_ENTRADAS`             | `{ "usuario" }`: el usuario del portal que se le asignaría (HU-27). Es una sugerencia                    |
| `GET /api/v1/alumnos/mi-perfil`                             | `ALUMNO`                    | Perfil del alumno de la sesión para el menú del portal (HU-28)                                           |
| `GET /api/v1/alumnos/{id}`                                  | `MESA_ENTRADAS`, `PROFESOR` | Detalle: todos sus datos, `menorDeEdad`, `fotoUrl`, `acceso` y la auditoría                              |
| `POST /api/v1/alumnos`                                      | `MESA_ENTRADAS`             | Alta del alumno **y de su acceso al portal**, todo o nada (HU-27)                                        |
| `PATCH /api/v1/alumnos/{id}`                                | `MESA_ENTRADAS`             | Edición parcial. El DNI no se puede modificar; el usuario del portal tampoco cambia                      |
| `POST /api/v1/alumnos/{id}/foto`                            | `MESA_ENTRADAS`             | Sube o reemplaza la foto (multipart, campo `foto`, JPG o PNG hasta 5 MB)                                 |
| `DELETE /api/v1/alumnos/{id}/foto`                          | `MESA_ENTRADAS`             | Quita la foto. Sin foto no es un error                                                                   |
| `POST /api/v1/alumnos/{id}/acceso`                          | `MESA_ENTRADAS`             | Crea el acceso de un alumno anterior a este incremento. 409 si ya lo tiene                               |
| `POST /api/v1/alumnos/{id}/acceso/restablecimiento`         | `MESA_ENTRADAS`             | La contraseña vuelve a ser el DNI. 409 si el alumno no tiene acceso                                      |

### Foto (HU-26)

- Se sube con **multipart**, en un único campo `foto`: JPG o PNG de hasta 5 MB, con las mismas reglas y mensajes que la del profesor. Además del tipo que declara el navegador se verifica la firma del archivo: un PNG renombrado a `.jpg` se rechaza con 400 `VALIDACION` y `details` sobre `foto` ("La foto debe ser JPG o PNG", "La foto no puede superar los 5 MB").
- En la base se guarda la **clave** del objeto, no la URL. El listado, el detalle, `mis-alumnos` y `mi-perfil` devuelven `fotoUrl`: una URL prefirmada (15 min), o `null` si el alumno no tiene foto.
- Subirla, reemplazarla o quitarla actualiza la auditoría del alumno (`updatedBy`, `updatedAt`). Al reemplazar o quitar, el archivo anterior se borra.
- Las dos respuestas son el detalle del alumno, igual que el alta y la edición.

### Acceso al portal (HU-27)

El alumno ingresa al portal con un **usuario** (no con su email; ver [Autenticación](#autenticación)). El alta lo crea junto con el alumno, en la misma transacción.

- **Cómo se arma el usuario:** inicial del nombre + apellido + últimos 3 dígitos del DNI, en minúsculas, sin espacios ni tildes y con la "ñ" como "n" (Juan Pérez, DNI 45.123.456 → `jperez456`). Si ya está tomado, se agrega `-2`, `-3`… El usuario **no cambia** aunque después se corrija el nombre o el apellido.
- **Contraseña inicial:** el DNI del alumno, sin puntos. **Nunca se devuelve** en ninguna respuesta.
- `GET /alumnos/usuario-sugerido` responde `{ "usuario": "jperez456" }` para mostrarlo en el formulario de alta en cuanto están nombre, apellido y DNI. Es sólo una **sugerencia**: el definitivo se calcula al guardar, porque entre la consulta y el alta otro alumno puede quedarse con él.
- **El detalle trae `acceso`** (o `null` si el alumno todavía no lo tiene):

  ```json
  {
    "acceso": {
      "usuario": "jperez456",
      "creadoPor": { "id": "usr_mesa_01", "nombre": "Ana", "apellido": "Pérez" },
      "creadoEl": "2026-10-14T13:45:00.000Z",
      "restablecidaPor": null,
      "restablecidaEl": null
    }
  }
  ```

- `POST /alumnos/{id}/acceso` responde **201** con el detalle del alumno ya con su `acceso`; 409 `CONFLICTO` ("El alumno ya tiene acceso al portal") si lo tenía.
- `POST /alumnos/{id}/acceso/restablecimiento` responde 200 con el detalle: la contraseña vuelve a ser el DNI, queda marcada como inicial (el portal recomienda cambiarla, HU-28) y `restablecidaPor` / `restablecidaEl` dicen quién y cuándo. 409 `CONFLICTO` ("El alumno no tiene acceso al portal") si no tiene.
- **Un DNI que ya tiene usuario** (por ejemplo, el de un profesor que además toma clases) hace que el alta responda 409 `CONFLICTO` con "Ya existe un usuario con ese DNI" y `details` sobre `dni`: cada persona tiene un solo usuario por DNI. **Pendiente de confirmación de las PO** (punto 10 de "Puntos a confirmar" del Sprint 3).

### Perfil del portal (HU-28)

`GET /api/v1/alumnos/mi-perfil` (rol `ALUMNO`) devuelve sólo lo que el menú del portal necesita, del alumno **de la sesión**: no recibe ningún `alumnoId` ni devuelve ningún otro dato de la ficha.

```json
{
  "nombre": "Lucía",
  "apellido": "Álvarez",
  "usuario": "lalvarez678",
  "fotoUrl": "https://…"
}
```

Un rol que no sea `ALUMNO`, o una cuenta `ALUMNO` sin alumno vinculado, reciben 403 `SIN_PERMISO`.

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

Los endpoints son de `MESA_ENTRADAS`, salvo los de `/turnos/mis-turnos/…`, que son del portal del alumno (`ALUMNO`, HU-29; ver [Sacar un turno desde el portal](#sacar-un-turno-desde-el-portal-hu-29)). En `turnos` quedan la disponibilidad, el alta y el detalle; las agendas se movieron a `/api/v1/agendas/*` (T-30, ver Agendas). Reglas en `dominio.md` → Turnos y Tope de deuda.

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
  - Errores, agrupados por status (no es el orden en que se validan: por ejemplo, `PROFESOR_INACTIVO` se decide antes que el 404 de materia): 400 (formato, fecha pasada, horas de más de un profesor o día, fechas que no caen en el día, `temas` faltante en una sesión única), 404 (alumno, horas por posición en `bloqueIds`, materia), 409 `DEUDA_VENCIDA`, `PROFESOR_INACTIVO`, `MATERIA_INACTIVA`, `MATERIA_NO_ASIGNADA`, `ALUMNO_SUPERPUESTO` y `BLOQUE_LLENO` (ver Errores).
  - **Tope de deuda (HU-29, T-93):** si el alumno tiene deuda vencida (turnos adeudados de hace 30 días o más, `dominio.md` → Tope de deuda), 409 `DEUDA_VENCIDA` con "El alumno tiene deuda de más de 30 días (3 turnos · $ 24.000). Debe regularizar el pago para agendar turnos nuevos" y `details: { "cantidad", "total" }`. Se calcula al confirmar, con el alumno bloqueado, y se decide antes que la capacidad: un pedido con deuda vencida no recibe `BLOQUE_LLENO`. Vale para la sesión única y el recurrente; no cambia cancelar, reprogramar ni los turnos que el alumno ya tiene.

### Sacar un turno desde el portal (HU-29)

Rol `ALUMNO`. El alumno sale de la sesión (`actor.alumnoId`): ninguno de estos endpoints recibe un `alumnoId`, y uno en el body se descarta. Una cuenta `ALUMNO` sin alumno vinculado, o cualquier otro rol, recibe 403 `SIN_PERMISO`. Las reglas son las del alta de la mesa (la misma función): capacidad por hora y fecha, materia asignada al profesor, fechas en el día del bloque, temas obligatorios en una sesión única, superposición y fechas sin lugar. Lo que cambia para el alumno: las fechas son **desde mañana**, los textos se le dirigen a él y nunca ve cupos, ocupación, observaciones ni la auditoría (ver [Portal del alumno](#portal-del-alumno)).

| Ruta                                                                                | Qué hace                                                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `GET /api/v1/turnos/mis-turnos/habilitacion`                                        | Si puede sacar un turno: `{ "habilitado", "deuda": { "cantidad", "total" } \| null }` |
| `GET /api/v1/turnos/mis-turnos/materias`                                            | Paso 1: `[{ "id", "nombre" }]`, sin paginar y por nombre                              |
| `GET /api/v1/turnos/mis-turnos/disponibilidad?materiaId&diaSemana&profesorId&fecha` | Pasos 2 y 3: la disponibilidad de la mesa, sin cupos y con el valor por clase         |
| `POST /api/v1/turnos/mis-turnos`                                                    | Saca el turno (201): el resumen de "Turno reservado"                                  |

- **`habilitacion`** es el aviso que se muestra al entrar a "Sacar turno", antes del paso 1: `{ "habilitado": false, "deuda": { "cantidad": 3, "total": 24000 } }` si tiene deuda vencida (`dominio.md` → Tope de deuda), o `{ "habilitado": true, "deuda": null }`. El alta lo vuelve a decidir: un pago o una deuda nueva entre el aviso y la confirmación cuentan.
- **`materias`**: las activas con al menos un profesor activo que la tenga asignada (con asignación activa) y que tenga bloques activos.
- **`disponibilidad`**: el mismo query y la misma búsqueda que `GET /turnos/disponibilidad` (materia obligatoria; profesor y día opcionales y combinables; sólo profesores activos con la materia; materia inexistente → 404, inactiva → 409 `MATERIA_INACTIVA`). Sin `fecha`, la próxima ocurrencia de cada día **desde mañana**; con `fecha`, tiene que ser posterior a hoy (400 en `fecha`: "Los turnos se sacan desde el día siguiente"). Cada hora dice sólo si se puede elegir; cada resultado trae `valorPorClase`, el precio por hora vigente de la materia (HU-12), o `null` si no tiene:

  ```json
  [
    {
      "profesor": { "id": 4, "nombre": "Ana", "apellido": "Pérez" },
      "diaSemana": 1,
      "fecha": "2026-09-28",
      "aula": { "id": 3, "nombre": "Aula 3" },
      "horaInicio": "08:00",
      "horaFin": "10:00",
      "valorPorClase": 8000,
      "horas": [
        { "bloqueId": 10, "horaInicio": "08:00", "horaFin": "09:00", "disponible": false },
        { "bloqueId": 11, "horaInicio": "09:00", "horaFin": "10:00", "disponible": true }
      ]
    }
  ]
  ```

- **`POST /turnos/mis-turnos`**: el body de `POST /turnos` **sin `alumnoId` ni `observaciones`** (las observaciones son internas de la mesa; el alumno escribe los `temas`, "¿Qué querés trabajar en la clase?", obligatorios en `SESION_UNICA`):

  ```json
  {
    "materiaId": 3,
    "bloqueIds": [11],
    "tipo": "RECURRENTE",
    "fechaInicio": "2026-10-05",
    "fechaFin": null,
    "temas": "Funciones cuadráticas",
    "asignarDondeHayLugar": false
  }
  ```

  - `fechaInicio` posterior a hoy: hoy o antes → 400 en `fechaInicio`, "Los turnos se sacan desde el día siguiente". El resto de los 400 y 404, como la mesa.
  - El turno queda `ACTIVO` ("Agendado") sin aprobación, y su auditoría es del **usuario del alumno**: el detalle del turno muestra que lo registró él.
  - 409, como la mesa: `DEUDA_VENCIDA` con "Tenés clases adeudadas de hace más de 30 días. Para sacar un turno nuevo, regularizá el pago en la mesa de entrada" (mismos `details`); `ALUMNO_SUPERPUESTO` con "Ya tenés un turno ese día en ese horario" (mismos `details`: sus turnos en conflicto); `BLOQUE_LLENO` con las fechas llenas, **sin `capacidadEfectiva`**, y reenviado con `asignarDondeHayLugar: true` se crea sólo en las fechas con lugar ("Reservar sólo las fechas con lugar"); `PROFESOR_INACTIVO`, `MATERIA_INACTIVA`, `MATERIA_NO_ASIGNADA`.
  - Respuesta `201`, el resumen de "Turno reservado" (sin observaciones, auditoría ni cupos):

  ```json
  {
    "cantidad": 2,
    "tipo": "RECURRENTE",
    "diaSemana": 1,
    "materia": { "id": 3, "nombre": "Matemática" },
    "profesor": { "id": 4, "nombre": "Ana", "apellido": "Pérez" },
    "aula": { "id": 3, "nombre": "Aula 3" },
    "temas": "Funciones cuadráticas",
    "turnos": [
      {
        "id": 55,
        "bloqueId": 11,
        "horaInicio": "09:00",
        "horaFin": "10:00",
        "fechaInicio": "2026-10-05",
        "fechaFin": "2026-10-19"
      },
      {
        "id": 56,
        "bloqueId": 11,
        "horaInicio": "09:00",
        "horaFin": "10:00",
        "fechaInicio": "2026-11-02",
        "fechaFin": null
      }
    ],
    "fechasSinTurno": [
      {
        "bloqueId": 11,
        "horaInicio": "09:00",
        "horaFin": "10:00",
        "fechas": ["2026-10-26"],
        "completoDesde": null
      }
    ]
  }
  ```

  `turnos` es uno por hora y por tramo; `fechasSinTurno`, como en el alta de la mesa.

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

Las agendas leen **ocurrencias** (un turno en una fecha, ver `convenciones-backend.md` → Ocurrencias) y **muestran todas las no canceladas (agendadas, sin registrar y con asistencia); las canceladas sólo con `incluirCancelados=true`** (HU-13, T-57: se siguen viendo con su estado). **La asistencia se ve sólo en el detalle del turno** (decisión de las PO, T-86): las agendas, el calendario semanal, la vista lista y el PDF de la agenda no la muestran, aunque cada ocurrencia traiga su `estado` del motor. Una ocurrencia posterior al fin efectivo de una serie finalizada no existe y no sale.

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
  "cupo": { "ocupados": 3, "capacidad": 4 },
  "prioridad": "ALTA",
  "examen": {
    "id": 5,
    "fecha": "2026-10-02",
    "materiaNombre": "Matemática",
    "dias": 4
  }
}
```

- La ocurrencia se identifica por `turnoId` + `fecha` (`turnoId` se repite en un recurrente): es el identificador de `GET /api/v1/ocurrencias/{turnoId}/{fecha}`. `bloqueAgendaId` identifica la clase junto con `fecha`: dos ocurrencias con la misma `fecha` y el mismo `bloqueAgendaId` son la misma clase, y agruparlas es presentación (lo hace el cliente).
- `estado`: el del motor (T-74): `AGENDADO`, `CANCELADO`, `SIN_REGISTRAR` (pasada, sin asistencia), `REALIZADO` o `AUSENTE` (con asistencia "Presente" o "Ausente"). Viaja para abrir el detalle, que sí muestra la asistencia (`GET /ocurrencias/{turnoId}/{fecha}`). **Las vistas de agenda no la muestran** (variante "sin asistencia" de `EstadoTurnoBadge`, T-77): "Agendado" y "Cancelado" como siempre y un turno pasado no cancelado sin distintivo, sea `SIN_REGISTRAR`, `REALIZADO` o `AUSENTE`.
- `estadoPago`: `PAGADO` si la ocurrencia tiene un pago aplicado, si no `PENDIENTE` (una cancelada nunca se cobró: `PENDIENTE`).
- `prioridad` (`ALTA`, `MEDIA`, `BAJA`) y `examen` (el que la determina, T-31): `null` en una ocurrencia **cancelada**; `examen` también es `null` si no hay un examen próximo. Es la misma regla que el detalle y las ocurrencias del alumno.
- `cupo` (`{ ocupados, capacidad }`, HU-19): el de la **clase** (`fecha` + `bloqueAgendaId`), el mismo para todas las ocurrencias de esa clase. `capacidad` es la efectiva de la hora, `min(profesor.capacidad, aula.capacidad)`, y `ocupados` cuenta los turnos que ocupan lugar (los cancelados no) con la misma regla que el alta de turnos. **No depende de los filtros** de la agenda: con un filtro que deja ver un solo turno de la clase, `cupo` sigue siendo el de la clase entera. La clase está llena si `ocupados >= capacidad`.
- **No hay `fechaOriginal` ni `reprogramada`**: un turno reprogramado es un turno más, en su fecha y bloque nuevos (definiciones A y B). Tampoco hay `id` ni el `estado: "ACTIVO"` de antes: `estado` es el de la ocurrencia y el id es `turnoId`.
- **Filtros `incluirCancelados` y `prioridad`**, opcionales y combinables entre sí y con los demás filtros de cada agenda. `incluirCancelados` es `true` o `false`: sin el parámetro (o en `false`) salen todas las no canceladas (agendadas, sin registrar y con asistencia); con `true` salen además las canceladas. No hay un filtro por estado suelto ni por asistencia. `prioridad` deja afuera las canceladas (no tienen). Valores inválidos: 400 `VALIDACION`.

### Agenda diaria

**`GET /api/v1/agendas/diaria?fecha&page&pageSize&materiaId&aulaId&profesorId&incluirCancelados&prioridad&q`** (rol `MESA_ENTRADAS`): las ocurrencias de una fecha (sin `fecha`, hoy), paginadas (decisión T-35).

- Filtros: `materiaId`, `aulaId`, `profesorId` (vista personal de ese profesor, T-42), `incluirCancelados`, `prioridad` y `q` (T-36: todas las palabras en el nombre del alumno o todas en el del profesor; con `profesorId`, sólo en el del alumno). El total de `meta` es el de lo filtrado.
- Orden: hora de inicio, dentro de la hora por profesor (apellido y nombre) y por id del turno.
- Ítem: el de "La ocurrencia de una agenda", con `profesor`.
- Errores: 400 `VALIDACION` (fecha, ids, `incluirCancelados`, `prioridad`, `q` de más de 100 caracteres, paginación); 403 para cualquier rol que no sea `MESA_ENTRADAS`.

**`GET /api/v1/agendas/diaria/pdf?fecha&profesorId&incluirCancelados&prioridad`** (rol `MESA_ENTRADAS`): la agenda de **un profesor** en una fecha como documento oficial en PDF, con el contrato común de [Documentos PDF](#documentos-pdf).

- **`profesorId` es obligatorio** (si falta o es inválido, 400 `VALIDACION` en `["profesorId"]`): la agenda de todo el centro en un día puede ser demasiado larga para un documento y no tiene PDF. Un profesor inexistente responde 404; su estado no importa (uno inactivo conserva sus turnos).
- `fecha` (sin ella, hoy), `incluirCancelados` y `prioridad` valen lo mismo que en la agenda diaria. **No acepta** `q`, `materiaId`, `aulaId`, `page` ni `pageSize`: si llegan, se ignoran.
- Trae **todas** las ocurrencias del día, sin paginar, con los mismos filtros y el mismo orden que `GET /agendas/diaria` (hora de inicio y, dentro de la hora, profesor e id del turno): es la misma lectura, sin el corte de la página.
- Contenido: la fecha con su día (`viernes 02/10`) y la línea `Profesor: <nombre apellido>`, seguida de `· Incluye cancelados` y `· Prioridad: <etiqueta>` si se pidieron; y una tabla Horario · Alumno · Profesor · Materia · Aula · Estado. La columna Estado se ve como las vistas, sin la asistencia (T-86): "Agendado", "Cancelado" o `—` para un turno pasado no cancelado (sin registrar o con asistencia). Sin turnos, "No hay turnos para este día." (el nombre del profesor sale igual).
- Nombre del archivo: `agenda-<fecha>-<apellido>-<nombre>.pdf`, con el profesor (`agenda-2026-10-02-cornejo-bautista.pdf`).
- Errores: 400 `VALIDACION` (`profesorId`, `fecha`, `incluirCancelados`, `prioridad`); 401; 403 para cualquier rol que no sea `MESA_ENTRADAS`; 404 si el profesor no existe.

### Selectores de la agenda

**`GET /api/v1/agendas/materias?fecha?`** y **`GET /api/v1/agendas/aulas?fecha?`** (rol `MESA_ENTRADAS`, selectores con filtros): las materias o las aulas con al menos una ocurrencia no cancelada en `fecha` (`YYYY-MM-DD`; sin ella, hoy), `[{ "id", "nombre" }]`, sin paginar y ordenadas por nombre. No filtran por el estado de la materia o del aula: con una fecha pasada traen también una hoy `INACTIVO` si tuvo turno ese día. Siguen igual que antes de T-57: no consideran las canceladas. 400 si `fecha` es inválida.

### Agenda propia del profesor

**`GET /api/v1/agendas/propia?desde&hasta&incluirCancelados&prioridad`** (rol `PROFESOR`, sólo lectura): los turnos del profesor **de la sesión** para un día o un rango. El profesor sale de la sesión, **nunca de un parámetro**: no hay forma de pedir la agenda de otro, y un `profesorId` en el query se ignora.

- `desde` (`YYYY-MM-DD`, opcional): primer día. Sin `desde`, hoy. `hasta` (opcional): último día, incluido; sin `hasta`, el mismo día que `desde` (la vista por día). Se admiten fechas pasadas.
- Devuelve un **arreglo sin paginar** (decisión T-43), ordenado por fecha y, dentro del día, por hora de inicio e id del turno.
- Cada ítem es una **ocurrencia**, no un turno: un recurrente aparece una vez por cada fecha del rango que cae en el día de su bloque, así que `turnoId` se repite. Es el de "La ocurrencia de una agenda", **sin `profesor`**.
- Errores: 400 `VALIDACION` si una fecha tiene formato inválido, si `hasta` es anterior a `desde`, si el rango supera los **31 días** (`details` sobre `hasta`) o si `incluirCancelados` o `prioridad` no son válidos; 404 `NO_ENCONTRADO` si el usuario de la sesión no tiene ficha de profesor; 403 para cualquier rol que no sea `PROFESOR`.

### Agenda de un profesor (mesa de entradas)

**`GET /api/v1/agendas/profesor?profesorId&desde&hasta&incluirCancelados&prioridad`** (rol `MESA_ENTRADAS`, sólo lectura; decisión T-44): la agenda de cualquier profesor para un día o un rango, para la vista semanal de la ficha del profesor (HU-02).

- `profesorId` (obligatorio): el profesor. `desde`, `hasta`, `incluirCancelados` y `prioridad` funcionan igual que en la agenda propia (mismos defaults y mismo tope de 31 días).
- La respuesta tiene **exactamente la forma de "Agenda propia del profesor"** (arreglo sin paginar de ocurrencias `turnoId` + `fecha`, mismo orden, con las canceladas si se piden y sin `profesor`): el frontend reutiliza el mismo tipo.
- Un profesor **inactivo** también se puede consultar: sus turnos históricos siguen existiendo.
- Errores: 400 `VALIDACION` por los mismos motivos que la agenda propia y además si `profesorId` falta o no es un entero positivo; 404 `NO_ENCONTRADO` si el profesor no existe (se decide antes que el rango); 403 para cualquier rol que no sea `MESA_ENTRADAS`.

### Agenda del centro (mesa de entradas)

**`GET /api/v1/agendas/centro?desde&hasta&profesorId?&materiaId?&aulaId?&incluirCancelados?&prioridad?`** (rol `MESA_ENTRADAS`, sólo lectura; T-57, decisión T-68): las ocurrencias de **todos los profesores** en un rango, para el calendario semanal de la agenda del centro (HU-19).

- `desde` y `hasta` (`YYYY-MM-DD`, extremos incluidos) son **obligatorios**. El rango no puede superar los **31 días** ni estar invertido (400 `VALIDACION` sobre `hasta`).
- Filtros opcionales y combinables: `profesorId`, `materiaId`, `aulaId`, `incluirCancelados` y `prioridad`. Un `profesorId` que no existe no es 404: devuelve un arreglo vacío.
- Devuelve un **arreglo sin paginar**, ordenado por fecha, hora de inicio, profesor (apellido y nombre) e id del turno. Ítem: el de "La ocurrencia de una agenda", con `profesor`. Las canceladas salen sólo con `incluirCancelados=true`.
- **Agrupar por clase (`fecha` + `bloqueAgendaId`) lo hace el cliente**: la API no devuelve clases.
- Errores: 400 `VALIDACION` si falta `desde` o `hasta`, si una fecha o un id es inválido, si `incluirCancelados` o `prioridad` no son válidos, si `hasta` es anterior a `desde` o si el rango supera los 31 días; 403 para cualquier rol que no sea `MESA_ENTRADAS`.

## Ocurrencias

El detalle de un turno en una fecha, y los turnos de un alumno (T-43): la lectura desde la que se opera (cancelar, finalizar, reprogramar, registrar pago, T-44 en adelante). La API calcula qué acciones están permitidas en `acciones`; ninguna pantalla repite esas reglas.

El pago de la ocurrencia viaja en el detalle (`pago`) y en la lista (`estadoPago`), y las acciones lo tienen en cuenta (decisiones T-106 a T-108).

### Detalle de una ocurrencia

**`GET /api/v1/ocurrencias/{turnoId}/{fecha}`** (roles `MESA_ENTRADAS` y `PROFESOR`): la ocurrencia `turnoId` + `fecha` (mismo identificador que en las agendas), **de esa hora**: su estado, su asistencia y su auditoría son los de esa ocurrencia, aunque tenga horas seguidas. La respuesta es la misma para todos, salvo:

- `PROFESOR` del turno: `acciones` viene con todas en `false` salvo `registrarAsistencia` (no cancela, finaliza, reprograma ni cobra) y `pago` es `null` (no ve pagos).
- `PROFESOR` de otro turno (HU-31, se abre desde el historial): si el alumno tiene algún turno `ACTIVO` con él (`materiasDelProfesorConAlumno` del motor), ve el detalle en **sólo lectura**: todas las acciones en `false`, `pago: null` y ninguna hora `registrable`. Si no, 403.

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
  "pago": { "estado": "PENDIENTE", "importeVigente": 8000 },
  "prioridad": "ALTA",
  "examen": {
    "id": 8,
    "fecha": "2026-10-05",
    "materiaNombre": "Matemática",
    "dias": 7
  },
  "plazoAsistencia": null,
  "asistencia": null,
  "horasSeguidas": null,
  "acciones": {
    "cancelar": { "visible": true, "habilitada": true },
    "finalizar": { "visible": true },
    "reprogramar": { "visible": true },
    "registrarPago": { "visible": true },
    "registrarAsistencia": { "visible": false }
  },
  "createdAt": "2026-08-01T13:00:00.000Z",
  "updatedAt": "2026-08-01T13:00:00.000Z",
  "createdBy": {
    "id": "usr_mesa_01",
    "nombre": "Ana",
    "apellido": "Pérez",
    "rol": "MESA_ENTRADAS"
  },
  "updatedBy": { "id": "usr_mesa_01", "nombre": "Ana", "apellido": "Pérez" }
}
```

- `estado`: el del motor (T-74, decisión T-137): `AGENDADO`, `CANCELADO`, `SIN_REGISTRAR` (pasada, sin asistencia), `REALIZADO` o `AUSENTE` (con asistencia "Presente" o "Ausente").
- `plazoAsistencia`: `{ vence, vencido }`, tal como lo da el motor: `vence` es el último día para registrar o corregir la asistencia (hasta las 23:59) y `vencido`, si ya pasó. `null` en una cancelada o de fecha posterior a hoy; las de hoy y las pasadas lo tienen, también las ya registradas.
- `asistencia`: la de **esa hora**, en una de tres formas (el estado manda, decisión T-137):
  - **Registrada** (`REALIZADO` o `AUSENTE`): con quién y cuándo la registró y la modificó (los dos siempre, como la auditoría de cualquier entidad). Un ausente trae `observacion` y no trae textos.

    ```json
    {
      "estado": "PRESENTE",
      "trabajado": "Suma y resta de fracciones",
      "indicaciones": "Hacer la guía 3",
      "observacion": null,
      "registradaPor": { "id": "usr_prof_03", "nombre": "Ana", "apellido": "Pérez" },
      "registradaEl": "2026-10-05T12:10:00.000Z",
      "modificadaPor": { "id": "usr_prof_03", "nombre": "Ana", "apellido": "Pérez" },
      "modificadaEl": "2026-10-06T09:00:00.000Z",
      "cerradaPorSistema": false
    }
    ```

  - **Cerrada por el sistema** (`SIN_REGISTRAR` con el plazo vencido): `estado`, `trabajado`, `indicaciones`, las personas e instantes en `null`, `observacion` con el texto del cierre ("No registrada por el profesor en el plazo de 7 días. Cierre automático del sistema") y `cerradaPorSistema: true`. El cierre se calcula al leer (decisión T-138): `registradaEl` es `null` y la fecha del cierre es `plazoAsistencia.vence` (las 23:59 de ese día).
  - **`null`** en cualquier otro caso: agendada, sin registrar dentro del plazo (con su `plazoAsistencia`) o cancelada, aunque una cancelada tenga una asistencia guardada.
- `horasSeguidas`: las **horas seguidas** de la ocurrencia (mismo alumno, profesor, materia y fecha, una a continuación de la otra; ver `dominio.md` → Asistencia), o `null` si la hora no tiene otra seguida o está cancelada. Lo ven todos los que pueden ver el detalle.

  ```json
  {
    "horaInicio": "08:00",
    "horaFin": "10:00",
    "horas": 2,
    "textos": { "trabajado": "Suma y resta de fracciones", "indicaciones": "Hacer la guía 3" },
    "ocurrencias": [
      {
        "turnoId": 31,
        "fecha": "2026-10-05",
        "horaInicio": "08:00",
        "horaFin": "09:00",
        "estado": "REALIZADO",
        "plazoAsistencia": { "vence": "2026-10-12", "vencido": false },
        "actual": true,
        "registrable": false,
        "textosPropios": null,
        "observacion": null
      },
      {
        "turnoId": 32,
        "fecha": "2026-10-05",
        "horaInicio": "09:00",
        "horaFin": "10:00",
        "estado": "SIN_REGISTRAR",
        "plazoAsistencia": { "vence": "2026-10-12", "vencido": false },
        "actual": false,
        "registrable": true,
        "textosPropios": null,
        "observacion": null
      }
    ]
  }
  ```

  - Ejemplo: Lucas viene de 8 a 9, de 9 a 10 y de 20 a 21, con la misma materia y el mismo profesor. Los detalles de 8 a 9 y de 9 a 10 traen el mismo grupo (`08:00` a `10:00`, 2 horas), cada uno con `actual: true` en su hora; el de 20 a 21, `null`. Una hora cancelada en el medio, otra materia u otro profesor cortan el grupo.
  - `ocurrencias`: todas las horas del grupo en orden, cada una con su propio `estado` y `plazoAsistencia`. `observacion` es la de la asistencia si la hora es `AUSENTE`; si no, `null`.
  - `textos` (los de la primera hora presente, que se muestran una sola vez; `null` si ninguna está presente) y `textosPropios` (los de esa hora, sólo si es presente y sus textos difieren de `textos`; si no, `null`) los decide la API con una sola regla del motor (`textosDeHorasSeguidas`): la UI no compara textos.
  - `registrable`: `true` si quien mira puede registrar la asistencia (`acciones.registrarAsistencia.visible`) y esa hora no tiene asistencia ni está vencida. Son las horas que ofrece "Aplicar también a…"; una ya registrada se corrige desde su propio detalle.

- `serie`: período del turno o tramo (`fechaInicio`, `fechaFin`, `null` sin fin) y, si tiene una, la `finalizacion` (`fechaDesde` es el fin efectivo, definición C, más `motivo`, `detalle`, `createdBy`, `createdAt`); `null` si no está finalizada. La finalización es **de la hora** (decisión T-104): la del propio turno o, si no tiene, la de otro tramo de su misma hora en su serie, así que un tramo anterior también la muestra. El `serieId` que agrupa los turnos de un alta no viaja en la respuesta. Sin sección de reprogramación: un turno reprogramado ya está en su fecha y bloque nuevos, y no muestra desde cuándo se movió (definición A).
- `cancelacion`: `null` salvo `estado = "CANCELADO"` (`motivo`, `detalle`, `createdBy`, `createdAt`).
- `pago`: `null` para `PROFESOR`. Para `MESA_ENTRADAS`, según su `estado`:
  - `PENDIENTE`: `importeVigente`, el precio por hora vigente de la materia (lo que se cobraría hoy), o `null` si la materia no tiene precio. Una cancelada también viene `PENDIENTE` (nunca se cobró): la UI no muestra su pago.
  - `PAGADO`: los datos de su pago, con los nombres de `GET /pagos/{id}`. `importe` es lo que se cobró (`importeAplicado`): no cambia si después cambia el precio de la materia.

    ```json
    {
      "estado": "PAGADO",
      "pagoId": 31,
      "numeroComprobante": 1024,
      "importe": 8000,
      "formaPago": { "id": 1, "nombre": "Efectivo" },
      "fechaPago": "2026-10-01",
      "registradoPor": { "id": "usr_mesa_01", "nombre": "Ana", "apellido": "Pérez" },
      "registradoEl": "2026-10-01T14:30:00.000Z"
    }
    ```

- `prioridad` y `examen` (el examen que la determina, T-31): `null` en una ocurrencia cancelada.
- `acciones` (las calcula la API; ninguna pantalla repite estas reglas):
  - `cancelar`: `{ visible, habilitada, motivo? }`. Visible si está `AGENDADO` (agendada, hoy o posterior). Si además está pagada, viene `habilitada: false` con `motivo: "El turno está pagado: no se puede cancelar"` (el mismo texto con el que `POST /cancelaciones` la rechaza); `motivo` sólo viene en ese caso.
  - `finalizar`: si el turno es `RECURRENTE`, su hora está vigente (algún tramo de esa hora en su serie tiene `fechaFin` nula o de hoy en adelante) y **ningún tramo de esa hora tiene una finalización** (decisión T-104: si se ve, `POST /finalizaciones` no rechaza por "no vigente" ni por "ya finalizado"; la otra hora de la misma serie se evalúa aparte). No mira el pago de esta ocurrencia: las pagadas de la hora se validan al finalizar (409 `TURNOS_PAGADOS`).
  - `reprogramar`: si está `AGENDADO`. Una pagada se reprograma igual (el pago acompaña al turno).
  - `registrarPago`: si no está `CANCELADO`, su pago está `PENDIENTE` y su fecha no pasa el tope de cobro de `POST /pagos` (hoy + 56 días; las pasadas no tienen tope). Una materia sin precio sí lo muestra: decide el 409 `SIN_PRECIO` del cobro. Un turno con asistencia (`REALIZADO` o `AUSENTE`) se cobra igual: no ofrece cancelar ni reprogramar, pero sí registrar el pago si está impago.
  - `registrarAsistencia`: `{ visible }`. `true` sólo para el **profesor del turno** y con el plazo abierto (`plazoAsistencia` no nulo y no vencido); también con la asistencia ya registrada, porque corregir es volver a guardar. Mesa de entrada, un profesor de otro turno y cualquier otro rol: `false`. No hay un endpoint nuevo: se guarda con `PUT /asistencias` ([Asistencias](#asistencias)), un registro por cada hora tildada (esta y las de "Aplicar también a…").
- `createdBy`/`updatedBy`: quién creó el turno y quién lo modificó por última vez. Si el turno se reprogramó, quien lo modificó es quien lo reprogramó (no hay un campo aparte). `createdBy` trae además su `rol`, para que el detalle diga si el turno lo sacó el propio alumno desde el portal (`ALUMNO`, HU-29).
- Errores: 400 `VALIDACION` (`turnoId` o `fecha` inválidos); 401 `NO_AUTENTICADO`; 403 `SIN_PERMISO` (rol distinto de `MESA_ENTRADAS`/`PROFESOR`, o un `PROFESOR` de otro turno sin turnos `ACTIVO` con el alumno) o `USUARIO_INHABILITADO`; 404 `NO_ENCONTRADO` si el turno no existe o esa fecha no es una de sus ocurrencias (incluida una posterior al fin efectivo de una serie ya finalizada).

**`GET /api/v1/ocurrencias/{turnoId}/{fecha}/pdf`** (roles `MESA_ENTRADAS` y `PROFESOR`): el detalle del turno como documento oficial en PDF, con el contrato común de [Documentos PDF](#documentos-pdf). Mismos params, mismas reglas de acceso y mismos errores que el detalle (400, 401, 403 y 404), y los mismos datos, porque usa el mismo detalle: un `PROFESOR` de otro turno lo descarga si el alumno tiene algún turno `ACTIVO` con él, y si no, 403.

- Contenido: Alumno, DNI, Materia, Profesor, Aula, "Día y horario" (la fecha con su día: `jueves 01/10`), Horario (`8:00 a 9:00`), Tipo (`Recurrente` / `Sesión única`) y, sólo en un recurrente, "Período de la serie" (`03/09 – 08/10`, o `03/09 – sin fin`); en otra tarjeta, "Temas a trabajar" (`—` si no hay).
- Nombre del archivo: `turno-<fecha>-<apellido>-<nombre>.pdf`, con la fecha `YYYY-MM-DD` y el alumno (`turno-2026-10-01-colque-renata.pdf`).

### Turnos de un alumno

**`GET /api/v1/ocurrencias?alumnoId&desde?&hasta?`** (rol `MESA_ENTRADAS`): las ocurrencias del alumno en `[desde, hasta]`, para la pestaña "Turnos" de su ficha (HU-02). Incluye las canceladas (a diferencia de las agendas): se siguen viendo con su estado.

- `alumnoId` (obligatorio). `desde`/`hasta` (`YYYY-MM-DD`, opcionales, extremos incluidos): sin `desde`, el 1 de enero del año en curso; sin `hasta`, el 31 de diciembre (T-66: antes era un rango relativo a hoy, 30 días atrás / 56 adelante). El rango pedido no puede salir del año en curso, ni venir invertido.
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
      "estadoPago": "PENDIENTE",
      "prioridad": "ALTA",
      "cancelable": true,
      "plazoAsistencia": null
    }
  ]
  ```

- `estadoPago`: `PENDIENTE` o `PAGADO`; una cancelada viene `PENDIENTE` (nunca se cobró) y la UI no lo muestra. `prioridad`: `null` en una ocurrencia cancelada. `cancelable`: mismas reglas que `acciones.cancelar` del detalle (agendada y con el pago pendiente: una pagada no se puede tildar).
- `plazoAsistencia`: el mismo que en el detalle (`{ vence, vencido }` o `null`). Es una lista: no trae la asistencia ni las horas seguidas, que se ven en el detalle.
- Errores: 400 `VALIDACION` (`alumnoId` faltante o inválido, `hasta` anterior a `desde`, o rango fuera de la ventana permitida, `details` sobre `hasta`); 401 `NO_AUTENTICADO`; 403 para cualquier rol que no sea `MESA_ENTRADAS`.

**`GET /api/v1/ocurrencias/pdf?alumnoId&desde?&hasta?&estado?&seleccion?`** (rol `MESA_ENTRADAS`): los turnos del alumno como documento oficial en PDF, con el contrato común de [Documentos PDF](#documentos-pdf). `alumnoId`, `desde` y `hasta` valen lo mismo que en el listado: mismos valores por defecto, misma ventana del año en curso y mismos 400. El documento lista los mismos turnos, en el mismo orden.

- **Qué turnos van:**
  - `seleccion` (opcional): las ocurrencias tildadas en la lista, como `turnoId:fecha` separadas por comas (`31:2026-09-28,31:2026-10-05`). Formato exacto (id entero positivo, fecha real), sin repetidos y hasta **400** claves; si no, 400 `VALIDACION` en `["seleccion"]`. Una clave que no es un turno del alumno en ese rango no agrega nada.
  - `estado` (opcional): `AGENDADO`, `CANCELADO` o `SIN_REGISTRAR`; otro valor, 400 en `["estado"]`.
  - **Con `seleccion` van sólo esas ocurrencias y `estado` se ignora**: una selección explícita ya dice qué va en el documento. Sin `seleccion`, las del `estado` pedido; sin ninguno de los dos, todas.
- **Alumno inexistente: 404 `NO_ENCONTRADO`.** Es distinto del listado JSON, que no verifica al alumno y responde `[]`: el documento lleva su nombre y su DNI en el encabezado, y sin ellos no se puede armar. El rango se valida antes (400).
- Contenido: el nombre y el apellido del alumno, su DNI y el rango (`01/10 – 31/10`, el pedido o el que el listado toma por defecto), seguido de `· Selección (n)` o de `· Estado: <etiqueta>` si se filtró; y una tabla Fecha (con su día) · Horario · Materia · Profesor · Estado · Prioridad (`—` en una cancelada). Sin turnos, "Sin turnos en ese rango.".
- Nombre del archivo: `turnos-<apellido>-<nombre>-<desde>_<hasta>.pdf` (`turnos-alderete-joaquin-2026-10-01_2026-10-31.pdf`).
- Errores: 400 `VALIDACION` (los del listado, más `estado` y `seleccion`); 401; 403 para cualquier rol que no sea `MESA_ENTRADAS`; 404 si el alumno no existe.

Todo sale de `leerOcurrencias` (T-30), `leerPrioridades` (T-31) y, para una pagada, `leerPagoDeOcurrencia` (`pagos`): la feature no reimplementa ninguna de las tres.

### Mis turnos (portal del alumno)

HU-30 (T-84). Rol `ALUMNO`: el alumno sale de la sesión y ningún endpoint recibe un `alumnoId` ([Portal del alumno](#portal-del-alumno)).

**`GET /api/v1/ocurrencias/mis-turnos?desde&hasta`**: las ocurrencias del alumno de la sesión en `[desde, hasta]`, para "Mi calendario". **Incluye las canceladas**, en el orden del motor (fecha y hora), sin paginar.

- `desde` y `hasta` (`YYYY-MM-DD`) son **obligatorios**, con un rango de hasta **31 días** contando los dos extremos. Invertido o más largo: 400 `VALIDACION` en `["hasta"]`.
- Cada ítem: `turnoId`, `fecha`, `diaSemana`, `horaInicio`, `horaFin`, `materia` (`{ id, nombre }`), `profesor` (`{ id, nombre, apellido }`), `aula` (`{ id, nombre }`), `tipo`, `estado` y `estadoPago` (`PENDIENTE` o `PAGADO`; una cancelada viene `PENDIENTE`). Sin prioridad, ocupación, observaciones, `cancelable` ni auditoría.
- Errores: 400 `VALIDACION`; 401 `NO_AUTENTICADO`; 403 `SIN_PERMISO` para otro rol o una cuenta sin alumno.

**`GET /api/v1/ocurrencias/mis-turnos/{turnoId}/{fecha}`**: el detalle de una ocurrencia del alumno de la sesión, con la misma lectura y las mismas reglas que el del personal.

- Trae `turnoId`, `fecha`, `horaInicio`, `horaFin`, `materia`, `profesor`, `aula`, `tipo`, `temas` (los temas a trabajar), `estado`, `plazoAsistencia` y `estadoPago` (`PAGADO` o `PENDIENTE`).
- `asistencia`: la de esa hora, con las mismas tres formas que el detalle del personal pero **sin auditoría ni observación**: `{ estado, trabajado, indicaciones, cerradaPorSistema }` o `null`. Al alumno se le muestran qué se trabajó y las indicaciones.
- `horasSeguidas`: la misma regla y los mismos textos que el detalle del personal (`textos` una vez y `textosPropios` en la hora que cambió), **sin `registrable` ni `observacion`** en cada hora.
- Nunca trae prioridad, observaciones del turno, acciones, `pago` con sus datos ni auditoría (`createdBy`, `updatedBy`, quién registró la asistencia).
- Errores: 400 `VALIDACION` (`turnoId` o `fecha` inválidos); 401 `NO_AUTENTICADO`; 403 `SIN_PERMISO` si el turno es de otro alumno, para otro rol o una cuenta sin alumno; 404 `NO_ENCONTRADO` si el turno no existe o esa fecha no es una de sus ocurrencias.

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

| `motivo`         | Mensaje                                                    | Cuándo                                                                                                                                  |
| ---------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `NO_EXISTE`      | El turno no existe en esa fecha                            | El turno no genera esa fecha (o no existe)                                                                                              |
| `YA_CANCELADO`   | El turno ya está cancelado                                 | Ya tiene su cancelación                                                                                                                 |
| `CON_ASISTENCIA` | El turno tiene asistencia registrada: no se puede cancelar | Tiene asistencia ("Presente" o "Ausente"): ya ocurrió, aunque sea de hoy. Va antes que `PAGADO`: anular el pago no lo vuelve cancelable |
| `PAGADO`         | El turno está pagado: no se puede cancelar                 | Tiene un pago vigente (uno anulado no cuenta: vuelve a ser cancelable). Suma `pagoId`                                                   |
| `PASADO`         | El turno ya pasó: no se puede cancelar                     | Su fecha es anterior a hoy y no tiene asistencia ("Sin registrar")                                                                      |

Una cancelación sólo afecta a esa fecha: el resto de la serie sigue agendado y la hora vuelve a tener lugar ese día.

## Finalizaciones

HU-14 (T-47). Finalizar un turno recurrente desde una fecha. **Actúa por hora** (decisión T-104): finaliza la hora del turno pedido en todos los tramos de su serie; las otras horas de la serie se informan y no se tocan. Reglas en `dominio.md` → Finalización.

| Endpoint                            | Roles           | Qué hace                                                                                                                                    |
| ----------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/finalizaciones/previa` | `MESA_ENTRADAS` | Qué se libera si se finaliza desde esa fecha, los turnos pagados o con asistencia que lo impiden y las otras horas de la serie. 200         |
| `POST /api/v1/finalizaciones`       | `MESA_ENTRADAS` | Finaliza el turno desde esa fecha. 201 con `{ turnoId, cantidad, desde, hasta }`; 400; 404; 409 (`TURNOS_PAGADOS`, `TURNOS_CON_ASISTENCIA`) |

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
  "conAsistencia": [],
  "ultimaFechaConAsistencia": null,
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
- `conAsistencia`: `[{ fecha, horaInicio, horaFin, estado }]`, los turnos con asistencia registrada desde `fechaDesde` (`estado`: `REALIZADO` o `AUSENTE`), por fecha. Sólo puede ser el de hoy: ya ocurrió, así que **si hay alguno, no se puede finalizar desde esa fecha** (T-83).
- `ultimaFechaConAsistencia`: la fecha del último con asistencia; `null` si no hay.
- `fechaDesdeMinima`: la primera `fechaDesde` que se puede elegir (la ocurrencia siguiente a la última que lo impide, pagada o con asistencia). `null` si no hay ninguna, o si llegan hasta el final de la serie: en ese caso (`ultimaFechaPagada` o `ultimaFechaConAsistencia` con valor y `fechaDesdeMinima` `null`) el turno no se puede finalizar.
- `otrasHoras`: `[{ turnoId, fecha, horaInicio, horaFin }]`, las **otras horas de la misma serie** (las que se registraron en el mismo alta) que no están finalizadas y tienen alguna ocurrencia desde `fechaDesde`, por hora. No se finalizan con este pedido: cada una, desde su propio detalle. `turnoId` + `fecha` es la primera ocurrencia de esa hora desde `fechaDesde` (el identificador de su detalle: `GET /ocurrencias/{turnoId}/{fecha}`); si la hora tiene varios tramos, la del tramo que la tiene. Una hora que termina antes de `fechaDesde` no viene. Reemplaza a `otrosTramos`: los tramos de la hora ya se finalizan juntos.

**Respuesta 201 del POST:** `{ "turnoId": 41, "cantidad": 7, "desde": "2026-10-19", "hasta": "2026-11-30" }`, con el mismo significado de `cantidad`, `desde` y `hasta` que en la previa; `turnoId` es el turno pedido. Se registra una `FinalizacionRecurrencia` con la misma `fechaDesde` en cada tramo de la hora que tiene fechas desde ahí.

**Errores**, en orden (el primero que se cumple gana), evaluados sobre **los tramos de la hora** del turno pedido. La previa aplica los mismos, salvo los dos últimos: los pagados y los que tienen asistencia van en la respuesta y no son un error.

| Status | Código                  | Mensaje                                                                                                 | Cuándo                                                                                                    |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 400    | `VALIDACION`            | (el de cada campo)                                                                                      | Formato del query o del body; `detalle` obligatorio con `OTRO`                                            |
| 404    | `NO_ENCONTRADO`         | "Turno no encontrado"                                                                                   | El turno no existe                                                                                        |
| 409    | `CONFLICTO`             | "Sólo se puede finalizar un turno recurrente"                                                           | Es una sesión única                                                                                       |
| 409    | `CONFLICTO`             | "El turno ya no está vigente: no se puede finalizar"                                                    | No está `ACTIVO`, o ningún tramo de la hora llega a hoy (`fechaFin` anterior a hoy)                       |
| 409    | `CONFLICTO`             | "El turno ya fue finalizado"                                                                            | Algún tramo de la hora ya tiene una finalización (o entró otra al mismo tiempo)                           |
| 400    | `VALIDACION`            | "La fecha no puede ser anterior a hoy"                                                                  | `fechaDesde` anterior a hoy. `details` en `["fechaDesde"]`, como los tres que siguen                      |
| 400    | `VALIDACION`            | "La fecha debe caer en lunes" (el día de la serie)                                                      | `fechaDesde` en otro día de la semana                                                                     |
| 400    | `VALIDACION`            | "Elegí una fecha posterior al inicio del turno (05/10). Para liberar sólo esa fecha, cancelá el turno." | `fechaDesde` no es posterior al primer inicio de la hora                                                  |
| 400    | `VALIDACION`            | "La fecha es posterior al fin del turno (30/11)"                                                        | `fechaDesde` posterior al último fin de la hora                                                           |
| 409    | `TURNOS_PAGADOS`        | "Hay turnos pagados desde esa fecha: elegí una fecha posterior al último turno pagado (16/11)"          | Hay pagados desde `fechaDesde` y queda alguna fecha posterior (`fechaDesdeMinima`)                        |
| 409    | `TURNOS_PAGADOS`        | "Los turnos pagados llegan hasta el final de la serie (30/11): no se puede finalizar"                   | Hay pagados hasta la última fecha de la serie (`fechaDesdeMinima: null`)                                  |
| 409    | `TURNOS_CON_ASISTENCIA` | "El turno del 05/10 tiene asistencia registrada: elegí una fecha posterior"                             | El turno de hoy tiene asistencia y `fechaDesde` es hoy; queda alguna fecha posterior (`fechaDesdeMinima`) |
| 409    | `TURNOS_CON_ASISTENCIA` | "El turno del 05/10 tiene asistencia registrada y es el último de la serie: no se puede finalizar"      | El turno con asistencia es la última fecha de la serie (`fechaDesdeMinima: null`)                         |

La fecha va en formato `DD/MM`. Si hay pagados y también asistencia, gana `TURNOS_PAGADOS`: la asistencia sólo puede ser de hoy, así que el último pagado es el que fija `fechaDesdeMinima`. La forma de `details` de `TURNOS_PAGADOS` y `TURNOS_CON_ASISTENCIA` está en Errores.

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

| Status | Cuándo                                                                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 400    | Formato inválido; `fechaDestino` anterior a hoy o que no cae en el día de la hora de destino (`details` en `["fechaDestino"]`); mismo lugar que el de origen (misma hora y misma fecha)                                                                                        |
| 404    | El turno no existe, el turno no tiene una ocurrencia en `fecha`, o la hora de destino no existe o está dada de baja                                                                                                                                                            |
| 409    | La ocurrencia está cancelada; tiene asistencia registrada (`TURNO_CON_ASISTENCIA`, aunque sea de hoy); o ya pasó. `PROFESOR_INACTIVO`, `MATERIA_INACTIVA` o `MATERIA_NO_ASIGNADA` en el destino; `BLOQUE_LLENO`; `ALUMNO_SUPERPUESTO` (mismos códigos y `details` que el alta) |

`BLOQUE_LLENO` y `ALUMNO_SUPERPUESTO` **no cuentan la ocurrencia que se mueve**: mover una fecha a otro profesor a la misma hora no choca con sí misma.

**Efecto sobre los turnos (lo ve el cliente al releer):** una ocurrencia pagada se puede reprogramar y conserva su pago; en un recurrente, el resto de la serie queda igual en las agendas. Cada turno creado o modificado lleva como creador o modificador a quien reprogramó (`updatedBy` / `updatedAt` en el detalle).

## Pagos

HU-15 (T-51), con las formas de pago de HU-23 (T-96), y los pagos realizados y "Mis pagos" de HU-36 y HU-37 (T-98). Registrar el pago de una o varias ocurrencias de un alumno, en efectivo, por transferencia o con débito, leer su comprobante y listar los pagos realizados. Reglas en `dominio.md` → Pagos. **Los importes, el total, el vuelto y los totales los calcula la API**; el cliente sólo los muestra (con formato de pesos) y nunca los recalcula.

| Endpoint                       | Roles                                               | Qué hace                                                                                                        |
| ------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/pagos`           | `MESA_ENTRADAS`                                     | Registra el pago, todo o nada. 201 con el resumen; 400; 404 si el alumno no existe; 409                         |
| `GET /api/v1/pagos`            | `MESA_ENTRADAS`, `GERENTE`                          | Pagos realizados del período, paginados, con lo cobrado por forma de pago. 400                                  |
| `GET /api/v1/pagos/mis-pagos`  | `ALUMNO`                                            | Los pagos del alumno de la sesión, paginados (portal). 403 si la cuenta no tiene alumno                         |
| `GET /api/v1/pagos/alumnos`    | `MESA_ENTRADAS`, `GERENTE`                          | Buscador de alumnos con pagos, para el filtro de los pagos realizados. 400                                      |
| `GET /api/v1/pagos/profesores` | `MESA_ENTRADAS`, `GERENTE`                          | Buscador de profesores con turnos pagados, para el filtro de los pagos realizados. 400                          |
| `GET /api/v1/pagos/materias`   | `MESA_ENTRADAS`, `GERENTE`                          | Buscador de materias con turnos pagados, para el filtro de los pagos realizados. 400                            |
| `GET /api/v1/pagos/{id}`       | `MESA_ENTRADAS`, `GERENTE`                          | Detalle del pago: el comprobante, el adjunto y las acciones. 404 si el pago no existe                           |
| `GET /api/v1/pagos/{id}/pdf`   | `MESA_ENTRADAS`, `GERENTE`, `ALUMNO` (sólo el suyo) | El comprobante como documento PDF (ver Documentos PDF). 400 si el id es inválido; 403 si es de otro alumno; 404 |

Cualquier otro rol recibe 403 `SIN_PERMISO`. El gerente ve los pagos en sólo lectura: no registra (`POST /pagos` → 403) y en el detalle todas sus acciones van en `false`. El alumno sólo usa `GET /pagos/mis-pagos` y el PDF de sus propios pagos.

**Body de `POST /pagos`:**

```json
{
  "alumnoId": 12,
  "ocurrencias": [
    { "turnoId": 41, "fecha": "2026-10-05" },
    { "turnoId": 57, "fecha": "2026-10-07" }
  ],
  "fechaPago": "2026-10-05",
  "formaPago": "EFECTIVO",
  "montoRecibido": 20000,
  "observaciones": "Paga el mes de octubre"
}
```

El mismo cobro por transferencia y con débito (sin `montoRecibido`):

```json
{ "...": "...", "formaPago": "TRANSFERENCIA", "transferencia": { "operacion": "0004829137", "banco": "Banco Macro", "titular": "Marta López" }, "comprobanteAdjuntoId": 18 }
{ "...": "...", "formaPago": "DEBITO", "debito": { "red": "VISA_DEBITO", "cupon": "000123", "ultimos4": "1234" } }
```

- `ocurrencias`: de 1 a 200 pares `(turnoId, fecha)` sin repetir (un repetido: 400 en `["ocurrencias", <posición>]`). Todas del alumno.
- `fechaPago`: `YYYY-MM-DD`, obligatoria, hoy o anterior (400 en `["fechaPago"]`).
- `formaPago`: **obligatoria y sin valor por defecto**: `EFECTIVO`, `TRANSFERENCIA` o `DEBITO` (400 en `["formaPago"]`: "La forma de pago es obligatoria").
- **Un pago, un medio** (HU-23): cada forma lleva sus datos y no los de las otras. Un dato que falta o sobra es un 400 `VALIDACION` en ese campo:

  | `formaPago`     | Lleva                                                           | No lleva                                          |
  | --------------- | --------------------------------------------------------------- | ------------------------------------------------- |
  | `EFECTIVO`      | `montoRecibido` (obligatorio)                                   | `transferencia`, `debito`, `comprobanteAdjuntoId` |
  | `TRANSFERENCIA` | `transferencia` y `comprobanteAdjuntoId` (los dos obligatorios) | `montoRecibido`, `debito`                         |
  | `DEBITO`        | `debito` (obligatorio) y, si se quiere, `comprobanteAdjuntoId`  | `montoRecibido`, `transferencia`                  |

  Los mensajes: "El monto recibido es obligatorio", "El monto recibido sólo va en un pago en efectivo", "Faltan los datos de la transferencia", "Los datos de la transferencia sólo van en un pago por transferencia", "Faltan los datos del débito", "Los datos del débito sólo van en un pago con débito", "El comprobante es obligatorio con transferencia" y "Un pago en efectivo no lleva comprobante adjunto". Omitido o `null` es lo mismo.

- `montoRecibido` (efectivo; decisión T-112): número JSON mayor a 0, con hasta dos decimales y hasta `99999999.99`, y >= el total: si es menor, 400 `VALIDACION` en `["montoRecibido"]` con el total en el mensaje ("El monto recibido ($ 30.000,00) es menor al total ($ 32.000,00)").
- `transferencia`: `operacion` (obligatoria, hasta 50 caracteres), `banco` (obligatorio, hasta 100) y `titular` (opcional, hasta 100; `""` o `null` = sin titular). No se compara el importe transferido ni se impide repetir la operación: una transferencia puede cubrir a varios alumnos.
- `debito`: `red` (`VISA_DEBITO`, `MASTERCARD_DEBITO`, `MAESTRO`, `CABAL_DEBITO` u `OTRA`), `cupon` (obligatorio, sólo números, hasta 20) y `ultimos4` (opcional: exactamente 4 números; `""` o `null` = sin ellos). **Nunca se pide ni se guarda el número completo de la tarjeta.**
- `comprobanteAdjuntoId`: el `id` de un archivo subido con `POST /adjuntos` (ver Adjuntos), que se vincula al pago al registrarlo, en la misma transacción. Si no existe, ya se usó en otro pago o lo subió otro usuario, 400 `ADJUNTO_INVALIDO` en `["comprobanteAdjuntoId"]` y no se registra nada. Con débito, el adjunto se puede agregar o quitar después (`PUT` y `DELETE /adjuntos/pagos/{pagoId}`); con transferencia sólo se reemplaza.
- `observaciones`: opcional, hasta 500 caracteres; `""` o `null` = sin observaciones.
- El importe no cambia según el medio.

**Respuesta 201:**

```json
{
  "pagoId": 31,
  "numeroComprobante": 1024,
  "cantidad": 2,
  "total": 17000,
  "formaPago": "EFECTIVO",
  "montoRecibido": 20000,
  "vuelto": 3000
}
```

`montoRecibido` y `vuelto` siempre vienen: en efectivo con su valor (un vuelto de 0 es un pago justo) y en `null` con transferencia o débito. Con esto la UI arma "Pago registrado: 2 turnos por $ 17.000,00 por transferencia" y, en efectivo, "Vuelto: $ 3.000,00". El vuelto no se guarda.

**Errores del `POST`**, en este orden (el primero que falla gana):

1. Body inválido → 400 `VALIDACION`, incluidos los datos que faltan o sobran para la forma de pago.
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

6. Total mayor a `99999999.99` → 400 en `["ocurrencias"]`; en efectivo, `montoRecibido` menor al total → 400 en `["montoRecibido"]`.
7. Comprobante adjunto que no se puede vincular → 400 `ADJUNTO_INVALIDO` en `["comprobanteAdjuntoId"]`.

Cobrable es una ocurrencia que no está cancelada: `AGENDADO`, `SIN_REGISTRAR`, `REALIZADO` o `AUSENTE` (un turno dado e impago se cobra igual, HU-22). Una ocurrencia de un pago anulado vuelve a estar pendiente y se cobra de nuevo; el único de `PagoTurno` sigue siendo la red contra el pago doble (409 `TURNOS_NO_COBRABLES` sin `details`).

**Respuesta de `GET /pagos/{id}`** (un pago con débito y comprobante adjunto, visto por la mesa de entradas):

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
    },
    {
      "turnoId": 57,
      "fecha": "2026-10-07",
      "horaInicio": "17:00",
      "horaFin": "18:00",
      "materia": { "id": 7, "nombre": "Física" },
      "profesor": { "id": 5, "nombre": "Juan", "apellido": "Ruiz" },
      "importe": 8000
    }
  ],
  "total": 16000,
  "montoRecibido": null,
  "vuelto": null,
  "formaPago": { "codigo": "DEBITO", "nombre": "Tarjeta de débito" },
  "transferencia": null,
  "debito": { "red": "VISA_DEBITO", "cupon": "000123", "ultimos4": "1234" },
  "estado": "VIGENTE",
  "anulacion": null,
  "observaciones": null,
  "registradoPor": { "id": "usr_mesa_01", "nombre": "Laura", "apellido": "Gómez" },
  "registradoEl": "2026-10-05T14:30:00.000Z",
  "cantidad": 2,
  "adjunto": {
    "id": 18,
    "nombre": "cupon-debito.pdf",
    "tipo": "application/pdf",
    "bytes": 184320,
    "adjuntadoPor": { "id": "usr_mesa_01", "nombre": "Laura", "apellido": "Gómez" },
    "adjuntadoEl": "2026-10-05T14:28:00.000Z"
  },
  "acciones": { "anular": true, "reemplazarAdjunto": true, "quitarAdjunto": true }
}
```

Un pago anulado trae `"estado": "ANULADO"` y su anulación:

```json
{
  "estado": "ANULADO",
  "anulacion": {
    "motivo": "FORMA_PAGO_EQUIVOCADA",
    "detalle": "Se cargó en efectivo y fue por transferencia",
    "anuladoPor": { "id": "usr_mesa_01", "nombre": "Laura", "apellido": "Gómez" },
    "anuladoEl": "2026-10-06T12:00:00.000Z"
  },
  "acciones": { "anular": false, "reemplazarAdjunto": false, "quitarAdjunto": false }
}
```

- `turnos`: ordenados por fecha, hora de inicio y `turnoId`, con los datos **actuales** de su turno (una ocurrencia pagada que se reprogramó muestra su fecha, hora y profesor nuevos) e `importe` = lo que se cobró (no cambia si después cambia el precio de la materia).
- `montoRecibido`: sólo en efectivo; `null` con transferencia o débito, o en un pago anterior a que el monto fuera obligatorio (T-112).
- `vuelto`: recalculado en cada lectura (`montoRecibido - total`); `null` sin monto recibido.
- `formaPago`: `{ codigo, nombre }`, con el código fijo (`EFECTIVO`, `TRANSFERENCIA`, `DEBITO`) y el nombre para mostrar.
- `transferencia` (`{ operacion, banco, titular }`, `titular` puede ser `null`) y `debito` (`{ red, cupon, ultimos4 }`, `ultimos4` puede ser `null`): los datos del medio; el del otro medio va `null`.
- `estado`: `VIGENTE` o `ANULADO`. `anulacion`: `{ motivo, detalle, anuladoPor, anuladoEl }` si está anulado (HU-42; `motivo`: `ERROR_CARGA`, `FORMA_PAGO_EQUIVOCADA` u `OTRO`), `null` si está vigente. Se lee en la misma consulta que el pago.
- `registradoPor` es un `UsuarioAuditoria`; `registradoEl`, un instante ISO 8601 en UTC.
- `numeroComprobante` es correlativo y único, pero puede tener huecos (decisión T-62).
- `cantidad`: cuántos turnos incluye (el largo de `turnos`).
- `adjunto`: el último comprobante adjunto **activo** (ver Adjuntos), `{ id, nombre, tipo, bytes, adjuntadoPor, adjuntadoEl }`; `tipo` es `image/jpeg`, `image/png` o `application/pdf`. **No trae URL** ni la clave del archivo: para verlo, `GET /adjuntos/pagos/{pagoId}` da la URL prefirmada. `null` si no tiene (nunca tuvo, se quitó o es en efectivo).
- `acciones`: qué puede hacer quien pide el detalle sobre el pago (`PagoParaAcciones` del frontend). **Las decide la API** según el rol, el estado, la forma de pago y si tiene adjunto, con las mismas reglas que aplican `POST /anulaciones` y `PUT`/`DELETE /adjuntos/pagos/{pagoId}` (decisión T-154). Un botón se muestra si su acción es `true`:

  | Acción              | `true` sólo si…                                                                                                       |
  | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
  | `anular`            | quien pide es `MESA_ENTRADAS` y el pago está `VIGENTE`                                                                |
  | `reemplazarAdjunto` | `MESA_ENTRADAS`, `VIGENTE` y con transferencia o débito (en un débito sin adjunto, es "adjuntar" uno)                 |
  | `quitarAdjunto`     | `MESA_ENTRADAS`, `VIGENTE`, con débito y con adjunto (con transferencia el adjunto es obligatorio: sólo se reemplaza) |

  El gerente las recibe todas en `false` (sólo lectura), y un pago anulado también, para cualquier rol: conserva todo como estaba.

**`GET /pagos/{id}/pdf`**: el comprobante de pago como documento oficial en PDF, con el contrato común de [Documentos PDF](#documentos-pdf). Misma validación del `id` y mismo 404 que `GET /pagos/{id}`, y **los mismos datos** (sin `adjunto` ni `acciones`): los importes, el total y el vuelto son los de esa respuesta, sin recalcular (decisiones T-63 y T-80).

- Roles: `MESA_ENTRADAS`, `GERENTE` y `ALUMNO`, este último **sólo con sus propios pagos** (HU-37). Es **el mismo documento para todos los roles**: el alumno descarga el mismo comprobante que le entrega la mesa, con "Registrado por" y, si está anulado, quién lo anuló (decisión T-153).
- Errores del alumno, en este orden: cuenta sin alumno vinculado → 403 `SIN_PERMISO`; pago inexistente → 404 `NO_ENCONTRADO`; pago de otro alumno → 403 `SIN_PERMISO`.

- Nombre del archivo: `comprobante-<numeroComprobante>.pdf` (sólo el número: `comprobante-1024.pdf`).
- Contenido: número junto al título, alumno, DNI, fecha y forma de pago, la tabla de turnos (fecha, horario, materia, profesor e importe), el total con el monto recibido y el vuelto si los hay, las observaciones y el pie "Registrado por <nombre apellido> el dd/MM/yyyy HH:mm" (`registradoPor` y `registradoEl`, en la hora del negocio) con la leyenda "Comprobante interno de pago · No válido como factura" (decisión T-111). Además (T-96):
  - los datos del medio debajo de la forma de pago: operación, banco y titular de una transferencia; red, cupón y "**** 1234" de un débito (lo que no se cargó no va);
  - con más de una materia, la tabla agrupada por materia (por nombre), con una fila "Subtotal <materia>" al final de cada una (HU-25);
  - si el pago está anulado, arriba de todo una franja **"ANULADO"** con el motivo (y el detalle) y "Anulado el dd/MM/yyyy HH:mm por <nombre apellido>" (HU-42).
- El frontend no lo pide con `fetchJson`: lo enlaza con `<a href="/api/v1/pagos/{id}/pdf" target="_blank">` (`hrefComprobante`).

### Pagos realizados (HU-36)

**`GET /pagos?desde&hasta&alumnoId?&materiaId?&profesorId?&formaPago?&page&pageSize`** (`MESA_ENTRADAS`, `GERENTE`): los pagos con **fecha de pago** en el período, vigentes y anulados.

- `desde` y `hasta`: `YYYY-MM-DD`, **obligatorios**, extremos incluidos y **sin tope de días** (la UI manda el mes en curso por defecto). `hasta` no puede ser anterior a `desde`.
- `alumnoId`, `materiaId` y `profesorId` (opcionales): enteros positivos; `materiaId` es **una sola** materia. **La materia y el profesor se aplican a cada turno**, como en Cuentas: un pago aparece si tiene algún turno de esa materia o de ese profesor y, con los dos, si **un mismo turno** cumple los dos (decisión T-152). Un alumno, una materia o un profesor que no existen dan una lista vacía y los totales en 0: **no hay 404**.
- `formaPago` (opcional): `EFECTIVO`, `TRANSFERENCIA` o `DEBITO`, por el código, nunca por el nombre.
- `page` y `pageSize`: ver Listados paginados.
- Orden: del más reciente al más antiguo (`fechaPago` y, con la misma fecha, `id` descendentes).

Responde el formato de un listado paginado **más `totales`, junto a `data` y `meta`** (no dentro de `meta`, que no cambia), como `totalAdeudado` de `GET /cuentas/adeudados` (decisión T-151):

```json
{
  "data": [
    {
      "id": 33,
      "numeroComprobante": 1026,
      "fechaPago": "2026-10-06",
      "alumno": { "id": 12, "nombre": "Lucía", "apellido": "Álvarez" },
      "materias": [
        { "id": 7, "nombre": "Física" },
        { "id": 2, "nombre": "Matemática" }
      ],
      "cantidad": 4,
      "total": 34000,
      "formaPago": { "codigo": "TRANSFERENCIA", "nombre": "Transferencia" },
      "registradoPor": { "id": "usr_mesa_01", "nombre": "Laura", "apellido": "Gómez" },
      "estado": "VIGENTE",
      "anulacion": null
    },
    {
      "id": 31,
      "numeroComprobante": 1024,
      "fechaPago": "2026-10-05",
      "alumno": { "id": 14, "nombre": "Tomás", "apellido": "Pereyra" },
      "materias": [{ "id": 2, "nombre": "Matemática" }],
      "cantidad": 2,
      "total": 16000,
      "formaPago": { "codigo": "EFECTIVO", "nombre": "Efectivo" },
      "registradoPor": { "id": "usr_mesa_01", "nombre": "Laura", "apellido": "Gómez" },
      "estado": "ANULADO",
      "anulacion": { "motivo": "FORMA_PAGO_EQUIVOCADA", "detalle": "Fue por transferencia" }
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 2, "totalPages": 1 },
  "totales": {
    "cobrado": 34000,
    "porForma": { "EFECTIVO": 0, "TRANSFERENCIA": 34000, "DEBITO": 0 }
  }
}
```

- Cada pago (`PagoRealizado`): `materias` son las materias distintas de sus turnos, por nombre; `cantidad`, cuántos turnos incluye; `registradoPor`, un `UsuarioAuditoria`; `anulacion`, `{ motivo, detalle }` si está anulado y `null` si está vigente (quién lo anuló y cuándo están en el detalle).
- **Un pago anulado se lista, marcado con su `estado`, pero no suma.**
- `totales` es de **todo el filtro**, no sólo de la página, y **sólo de los pagos vigentes**: `porForma` tiene lo cobrado por cada forma de pago y `cobrado` es la suma de las tres. Con `formaPago`, las otras dos van en 0. Con `materiaId` o `profesorId`, cada pago listado suma su **total completo**, no sólo la parte de esa materia o profesor (decisión T-152). Es la misma definición de "cobrado" que el tablero.
- Sin pagos en el filtro: `data: []`, `meta.total: 0` y `totales` en 0. La UI muestra "No hay pagos en este período".

**Errores:** 400 `VALIDACION` si falta `desde` o `hasta` (en ese campo), si una fecha es inválida, si `hasta` es anterior a `desde` (en `["hasta"]`: "La fecha hasta no puede ser anterior a la fecha desde", el mismo mensaje que Cuentas), si un id no es un entero positivo, si `formaPago` no es uno de los tres códigos o si la paginación está fuera de rango; 401 sin sesión; 403 `SIN_PERMISO` con otro rol (también el alumno).

### Buscadores de los filtros (HU-36)

**`GET /pagos/alumnos?q?&id?`**, **`GET /pagos/profesores?q?&id?&alumnoId?`** y **`GET /pagos/materias?q?&id?&alumnoId?`** (`MESA_ENTRADAS`, `GERENTE`, selectores con filtros): las opciones de los filtros de alumno, profesor y materia de los pagos realizados. Son de `pagos` y no de `alumnos`, `profesores` ni `materias`, así el gerente filtra sin ver la ficha del alumno (decisión T-169).

- `/alumnos`: los alumnos con al menos un pago, vigente o anulado.
- `/profesores`: los profesores que dictan algún turno incluido en un pago, incluidos los dados de baja. Es el profesor **actual** del turno, con el mismo criterio que el filtro `profesorId` de `GET /pagos` y el comprobante (decisión T-63).
- `/materias`: las materias de algún turno incluido en un pago, incluidas las dadas de baja, con el mismo criterio que el filtro `materiaId` de `GET /pagos`.
- `q` (opcional): búsqueda por palabras, igual que `GET /alumnos` (ver Filtros): no distingue mayúsculas, tildes ni puntos. En alumnos también encuentra por DNI, aunque el DNI no se devuelve; en profesores busca sobre su usuario; en materias, sobre el nombre.
- `id` (opcional): sólo esa opción si cumple la condición, o `[]`. Es para que la UI muestre el nombre del filtro que viene en la URL. Con `q`, se combinan.
- `alumnoId` (opcional, sólo `/profesores` y `/materias`): sólo los de algún turno incluido en un pago de ese alumno (decisión T-170). La UI lo manda con el alumno de la ficha o el elegido en el filtro, en las opciones del menú; el nombre del elegido (`id`) se pide sin él.
- Respuesta: un arreglo sin paginar de hasta 20; alumnos y profesores por apellido y nombre (y `id`), materias por nombre (y `id`). Sin opciones, `200` con `[]`.

```json
[
  { "id": 12, "nombre": "Lucía", "apellido": "Álvarez" },
  { "id": 27, "nombre": "Martín", "apellido": "Alvear" }
]
```

- Cada opción de alumnos y profesores trae **sólo** `id`, `nombre` y `apellido`: ni DNI, ni foto, ni estado, ni auditoría. Las de materias, **sólo** `id` y `nombre`:

```json
[
  { "id": 2, "nombre": "Matemática" },
  { "id": 9, "nombre": "Matemática financiera" }
]
```

- **Errores:** 400 `VALIDACION` si `q` supera los 100 caracteres o `id` o `alumnoId` no es un entero positivo (en ese campo); 401 sin sesión; 403 `SIN_PERMISO` con otro rol (también profesor y alumno).

### Mis pagos (HU-37)

**`GET /pagos/mis-pagos?page&pageSize`** (`ALUMNO`, portal): los pagos del alumno de la sesión, vigentes y anulados, en el mismo orden que `GET /pagos` y paginados. **No recibe un `alumnoId`**: el alumno sale de la sesión, y un `alumnoId` en la query se ignora.

```json
{
  "data": [
    {
      "id": 33,
      "numeroComprobante": 1026,
      "fechaPago": "2026-10-06",
      "materias": [
        { "id": 7, "nombre": "Física" },
        { "id": 2, "nombre": "Matemática" }
      ],
      "cantidad": 4,
      "total": 34000,
      "formaPago": { "codigo": "TRANSFERENCIA", "nombre": "Transferencia" },
      "estado": "VIGENTE"
    },
    {
      "id": 30,
      "numeroComprobante": 1023,
      "fechaPago": "2026-09-28",
      "materias": [{ "id": 2, "nombre": "Matemática" }],
      "cantidad": 2,
      "total": 16000,
      "formaPago": { "codigo": "EFECTIVO", "nombre": "Efectivo" },
      "estado": "ANULADO"
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 2, "totalPages": 1 }
}
```

- Cada pago (`MiPago`): número de comprobante, fecha, materias, cantidad de turnos, total, forma de pago y `estado` (un anulado se ve marcado; sus turnos vuelven a figurar en `GET /cuentas/mi-cuenta`).
- **No trae** quién lo registró, el comprobante adjunto, el alumno, las observaciones ni el motivo de la anulación.
- No hay totales: lo pendiente está en `GET /cuentas/mi-cuenta`. El comprobante de cada pago se abre con `GET /pagos/{id}/pdf`.
- **Errores:** 400 si la paginación es inválida; 401 sin sesión; 403 `SIN_PERMISO` si el rol no es `ALUMNO` o la cuenta no tiene alumno.

## Cuentas

HU-16 (T-53, con los ajustes de la PO del 01/10: decisiones T-91 a T-96), varias materias (HU-25) y la cuenta del portal (HU-37), de la tarea T-101 (decisión T-146). Turnos adeudados y próximos turnos de un alumno, y las dos vistas globales con la misma estructura. Reglas en `dominio.md` → Deuda. **Los importes y los totales los calcula la API** con el precio por hora **vigente** de cada materia, leído en cada consulta: si el gerente cambia el precio, los impagos muestran el nuevo (lo ya pagado no cambia). El cliente sólo los muestra y, para el resumen de una selección, suma los que recibió.

| Endpoint                                 | Roles           | Qué hace                                                                         |
| ---------------------------------------- | --------------- | -------------------------------------------------------------------------------- |
| `GET /api/v1/cuentas/alumnos/{alumnoId}` | `MESA_ENTRADAS` | Adeudados y próximos del alumno, con el total adeudado. 404 si no existe         |
| `GET /api/v1/cuentas/adeudados`          | `MESA_ENTRADAS` | Adeudados de todos los alumnos (o de uno), paginados, con el total adeudado      |
| `GET /api/v1/cuentas/proximos`           | `MESA_ENTRADAS` | Próximos turnos de todos los alumnos (o de uno), paginados, con el tope de cobro |
| `GET /api/v1/cuentas/mi-cuenta`          | `ALUMNO`        | La cuenta del alumno de la sesión, agrupada por materia (portal)                 |

Cualquier otro rol recibe 403 `SIN_PERMISO`. El estado del alumno no importa: uno dado de baja puede deber.

**Filtros comunes a los tres (query, todos opcionales):**

- `desde`, `hasta`: período `YYYY-MM-DD`, extremos incluidos. Cada extremo es opcional y **no hay tope de días**. Si vienen los dos y `hasta` es anterior a `desde`: 400 `VALIDACION` con `details` sobre `hasta`.
- `materiaId`: **una o más materias**, repitiendo el parámetro (`?materiaId=2&materiaId=5`; HU-25). Con una sola, como siempre; sin `materiaId`, todas. Con varias, la respuesta trae los adeudados y los próximos de todas ellas (los próximos, hasta `limiteCobro`) en el orden de siempre, y `totalAdeudado` es su suma. Un id repetido cuenta una vez. Cada id es un entero positivo: si no, 400 `VALIDACION` con `path` `["materiaId", <posición>]`.
- `profesorId` (el profesor del bloque): entero positivo (400 si no).
- Si una materia o el profesor no existen, esa parte de la respuesta va vacía: **no hay 404**.

**El período y las secciones.** Las dos secciones nunca se mezclan: "hoy" las separa. Las fechas de corte las calcula la API; el cliente no las repite.

| Sección   | Sin período                            | Con período                                                                             | No aplica si…                             |
| --------- | -------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| Adeudados | Todos los impagos anteriores a hoy     | La parte del período anterior a hoy (nunca hoy ni después)                              | el período es sólo futuro: `desde` >= hoy |
| Próximos  | De hoy a `limiteCobro` (hoy + 56 días) | La parte del período entre hoy y `limiteCobro` (nunca antes de hoy ni después del tope) | el período es sólo pasado: `hasta` < hoy  |

- Una sección que **no aplica** no es lo mismo que una vacía: en la cuenta del alumno va `null` (y `[]` si aplica y no hay nada); en las vistas globales, `aplica: false` (y `aplica: true` con `data: []` si aplica y no hay nada).
- Si el período es futuro pero empieza después de `limiteCobro`, los próximos **aplican y quedan vacíos**: la UI avisa con `limiteCobro` hasta qué fecha se puede cobrar.
- `limiteCobro`: la última fecha que se puede cobrar por adelantado, la misma que usa `POST /pagos` (ver Pagos).
- `totalAdeudado`: la suma de los adeudados con **todos** los filtros (alumno, período, materia y profesor). Los próximos **nunca** suman, tampoco con un período futuro: en ese caso el total es 0.

**Una ocurrencia de la cuenta (`OcurrenciaDeCuenta`):**

```json
{
  "turnoId": 41,
  "fecha": "2026-09-28",
  "horaInicio": "09:00",
  "horaFin": "10:00",
  "materia": { "id": 2, "nombre": "Matemática" },
  "profesor": { "id": 3, "nombre": "Ana", "apellido": "Gómez" },
  "estado": "SIN_REGISTRAR",
  "importe": 8000
}
```

- Tiene los mismos campos que una ocurrencia del body de `POST /pagos` necesita para armarse (`turnoId`, `fecha`) y lo que muestra el diálogo de cobro: el frontend la pasa a `OcurrenciaACobrar` sin transformar nada.
- `estado`: `SIN_REGISTRAR` en los adeudados y `AGENDADO` en los próximos (código, no texto: "Sin registrar" lo pone la UI).
- `importe`: precio vigente de la materia en pesos, número JSON; `null` si la materia no tiene precio (no suma al total).

**Respuesta de `GET /cuentas/alumnos/{alumnoId}`:**

```json
{
  "totalAdeudado": 16000,
  "adeudados": [
    {
      "turnoId": 41,
      "fecha": "2026-09-21",
      "...": "...",
      "estado": "SIN_REGISTRAR",
      "importe": 8000
    },
    {
      "turnoId": 41,
      "fecha": "2026-09-28",
      "...": "...",
      "estado": "SIN_REGISTRAR",
      "importe": 8000
    }
  ],
  "proximos": [
    { "turnoId": 41, "fecha": "2026-10-05", "...": "...", "estado": "AGENDADO", "importe": 8000 }
  ],
  "limiteCobro": "2026-11-26"
}
```

Con un período sólo pasado (`?desde=2026-09-01&hasta=2026-09-30`), `"proximos": null`; con uno sólo futuro, `"adeudados": null` y `"totalAdeudado": 0`.

- `adeudados`: ocurrencias anteriores a hoy, sin registrar (no canceladas) e impagas, del más antiguo al más reciente (fecha, hora de inicio y `turnoId`). `null` si la sección no aplica al período.
- `proximos`: ocurrencias agendadas e impagas de hoy a `limiteCobro`, de series y sesiones únicas, en el mismo orden. Es exactamente lo que `POST /pagos` acepta cobrar hacia adelante (el mismo tope, ver Pagos). No suman a la deuda. `null` si la sección no aplica al período.
- `totalAdeudado`: suma de los importes de `adeudados` (los `null` no suman); 0 si `adeudados` es `null`.
- `limiteCobro`: siempre viene, haya o no período.
- La cuenta **no** trae el historial de pagos ni lo pagado en el mes (decisión T-95). El comprobante de un pago se sigue leyendo con `GET /pagos/{pagoId}`.

**`GET /cuentas/adeudados`:** query `page` y `pageSize` (Listados paginados), `alumnoId` opcional (entero positivo; 400 si no, 404 si el alumno no existe) y los filtros comunes. Responde el formato de un listado paginado **más `totalAdeudado` y `aplica`, junto a `data` y `meta`** (no dentro de `meta`, que no cambia):

```json
{
  "data": [
    {
      "turnoId": 41,
      "fecha": "2026-09-21",
      "horaInicio": "09:00",
      "horaFin": "10:00",
      "materia": { "id": 2, "nombre": "Matemática" },
      "profesor": { "id": 3, "nombre": "Ana", "apellido": "Gómez" },
      "estado": "SIN_REGISTRAR",
      "importe": 8000,
      "alumno": { "id": 12, "nombre": "Lucía", "apellido": "Álvarez", "dni": "52345678" }
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 37, "totalPages": 4 },
  "totalAdeudado": 296000.5,
  "aplica": true
}
```

- Los mismos adeudados que la cuenta del alumno, de todos los alumnos (o del filtrado), del más antiguo al más reciente. Cada fila es una `OcurrenciaDeCuenta` más `alumno` (`OcurrenciaDeCuentaGlobal`).
- `totalAdeudado` es la suma de **todos** los adeudados del filtro, no sólo de la página: coincide con la suma de los importes de todas las páginas, con el `totalAdeudado` de la cuenta del alumno con los mismos filtros (si se manda `alumnoId`) y con el total adeudado del tablero (T-61).
- `aplica: false` (período sólo futuro): `data: []`, `meta.total: 0`, `meta.totalPages: 0` y `totalAdeudado: 0`.

**`GET /cuentas/proximos`:** el mismo query que los adeudados (404 si `alumnoId` no existe). Responde el formato de un listado paginado **más `aplica` y `limiteCobro`**, sin `totalAdeudado` (los próximos no son deuda):

```json
{
  "data": [
    {
      "turnoId": 41,
      "fecha": "2026-10-05",
      "horaInicio": "09:00",
      "horaFin": "10:00",
      "materia": { "id": 2, "nombre": "Matemática" },
      "profesor": { "id": 3, "nombre": "Ana", "apellido": "Gómez" },
      "estado": "AGENDADO",
      "importe": 8000,
      "alumno": { "id": 12, "nombre": "Lucía", "apellido": "Álvarez", "dni": "52345678" }
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 9, "totalPages": 1 },
  "aplica": true,
  "limiteCobro": "2026-11-26"
}
```

- Los mismos próximos que la cuenta del alumno, de todos los alumnos (o del filtrado), por fecha, hora de inicio y `turnoId`. La misma fila que los adeudados (`OcurrenciaDeCuentaGlobal`).
- `aplica: false` (período sólo pasado): `data: []`, `meta.total: 0` y `meta.totalPages: 0`. `limiteCobro` viene igual.

**Seleccionar todo (HU-25).** Para cobrar una o varias materias completas, se eligen en el filtro de materia y se seleccionan los adeudados y los próximos que trae la cuenta del alumno (`GET /cuentas/alumnos/{alumnoId}`, sin paginar). En la vista global se usa la misma cuenta, con los mismos filtros (decisión T-102). No hay filtro por meses ni por tipo de turno. Si la selección supera el máximo de un pago, `POST /pagos` responde 400 `VALIDACION` en `ocurrencias`: "No se pueden cobrar más de 200 turnos en un pago" (ver Pagos).

**`GET /cuentas/mi-cuenta`** (`ALUMNO`, portal, HU-37): la cuenta del alumno de la sesión, sin filtros ni query. Es la misma lectura que `GET /cuentas/alumnos/{alumnoId}` sin filtros: **los mismos importes y el mismo `totalAdeudado`** que ve mesa de entradas. `adeudados` y `proximos` van **agrupados por materia**, con su subtotal:

```json
{
  "totalAdeudado": 25000.5,
  "adeudados": [
    {
      "materia": { "id": 7, "nombre": "Física" },
      "subtotal": 9000.5,
      "ocurrencias": [{ "turnoId": 57, "fecha": "2026-09-23", "...": "...", "importe": 9000.5 }]
    },
    {
      "materia": { "id": 2, "nombre": "Matemática" },
      "subtotal": 16000,
      "ocurrencias": [
        { "turnoId": 41, "fecha": "2026-09-21", "...": "...", "importe": 8000 },
        { "turnoId": 41, "fecha": "2026-09-28", "...": "...", "importe": 8000 }
      ]
    }
  ],
  "proximos": [
    {
      "materia": { "id": 2, "nombre": "Matemática" },
      "subtotal": 8000,
      "ocurrencias": [{ "turnoId": 41, "fecha": "2026-10-05", "...": "...", "estado": "AGENDADO" }]
    }
  ],
  "limiteCobro": "2026-11-26"
}
```

- Cada ocurrencia es una `OcurrenciaDeCuenta` (fecha, horario, materia, profesor, estado e importe).
- **Los grupos** van por nombre de materia y, dentro de cada uno, las ocurrencias por fecha, hora de inicio y `turnoId`. `subtotal` es la suma de los importes del grupo (los `null` no suman).
- **`totalAdeudado`** es la suma de los subtotales de `adeudados`. Los próximos nunca suman.
- **Sin nada pendiente:** `totalAdeudado: 0`, `adeudados: []` y `proximos: []`. Las dos secciones siempre aplican, porque no hay período.
- **Errores:** 401 sin sesión; 403 `SIN_PERMISO` si el rol no es `ALUMNO` o la cuenta no tiene alumno. El alumno recibe 403 en los otros tres endpoints de Cuentas.

## Exámenes

Carga de exámenes de un alumno (HU-17, T-55), de la que depende la prioridad de los turnos (HU-18, `examenes.condiciones.ts`, T-31). Roles: `MESA_ENTRADAS` y `PROFESOR` en los cinco endpoints (y en la carga de la nota); `ALUMNO` en `mis-examenes`. "Eliminar" un examen es darlo de baja (`PATCH /{id}/baja`): nada se borra.

**`GET /api/v1/examenes?alumnoId`**: exámenes `ACTIVO` del alumno, separados en `proximos` (fecha de hoy en adelante, orden ascendente, con `diasRestantes`) y `pasados` (sin `diasRestantes`). Cada uno trae su materia y la auditoría **con el rol** (`MESA_ENTRADAS` o `PROFESOR`) de quien lo cargó y de quien lo modificó por última vez, y `administrable`: si quien consulta puede editarlo y darlo de baja (mesa de entradas, siempre; el profesor, sólo los de las materias que le dicta a ese alumno). El front muestra editar y eliminar según ese campo.

```json
{
  "proximos": [
    {
      "id": 5,
      "materia": { "id": 3, "nombre": "Matemática" },
      "fecha": "2026-10-15",
      "observaciones": "Trae calculadora y formulario",
      "pasado": false,
      "diasRestantes": 10,
      "administrable": true,
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

**`GET /api/v1/examenes/materias?alumnoId`**: materias ofrecibles para cargarle un examen **nuevo** a ese alumno: las activas en las que el alumno tiene algún turno **vigente** (al menos una fecha no cancelada de hoy en adelante; `contarVigentesPorMateria` con `alumnoId`), por nombre. Mesa de entradas: las de todos sus turnos. Profesor: sólo las de los turnos que el alumno tiene con él (si el profesor dicta Matemática y Física y el alumno tiene turnos de Matemática con él y de Química con otro, ve sólo Matemática; mesa de entradas ve Matemática y Química). Sin turnos próximos, la lista viene vacía y el front muestra "El alumno no tiene turnos próximos". Al editar, el front suma la materia del propio examen aunque ya no sea ofrecible.

**`POST /api/v1/examenes`**: `{ alumnoId, materiaId, fecha, observaciones? }`. Un examen no tiene tipo (decisión T-170: no hay parcial, final ni trabajo práctico); `observaciones`, hasta 500 caracteres. Devuelve el detalle (`201`), con `pasado: true` si `fecha` ya pasó (se acepta igual, es sólo un aviso del front).

**`PATCH /api/v1/examenes/{id}`**: edición parcial de `materiaId`, `fecha` y `observaciones` (sin `alumnoId`: un examen no cambia de alumno). Si cambia `materiaId` o `fecha`, se vuelve a chequear el examen pendiente de la materia resultante, sin contar este examen.

**`PATCH /api/v1/examenes/{id}/baja`**: baja lógica ("eliminar" en la HU, con confirmación del front). Sin body.

- Reglas del alta y la edición:
  - Materia inexistente → 404; inactiva → 409 `MATERIA_INACTIVA`.
  - **Materia con turnos:** al cargar, la materia tiene que ser una de las ofrecibles (`GET /examenes/materias`); si el alumno no tiene turnos vigentes en ella (para el profesor, con él) → 409 `MATERIA_SIN_TURNOS`, con `[{ "path": ["materiaId"], "message" }]`. Al editar se chequea sólo si `materiaId` cambia a otra materia: la que el examen ya tenía se conserva aunque el alumno ya no tenga turnos en ella.
  - **Un examen pendiente por materia:** si el alumno ya tiene un examen `ACTIVO` con fecha `>= hoy` en la misma materia → 409 `EXAMEN_PENDIENTE`, con el existente (`{ id, fecha }`, sin arreglo) en `details`, para ofrecer editarlo. Un examen pasado no cuenta: después de la fecha, se puede cargar el siguiente.
  - **Profesor:** sólo puede cargar, editar o dar de baja un examen de una materia que le dicta a ese alumno; si no, 403 `SIN_PERMISO`.
- Errores comunes a los cinco endpoints: 401 `NO_AUTENTICADO`; 403 `SIN_PERMISO` para cualquier rol que no sea `MESA_ENTRADAS` o `PROFESOR`, o un usuario inhabilitado.

### Nota del examen (HU-34, T-106)

**`PATCH /api/v1/examenes/{id}/nota`** (`MESA_ENTRADAS`; `PROFESOR` con las reglas de HU-17): carga o corrige la nota, con las mismas reglas. Body `{ "resultado": "CON_NOTA", "nota": 7.5 }` o `{ "resultado": "AUSENTE" }`. Devuelve el detalle del examen (`200`).

- `CON_NOTA`: `nota` obligatoria, de 1 a 10 con hasta dos decimales (400 en `nota`). `AUSENTE`: sin `nota` (400 en `nota` si viene) y no cuenta para los promedios.
- Sólo un examen **ya rendido** (fecha hoy o anterior): uno futuro → 409 `EXAMEN_FUTURO` ("Un examen futuro no admite nota"). Inexistente → 404. El profesor sólo puede cargarla en una materia que le dicta a ese alumno (403).
- La nota tiene **su propia trazabilidad**, con el rol, como la del examen: `notaCreatedBy` / `notaCreatedAt` (quién la cargó y cuándo) y `notaUpdatedBy` / `notaUpdatedAt` (quién la modificó por última vez). Cargarla o corregirla no cambia la auditoría del examen.
- Las observaciones se siguen editando con `PATCH /examenes/{id}`.

**En `GET /examenes?alumnoId`** (y en el detalle que devuelven los `PATCH`), cada examen suma `resultado` (`CON_NOTA`, `AUSENTE` o `null`), `nota` (número o `null`) y su trazabilidad (`notaCreatedBy`, `notaCreatedAt`, `notaUpdatedBy`, `notaUpdatedAt`, `null` si no se cargó). El ítem del listado suma además `cargarNota`: si quien consulta puede cargarla (ya rendido y `administrable`; un examen de hoy está en `proximos` y ya admite nota). La respuesta suma `rendidosSinNota`, para "2 exámenes rendidos sin nota". El profesor sigue viendo todos los exámenes del alumno y sólo carga la nota de los suyos (HU-31).

**`GET /api/v1/examenes/mis-examenes?materiaId`** (`ALUMNO`, portal, HU-35): el alumno sale de la sesión. Sin observaciones ni auditoría.

```json
{
  "proximo": { "fecha": "2026-10-22", "diasRestantes": 8 },
  "rendidos": [
    { "fecha": "2026-10-01", "resultado": "CON_NOTA", "nota": 7.5 },
    { "fecha": "2026-09-20", "resultado": "AUSENTE", "nota": null },
    { "fecha": "2026-09-05", "resultado": "CON_NOTA", "nota": 9 }
  ],
  "promedio": 8.25
}
```

- `proximo`: el próximo examen de la materia (a lo sumo uno), con los días que faltan, o `null`.
- `rendidos`: del más reciente al más antiguo; un examen de hoy pasa a rendidos cuando tiene nota. `resultado` `null` es "Sin nota".
- `promedio`: de las notas (`CON_NOTA`), sin los ausentes ni los sin nota, con dos decimales; `null` si no hay.
- Una materia sin exámenes del alumno responde todo vacío. 403 `SIN_PERMISO` para cualquier rol que no sea `ALUMNO` o una cuenta sin alumno.

## Tablero

HU-21 (T-61, decisiones T-112 a T-119), HU-39 (T-112, decisión T-162) y HU-47 (T-128, decisión T-169). Indicadores del centro para el gerente, en tres secciones: **General** (`GET /tablero`), **Asistencia** (`GET /tablero/asistencia`) y **Finanzas** (`GET /tablero/finanzas`), cada una con su PDF (`GET /tablero/pdf?seccion=`). **Sólo lectura y sólo agregados:** no devuelve datos de un alumno, un pago ni una agenda puntual, y todo se calcula al consultarlo (nada se guarda). Las definiciones de negocio están en `dominio.md` → Tablero.

**Período común.** Los cuatro endpoints reciben el mismo período y lo validan igual:

- `desde`, `hasta`: período `YYYY-MM-DD`, extremos incluidos, **los dos obligatorios** (la UI traduce "Hoy", "Esta semana", "Este mes" o un rango a estas dos fechas).
- 400 `VALIDACION` si falta alguno o no es una fecha real (`details` en su campo), y con `details` sobre `hasta` si `hasta` es anterior a `desde` ("La fecha hasta no puede ser anterior a la fecha desde") o si el período supera los **366 días**, extremos incluidos ("El período no puede superar los 366 días").
- Errores: 401 `NO_AUTENTICADO`; 403 `SIN_PERMISO` para cualquier rol que no sea `GERENTE`.
- **Porcentajes:** número JSON de 0 a 100 redondeado a **un decimal** (1 de 3 → `33.3`), sin `%`; `0` si la base es 0. No se ajustan para que sumen 100 (tres tercios dan 99.9). Los importes van en pesos como número JSON, sin formato.

### General

**`GET /api/v1/tablero?desde&hasta`** — rol `GERENTE`.

```json
{
  "periodo": { "desde": "2026-09-28", "hasta": "2026-10-04" },
  "hoy": "2026-10-02",
  "turnos": {
    "total": 48,
    "cancelados": { "cantidad": 6, "porcentaje": 12.5 },
    "sinRegistrar": { "cantidad": 6, "porcentaje": 12.5 },
    "agendados": { "cantidad": 16, "porcentaje": 33.3 },
    "asistio": { "cantidad": 17, "porcentaje": 85 },
    "noAsistio": { "cantidad": 3, "porcentaje": 15 }
  },
  "ocupacion": { "turnos": 42, "capacidad": 64, "porcentaje": 65.6 },
  "alumnos": { "nuevos": 3, "atendidos": 14 },
  "materiasConMasDemanda": [
    { "materia": { "id": 2, "nombre": "Matemática" }, "cantidad": 15 },
    { "materia": { "id": 7, "nombre": "Física" }, "cantidad": 9 }
  ],
  "profesoresConMasTurnos": [
    { "profesor": { "id": 3, "nombre": "Ana", "apellido": "Gómez" }, "cantidad": 14 },
    { "profesor": { "id": 5, "nombre": "Luis", "apellido": "Pérez" }, "cantidad": 11 }
  ],
  "pagos": {
    "totalCobrado": 96000,
    "cobradoPorForma": { "EFECTIVO": 40000, "TRANSFERENCIA": 38000, "DEBITO": 18000 },
    "totalAdeudado": 296000.5
  }
}
```

- `periodo`: el período pedido. `hoy`: la fecha de hoy en la zona del negocio con la que se calculó toda la respuesta; es la fecha de `pagos.totalAdeudado` y la que separa "sin registrar" de "agendados".
- `turnos.total`: ocurrencias del período, **incluidas las canceladas**. `cancelados`, `sinRegistrar` y `agendados` traen `cantidad` y `porcentaje` sobre `total`. `sinRegistrar` son los pasados sin asistencia registrada (los que todavía están dentro del plazo y los que cerró el sistema); los que ya tienen asistencia no están en ninguno de los tres, sino en `asistio` y `noAsistio`.
- **`turnos.agendados` es `null`** si el período no incluye fechas futuras (`hasta` anterior a `hoy`): la UI no muestra el indicador. Si `hasta` es hoy o posterior viene con su cantidad, que puede ser 0.
- **Asistencia** (HU-22, decisión T-162, reemplaza a T-116): `turnos.asistio` (asistencia "Presente", estado `REALIZADO`) y `turnos.noAsistio` (asistencia "Ausente", estado `AUSENTE`) traen `cantidad` y `porcentaje` **sobre los turnos con asistencia registrada** (`asistio` + `noAsistio`), **no sobre `turnos.total`**: los dos porcentajes suman 100 (salvo el redondeo) y, sin ninguna asistencia registrada, ambos son `{ cantidad: 0, porcentaje: 0 }`. `alumnos.atendidos` es un entero: los alumnos **distintos** con al menos un turno `REALIZADO` en el período.
- `ocupacion`: `turnos` son las ocurrencias no canceladas del período y `capacidad` la suma de la capacidad efectiva de cada **clase** (una hora de un bloque en una fecha con al menos un turno no cancelado; las horas sin turnos no cuentan). `ocupacion.turnos` es lo mismo que `cupo.ocupados` de las agendas, sumado sobre todas las clases del período, y `capacidad` lo mismo que `cupo.capacidad`. El `porcentaje` **no se recorta a 100**: si a un profesor o a un aula le bajaron la capacidad, puede superarlo.
- `alumnos.nuevos`: alumnos dados de alta en el período (en hora de Salta), aunque después se hayan dado de baja.
- `profesoresConMasTurnos` (decisión T-121): hasta 5, por cantidad de turnos **no cancelados** del período en sus horas, es decir, por alumnos con turno con ese profesor; descendente y, en empate, por apellido, nombre y `id`. Trae `{ id, nombre, apellido }` del profesor y nunca datos de sus alumnos. `[]` si no hay ninguno.
- `materiasConMasDemanda`: hasta 5, por cantidad de turnos **no cancelados** del período, descendente; en empate, por nombre y después por `id`. `[]` si no hay ninguno.
- `pagos.totalCobrado`: suma de los pagos **vigentes** (los anulados no suman) con **fecha de pago** dentro del período.
- **`pagos.cobradoPorForma`** (HU-23, HU-39): ese mismo total separado por forma de pago, con las tres claves siempre presentes (`EFECTIVO`, `TRANSFERENCIA`, `DEBITO`; la forma se decide por su código, nunca por el nombre) y `0` en la que no tuvo cobros. Es el mismo filtro que `totalCobrado` (sólo pagos vigentes, por fecha de pago): las tres suman `totalCobrado`.
- **`pagos.totalAdeudado` es la deuda a la fecha (`hoy`), no la del período**: no cambia al cambiar `desde` y `hasta`, y coincide con el `totalAdeudado` de `GET /cuentas/adeudados` sin filtros (misma implementación, ver Cuentas).

### Asistencia

**`GET /api/v1/tablero/asistencia?desde&hasta&paginaProfesores&paginaMaterias&orden&direccion&soloSinRegistrar`** — rol `GERENTE` (HU-39, T-112, decisión T-162). La pestaña "Asistencia": un resumen y dos tablas. **Sólo agregados por centro, profesor y materia: nunca un alumno con nombre.**

- `desde`, `hasta`: el período común (arriba).
- `paginaProfesores`, `paginaMaterias`: página de cada tabla (entero ≥ 1, por defecto `1`). Las dos tablas son **de a 10 filas** y no hay `pageSize`. Cada una tiene su página: cambiar la de profesores no mueve la de materias. Una página pasada del final devuelve `data: []` con su `meta`.
- `orden`: columna por la que se ordena **la tabla de profesores**: `profesor` (apellido y nombre), `clasesRealizadas`, `ausencias`, `porcentajeAsistencia`, `cerradosSinRegistrar` (por defecto), `dentroDelPlazo` o `porcentajeSinRegistrar`. `direccion`: `asc` o `desc` (por defecto `desc`). En empate, siempre apellido, nombre e `id` ascendentes, así el orden es estable entre páginas. La tabla de materias no se reordena.
- `soloSinRegistrar`: `true` o `false` (por defecto, `false`). Con `true`, la tabla de profesores trae sólo a los que tienen `noRegistraAsistencia`. **No cambia el resumen ni la tabla de materias**, que son siempre los del período entero.
- 400 `VALIDACION` además por una página que no es un entero ≥ 1 y por un `orden`, una `direccion` o un `soloSinRegistrar` que no existen (`details` en su campo).

```json
{
  "periodo": { "desde": "2026-09-28", "hasta": "2026-10-04" },
  "hoy": "2026-10-02",
  "resumen": {
    "porcentajeAsistencia": 85,
    "cerradosSinRegistrar": 5,
    "profesoresSinRegistrar": 2,
    "alumnosBajoElUmbral": 3
  },
  "profesores": {
    "data": [
      {
        "profesor": { "id": 5, "nombre": "Luis", "apellido": "Pérez" },
        "clasesRealizadas": 6,
        "ausencias": 1,
        "porcentajeAsistencia": 85.7,
        "cerradosSinRegistrar": 3,
        "dentroDelPlazo": 1,
        "porcentajeSinRegistrar": 27.3,
        "noRegistraAsistencia": true
      }
    ],
    "meta": { "page": 1, "pageSize": 10, "total": 1, "totalPages": 1 }
  },
  "materias": {
    "data": [
      {
        "materia": { "id": 2, "nombre": "Matemática" },
        "clasesRealizadas": 8,
        "ausencias": 1,
        "porcentajeAsistencia": 88.9,
        "cerradosSinRegistrar": 3,
        "dentroDelPlazo": 1,
        "porcentajeSinRegistrar": 23.1
      }
    ],
    "meta": { "page": 1, "pageSize": 10, "total": 1, "totalPages": 1 }
  }
}
```

- `hoy`: la fecha con la que se calculó la respuesta; separa los turnos cerrados de los que están dentro del plazo (plazo de 7 días, ver Asistencias).
- `resumen` (los números principales):
  - `porcentajeAsistencia`: asistencia del centro, los turnos `REALIZADO` sobre los que tienen asistencia registrada (`REALIZADO` + `AUSENTE`).
  - `cerradosSinRegistrar`: turnos del período que cerró el sistema como "Sin registrar" (pasaron los 7 días sin que el profesor los registrara).
  - `profesoresSinRegistrar`: profesores con al menos un turno cerrado sin registrar en el período (lo mismo que cuenta `noRegistraAsistencia`).
  - `alumnosBajoElUmbral`: alumnos con **menos de 75 %** de asistencia, entre los que tienen algún turno con asistencia registrada en el período. **Sólo la cantidad:** el umbral es estricto (75 % justo no cuenta) y los alumnos sin ningún registro no entran.
- `profesores`: un profesor por fila, sólo los que tienen turnos **no cancelados** en el período. `clasesRealizadas` son los turnos con asistencia "Presente" (cada hora de un alumno cuenta como un turno), `ausencias` los de "Ausente", `porcentajeAsistencia` las clases sobre ambos, `cerradosSinRegistrar` los que cerró el sistema, `dentroDelPlazo` los "Sin registrar" que todavía se pueden registrar y `porcentajeSinRegistrar` los cerrados sobre los turnos **no cancelados** del profesor en el período (los agendados están en la base). `noRegistraAsistencia` es `true` con al menos un cerrado: la UI muestra el distintivo "No registra asistencia". Orden por defecto: `cerradosSinRegistrar` de mayor a menor.
- `materias`: las mismas cifras agrupadas por materia (sin `noRegistraAsistencia`: no es una persona que registre). Orden fijo: `cerradosSinRegistrar` de mayor a menor y, en empate, nombre e `id`.
- Los cancelados no cuentan en ninguna cifra. Con todo en 0 (por ejemplo, un período sin turnos), los porcentajes son `0` y las tablas, `[]`.

### Finanzas

**`GET /api/v1/tablero/finanzas?desde&hasta&page&orden&direccion`** — rol `GERENTE` (HU-47, T-128, decisión T-169). La pestaña "Finanzas": cuánto se cobró, cuánto le queda al centro y cuánto se les pagó y se les debe a los profesores. **Sólo agregados por centro, profesor y mes: nunca un alumno ni un pago puntual.** Los pagos anulados no suman en ningún número. Los repartos, el devengo y los saldos salen del motor de liquidaciones (`convenciones-backend.md` → Liquidaciones): el tablero no los recalcula.

- `desde`, `hasta`: el período común (arriba).
- `page`: página de la tabla por profesor (entero ≥ 1, por defecto `1`), **de a 10 filas**, sin `pageSize`. Una página pasada del final devuelve `data: []` con su `meta`.
- `orden`: columna por la que se ordena la tabla por profesor: `profesor` (apellido y nombre), `turnosCobrados`, `totalCobrado` (por defecto), `parteCentro`, `parteProfesor`, `pagado` o `saldoPendiente`. `direccion`: `asc` o `desc` (por defecto `desc`). En empate, siempre apellido, nombre e `id` ascendentes. La evolución no se reordena.
- 400 `VALIDACION` además por una `page` que no es un entero ≥ 1 y por un `orden` o una `direccion` que no existen (`details` en su campo).

```json
{
  "periodo": { "desde": "2026-10-01", "hasta": "2026-10-31" },
  "hoy": "2026-10-15",
  "resumen": {
    "totalCobrado": 128000,
    "margenCentro": { "importe": 26000, "porcentaje": 20.3 },
    "incluyeSinRegistrar": 8000,
    "pagadoAProfesores": 40800,
    "saldoAPagarAProfesores": 47600
  },
  "profesores": {
    "data": [
      {
        "profesor": { "id": 3, "nombre": "Ana", "apellido": "Gómez" },
        "turnosCobrados": 10,
        "totalCobrado": 80000,
        "parteCentro": 12000,
        "parteProfesor": 68000,
        "pagado": 40800,
        "saldoPendiente": 27200
      },
      {
        "profesor": { "id": 5, "nombre": "Luis", "apellido": "Pérez" },
        "turnosCobrados": 6,
        "totalCobrado": 48000,
        "parteCentro": 14000,
        "parteProfesor": 34000,
        "pagado": 0,
        "saldoPendiente": 20400
      },
      {
        "profesor": { "id": 8, "nombre": "Marta", "apellido": "Ruiz" },
        "turnosCobrados": 0,
        "totalCobrado": 0,
        "parteCentro": 0,
        "parteProfesor": 0,
        "pagado": 0,
        "saldoPendiente": -6800
      }
    ],
    "meta": { "page": 1, "pageSize": 10, "total": 3, "totalPages": 1 }
  },
  "evolucion": [
    { "mes": "2026-05", "totalCobrado": 0, "margenCentro": 0, "pagadoAProfesores": 0 },
    { "mes": "2026-06", "totalCobrado": 64000, "margenCentro": 9600, "pagadoAProfesores": 0 },
    { "mes": "2026-07", "totalCobrado": 96000, "margenCentro": 14400, "pagadoAProfesores": 54400 },
    { "mes": "2026-08", "totalCobrado": 112000, "margenCentro": 16800, "pagadoAProfesores": 81600 },
    { "mes": "2026-09", "totalCobrado": 104000, "margenCentro": 23600, "pagadoAProfesores": 95200 },
    { "mes": "2026-10", "totalCobrado": 128000, "margenCentro": 26000, "pagadoAProfesores": 40800 }
  ]
}
```

- `hoy`: la fecha con la que se calculó la respuesta: la del saldo a pagar y la que decide qué turnos cobrados quedaron cerrados sin registrar (plazo de 7 días, ver Asistencias).
- `resumen` (los números principales):
  - `totalCobrado`: suma de los pagos vigentes con **fecha de pago** dentro del período. **Es el mismo número que `pagos.totalCobrado` de `GET /tablero`** (misma implementación).
  - `margenCentro.importe`: la parte del centro de los turnos cobrados en el período (cada uno al porcentaje que guardó su cobro) **más el importe completo** de los turnos cobrados que el sistema cerró sin registrar (no se le deben al profesor, ver Liquidaciones). La parte del centro de un cerrado no se suma aparte: el cerrado cuenta una sola vez, entero. `margenCentro.porcentaje`: `importe` sobre `totalCobrado` (0 si `totalCobrado` es 0).
  - `incluyeSinRegistrar`: cuánto de `margenCentro.importe` son esos turnos cerrados sin registrar (su importe completo); `0` si no hay. Con un valor mayor a 0, la UI muestra "Incluye $ 13.600 de turnos sin asistencia registrada".
  - `pagadoAProfesores`: suma del `total` de las liquidaciones **pagadas** con **fecha de transferencia** dentro del período (los importes guardados al pagar). Las descontadas no son transferencias y no entran.
  - `saldoAPagarAProfesores`: lo que se les debe a los profesores **a hoy**, sin período (como `pagos.totalAdeudado` de General): la suma de los `saldoPendiente` **positivos** de la tabla completa. Un profesor con saldo negativo **no lo resta**.
- `profesores`: un profesor por fila, de a 10, activo o inactivo, con alguna cifra distinta de 0: cobros o pagos en el período o saldo a hoy. `turnosCobrados` y `totalCobrado` son los turnos de sus horas cobrados en el período (por fecha de pago) y su importe; `parteCentro` y `parteProfesor` su reparto, con la misma regla del margen: **un turno cerrado sin registrar va entero a `parteCentro`** (y 0 a `parteProfesor`). Así, la suma de `parteCentro` de la tabla completa es `resumen.margenCentro.importe` y `parteCentro + parteProfesor = totalCobrado` en cada fila. `pagado`: sus liquidaciones pagadas con fecha de transferencia en el período. `saldoPendiente`: lo que se le debe a hoy (el mismo de Liquidaciones), **que puede ser negativo** (un saldo a descontar). Orden por defecto: `totalCobrado` de mayor a menor.
- `evolucion`: siempre **6 filas**, los meses `YYYY-MM` que terminan en el de `hasta`, del más viejo al más nuevo (cruzan el cambio de año), sin paginar. Cada una con `totalCobrado` y `margenCentro` (por fecha de pago, con la misma regla del margen) y `pagadoAProfesores` (por fecha de transferencia). Los meses anteriores son completos; **el último llega hasta `hasta`**, no hasta fin de mes. Un mes sin movimientos va en 0.

### PDF

**`GET /api/v1/tablero/pdf?desde&hasta&seccion`** (rol `GERENTE`, decisiones T-130 y T-162): una sección del tablero como documento oficial en PDF, con el contrato común de [Documentos PDF](#documentos-pdf). Mismo período, mismas reglas y mismos errores 400, 401 y 403 que los otros endpoints, y los mismos números que el JSON de la sección (sale del mismo cálculo, no hay un segundo).

- `seccion`: `general` (por defecto, así el enlace anterior a las secciones sigue funcionando), `asistencia` o `finanzas`. 400 `VALIDACION` con `details` sobre `seccion` si es otra.
- **`general`** (reemplaza al PDF de HU-21): una hoja A4 con el encabezado del centro, un título según el período (`Tablero semanal` si va de lunes a domingo, `Tablero diario` si es un día, `Tablero mensual` si es un mes completo y `Tablero del período` en otro caso; es también el título del PDF) y debajo, de qué día a qué día son los datos (`Datos del lunes 28/09/2026 al domingo 04/10/2026`). Primero los pagos (total cobrado del período, con lo cobrado por forma de pago, y total adeudado a la fecha `hoy`), después los turnos del período (torta de activos y cancelados), la ocupación de las clases (lugares ocupados y libres), la asistencia (asistió y no asistió, con su porcentaje) con los alumnos atendidos y nuevos, y al final las materias y los profesores con más turnos en barras.
- **`asistencia`**: el título es `Asistencia semanal`, `Asistencia diaria`, `Asistencia mensual` o `Asistencia del período` (según el período, igual que el de General) y debajo, de qué día a qué día son los datos. Trae los números principales del `resumen` y las **tablas completas** de profesores y de materias: **todas las filas** (sin las páginas de la pantalla y sin el filtro `soloSinRegistrar`), en el orden por defecto (cerrados sin registrar de mayor a menor), repitiendo el encabezado de la tabla en cada hoja, así que ocupa las hojas que hagan falta. Sin ningún dato de los alumnos. La tabla de profesores marca con "No registra" a los que tienen turnos cerrados sin registrar.
- **`finanzas`**: el título es `Finanzas semanal`, `Finanzas diaria`, `Finanzas mensual` o `Finanzas del período` y debajo, de qué día a qué día son los datos. Trae los cuatro números del `resumen` (el margen con su porcentaje y, si `incluyeSinRegistrar` es mayor a 0, "Incluye $ … de turnos sin asistencia registrada"; el saldo con la fecha de hoy), la tabla por profesor **completa** (todas las filas, sin las páginas de la pantalla, en el orden por defecto, repitiendo el encabezado en cada hoja) y la evolución de los 6 meses.
- **Nombre del archivo:** `tablero-<desde>_<hasta>.pdf` para General (`tablero-2026-09-28_2026-10-04.pdf`), `tablero-asistencia-<desde>_<hasta>.pdf` para Asistencia y `tablero-finanzas-<desde>_<hasta>.pdf` para Finanzas.

## Centro

Los datos del centro (HU-11, HU-15, T-64): son los que el backend pone en el encabezado de los documentos PDF (ver [Documentos PDF](#documentos-pdf)). El frontend no los pide para eso, pero los endpoints son parte del contrato. Son constantes del backend, sin tabla: no hay pantalla para editarlos (definición G de las PO). Roles: `MESA_ENTRADAS`, `PROFESOR` y `GERENTE`.

**`GET /api/v1/centro`** (`MESA_ENTRADAS`, `PROFESOR`, `GERENTE` y, desde T-91, `ALUMNO`: el teléfono del aviso del portal): `{ "nombre", "direccion", "telefono" }`, los tres `string`. `nombre` es el de la organización que emite los documentos (Nexo Académico), no el del sistema (Aula Click).

```json
{
  "nombre": "Nexo Académico",
  "direccion": "Los Tarcos 300, Tres Cerritos",
  "telefono": "3875631032"
}
```

- Errores: 401 `NO_AUTENTICADO`; 403 `SIN_PERMISO` para cualquier rol que no sea uno de los tres.

**`GET /api/v1/centro/logo`**: la imagen del logo (`image/svg+xml`), con `Cache-Control` largo (`public, max-age=604800`): no hay pantalla para reemplazarlo, así que no hace falta revalidar seguido. Se lee de un archivo de la propia feature (`src/server/features/centro/assets/logo.svg`), no de `public/` (la imagen va detrás de la sesión, como el resto de la API) ni de `src/config`.

- Errores: los mismos 401/403 que el endpoint anterior.

Los documentos PDF no piden estos endpoints: el backend arma el encabezado con los mismos datos y con el logo en su versión vectorial, que se mantiene en sincronía con este archivo (ver Documentos PDF).

## Asistencias

Registro de la asistencia de los turnos por su profesor (HU-22, T-81). Rol: **sólo `PROFESOR`** en los tres endpoints (mesa de entradas y gerente reciben 403; ven la asistencia en el detalle del turno, el historial y el tablero). El profesor sale de la sesión, nunca de un parámetro (sin ficha de profesor: 404). Estados, plazo y horas seguidas los calcula el motor de ocurrencias (`convenciones-backend.md` → Ocurrencias): la UI no los calcula.

**`GET /api/v1/asistencias?fecha`**: las clases del profesor en `fecha` (sin ella, hoy; posterior a hoy → 400 en `fecha`). Cualquier día pasado se puede pedir: con el plazo vencido se devuelve igual, con `editable: false` (sólo lectura).

- Una **clase** es una hora de un bloque con al menos un turno no cancelado, en orden horario, con su horario y su aula. Los turnos cancelados no aparecen.
- Cada **fila** es un grupo de horas seguidas de un alumno (mismo alumno, materia y fecha, una hora a continuación de la otra) y va en la clase de su **primera** hora (una clase puede quedar sin filas). `temas` son los del turno de la primera hora. `ocurrencias` trae cada hora con su propio `estado` y su `asistencia` (`null` si no se registró).
- `indicacionesAnteriores`: las de la última asistencia "Presente" con indicaciones de ese alumno en esa materia antes de esa fecha (de cualquier profesor), con su fecha, o `null`.
- `plazo` es el de la fecha (`vence` = fecha + 7; `vencido` si hoy es posterior) y `editable` = no vencido.

```json
{
  "fecha": "2026-10-13",
  "plazo": { "vence": "2026-10-20", "vencido": false },
  "editable": true,
  "clases": [
    {
      "bloqueAgendaId": 7,
      "horaInicio": "08:00",
      "horaFin": "09:00",
      "aula": { "id": 1, "nombre": "Aula 1" },
      "filas": [
        {
          "alumno": { "id": 12, "apellido": "Pérez", "nombre": "Juan", "fotoUrl": null },
          "materia": { "id": 3, "nombre": "Matemática" },
          "temas": "Ecuaciones de primer grado",
          "horaInicio": "08:00",
          "horaFin": "11:00",
          "horas": 3,
          "ocurrencias": [
            {
              "turnoId": 41,
              "fecha": "2026-10-13",
              "horaInicio": "08:00",
              "horaFin": "09:00",
              "estado": "REALIZADO",
              "asistencia": {
                "estado": "PRESENTE",
                "trabajado": "Despeje de incógnitas",
                "indicaciones": "Repasar los ejercicios 1 a 5",
                "observacion": null
              }
            }
          ],
          "indicacionesAnteriores": { "fecha": "2026-10-06", "indicaciones": "Traer la carpeta" }
        }
      ]
    }
  ]
}
```

**`GET /api/v1/asistencias/pendientes`**: turnos del profesor de días **anteriores** a hoy, sin asistencia y con el plazo sin vencer: `{ "cantidad": 3, "masAntiguo": { "fecha": "2026-10-08", "vence": "2026-10-15" } }` (`masAntiguo` es `null` si no hay). Para "Tenés 3 turnos sin registrar de días anteriores. El más antiguo se puede registrar hasta el 15/10".

**`PUT /api/v1/asistencias`**: registra o corrige, **todo o nada**. Responde `200` con `{ "filas": [...] }`: las filas registradas, con la misma forma que en el `GET`.

```json
{
  "registros": [
    {
      "ocurrencias": [
        { "turnoId": 41, "fecha": "2026-10-13" },
        { "turnoId": 42, "fecha": "2026-10-13" }
      ],
      "estado": "PRESENTE",
      "trabajado": "Despeje de incógnitas",
      "indicaciones": "Repasar los ejercicios 1 a 5"
    }
  ]
}
```

- Cada **registro** es una fila: una o varias horas seguidas del mismo alumno, materia y fecha, con el mismo estado y los mismos textos en **cada** hora. Con "Ajustar por hora", un registro por hora.
- `PRESENTE`: `trabajado` e `indicaciones` opcionales, hasta 1000 caracteres. `AUSENTE`: `observacion` opcional, hasta 500; con `trabajado` o `indicaciones` → 400 en ese campo. Un texto vacío se guarda como `null`.
- **Corregir** es volver a mandar la misma ocurrencia: actualiza la misma asistencia (una por ocurrencia) y quién y cuándo la modificó. Si dos pedidos llegan a la vez, el último gana.
- **"Marcar todos presentes"** es un `PUT` con un registro `PRESENTE` por cada fila de la clase **sin asistencia**: las ya registradas no se mandan y no cambian.
- Errores, en este orden:

  | Status | `code`            | Cuándo                                                                                                                          |
  | ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
  | 400    | `VALIDACION`      | Body inválido; una ocurrencia de fecha futura (`path` `["registros", i, "ocurrencias", j, "fecha"]`) o repetida en el pedido    |
  | 403    | `SIN_PERMISO`     | Alguna ocurrencia no existe o no es del profesor de la sesión                                                                   |
  | 409    | `TURNO_CANCELADO` | Alguna ocurrencia está cancelada: "El turno está cancelado: no se puede registrar su asistencia"                                |
  | 400    | `VALIDACION`      | Las horas de un registro no son seguidas, o no son del mismo alumno, materia y fecha (`path` `["registros", i, "ocurrencias"]`) |
  | 409    | `FUERA_DE_PLAZO`  | El plazo venció (pasado el séptimo día): "El plazo para registrar esta asistencia venció el DD/MM". Tampoco se puede corregir   |

## Historiales

Historial académico del alumno (HU-31, T-108) y "Mis materias" del portal (HU-33). Es **sólo lectura y sin tablas propias**: las clases son las ocurrencias pasadas del alumno, una por hora, con el estado, la asistencia y la cancelación que calcula el motor ([Ocurrencias](#ocurrencias)); la asistencia se registra y se corrige sólo desde [Asistencias](#asistencias) (HU-22). Reglas en `dominio.md` → Historial académico. El historial del período que se ve también se baja como PDF (HU-32, T-110), con el contrato común de [Documentos PDF](#documentos-pdf).

| Endpoint                                                                               | Roles                       | Qué hace                                                  |
| -------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------- |
| `GET /api/v1/historiales/alumnos/{alumnoId}?desde&hasta&materiaId&profesorId`          | `MESA_ENTRADAS`, `PROFESOR` | El historial del alumno en el período. 200; 400; 403; 404 |
| `GET /api/v1/historiales/alumnos/{alumnoId}/pdf?mes\|desde&hasta&materiaId&profesorId` | `MESA_ENTRADAS`, `PROFESOR` | El historial del período como PDF. 200; 400; 403; 404     |
| `GET /api/v1/historiales/mis-materias`                                                 | `ALUMNO`                    | Mis materias con su próximo turno y mi porcentaje. 200    |
| `GET /api/v1/historiales/mis-materias/{materiaId}/{profesorId}?mes`                    | `ALUMNO`                    | Mi historial de esa materia, por mes. 200; 400; 404       |

Cualquier otro rol recibe 403 `SIN_PERMISO`.

**Forma común: grupos, bloques y clases.** Los tres endpoints usan la misma estructura (fechas y horas, como siempre, en [Formatos](#formatos)):

- Un **grupo** es una **materia con un profesor** ("Matemática — Prof. Gómez": un alumno puede cursar la misma materia con más de un profesor), con su `resumen` y sus `bloques`. Van por nombre de materia, apellido y nombre del profesor.
- `resumen` es `{ realizadas, ausencias, porcentaje }`: **cada hora cuenta como un turno**; el porcentaje es realizadas sobre realizadas más ausencias, con un decimal, y **0 sin base**. Los cancelados, los sin registrar y los agendados **no cuentan**.
- Un **bloque** son las **horas seguidas** de un día (mismo alumno, profesor y materia, una a continuación de la otra): `{ fecha, horaInicio, horaFin, horas, textos, clases }`. `textos` son "Qué se trabajó" e "Indicaciones para la próxima sesión", que se muestran **una sola vez** (`null` si ninguna hora está presente). Una hora suelta, o una cancelada, es un bloque de una, y una cancelada en el medio **corta** el bloque. Los bloques van de la fecha más reciente a la más antigua.
- Una **clase** es **una hora**: `{ turnoId, fecha, horaInicio, horaFin, estado, plazoAsistencia, cerradaPorSistema, textosPropios, observacion, cancelacion }`. `turnoId` y `fecha` son los de `GET /ocurrencias/{turnoId}/{fecha}`, para abrir el detalle. `estado` es uno de `ESTADOS_OCURRENCIA` ([Ocurrencias](#ocurrencias)) y `cerradaPorSistema` marca un "Sin registrar" con el plazo vencido. `textosPropios` sólo viene si la hora es presente y sus textos **difieren** de los del bloque (si no, `null`). `observacion` es la de la ausencia o la del cierre del sistema; `cancelacion` es `{ motivo, detalle }` sólo si la hora está cancelada (HU-13).

**`GET /api/v1/historiales/alumnos/{alumnoId}`**: el historial del alumno en `[desde, hasta]`.

- **Período:** sin `desde` ni `hasta`, el **mes en curso** (si viene uno solo, el otro extremo es el del mes en curso). `hasta` anterior a `desde`, o un período de más de **366 días** (decisión T-147), es 400 `VALIDACION` con `details` sobre `hasta`.
- **Sólo clases de hoy o anteriores:** los turnos futuros están en los turnos del alumno (`GET /ocurrencias`), así que `hasta` se recorta a hoy al leer. El `desde` y el `hasta` de la respuesta son los del período **pedido** (o los del mes en curso), no los recortados.
- **Filtros:** `materiaId` y `profesorId` (el del bloque). Una materia o un profesor sin clases dan `grupos: []`, sin 404.
- **`opciones`** (`{ materias, profesores }`) sale del historial **completo** del alumno, no del período filtrado, así los filtros de la pantalla no se quedan sin valores al elegir un mes sin clases.
- **Roles:** `MESA_ENTRADAS`, y `PROFESOR` sólo si el alumno **tiene o tuvo** turnos con él (el criterio de "Mis alumnos"); si no, 403 `SIN_PERMISO`. El profesor ve el historial **completo** del alumno, también las clases de otras materias y de otros profesores (HU-31). Un alumno inexistente es 404 `NO_ENCONTRADO`, y se chequea **antes** que el permiso del profesor; el período, antes que los dos.

```json
{
  "alumno": { "id": 12, "nombre": "Lucía", "apellido": "González", "dni": "40123456" },
  "desde": "2026-10-01",
  "hasta": "2026-10-31",
  "grupos": [
    {
      "materia": { "id": 3, "nombre": "Matemática" },
      "profesor": { "id": 4, "nombre": "Ana", "apellido": "Pérez" },
      "resumen": { "realizadas": 3, "ausencias": 1, "porcentaje": 75 },
      "bloques": [
        {
          "fecha": "2026-10-13",
          "horaInicio": "08:00",
          "horaFin": "10:00",
          "horas": 2,
          "textos": {
            "trabajado": "Ecuaciones de primer grado",
            "indicaciones": "Practicar los ejercicios 4 a 10 de la guía"
          },
          "clases": [
            {
              "turnoId": 31,
              "fecha": "2026-10-13",
              "horaInicio": "08:00",
              "horaFin": "09:00",
              "estado": "REALIZADO",
              "plazoAsistencia": { "vence": "2026-10-20", "vencido": false },
              "cerradaPorSistema": false,
              "textosPropios": null,
              "observacion": null,
              "cancelacion": null
            },
            {
              "turnoId": 32,
              "fecha": "2026-10-13",
              "horaInicio": "09:00",
              "horaFin": "10:00",
              "estado": "REALIZADO",
              "plazoAsistencia": { "vence": "2026-10-20", "vencido": false },
              "cerradaPorSistema": false,
              "textosPropios": {
                "trabajado": "Ecuaciones de primer grado y verificación",
                "indicaciones": "Practicar los ejercicios 4 a 10 de la guía"
              },
              "observacion": null,
              "cancelacion": null
            }
          ]
        }
      ]
    }
  ],
  "opciones": {
    "materias": [{ "id": 3, "nombre": "Matemática" }],
    "profesores": [{ "id": 4, "nombre": "Ana", "apellido": "Pérez" }]
  }
}
```

**`GET /api/v1/historiales/alumnos/{alumnoId}/pdf?mes|desde&hasta&materiaId&profesorId`** (roles `MESA_ENTRADAS` y `PROFESOR`, HU-32): el historial académico del alumno **del período pedido** como documento oficial en PDF, con el contrato común de [Documentos PDF](#documentos-pdf). Sale del **mismo cálculo** que `GET /historiales/alumnos/{alumnoId}`: los grupos, su resumen y sus bloques de horas seguidas son los mismos que los de la pantalla.

- **Período (decisión T-163):** un `mes` (`AAAA-MM`; otro formato es 400 `VALIDACION`) o un rango `desde`/`hasta`, el mismo que acepta el historial JSON. Si vienen **los dos**, manda el rango; el extremo que falte lo completa el mes, y sin `mes` ni fechas, el **mes en curso**. `hasta` anterior a `desde`, o un período de más de **366 días**, es 400 con `details` sobre `hasta`, igual que el JSON. Las clases llegan **hasta hoy**.
- **Filtros:** `materiaId` y `profesorId`, los mismos del historial de la ficha. El de materia se aplica también a los exámenes; el de profesor no, porque un examen es del alumno y de la materia. El documento dice qué filtros se aplicaron.
- **Contenido**, en este orden: el encabezado oficial; el alumno (apellido, nombre, DNI y nivel de escolaridad), el período (rotulado "Mes" si es un mes completo y "Período" si no) y los filtros; por cada **materia y profesor**, su resumen y sus clases en bloques de horas seguidas (fecha y horario del bloque, el estado de **cada** hora con su plazo o su cierre del sistema, y "Qué se trabajó" e indicaciones **una sola vez**, con los de la hora que los tenga distintos aparte); los **turnos cancelados** del período con fecha, horario, materia, profesor y motivo; y los **exámenes** del período con su fecha, su materia y su nota (`7,5`, `Ausente` o `Sin nota`). Un período sin clases lo dice. Los cancelados y los exámenes sólo se listan si hay.
- **Sin observaciones internas:** no lleva las del alumno ni las de los turnos (tampoco la de una ausencia).
- **Roles:** los mismos del historial JSON y con el mismo criterio (decisión T-163): `MESA_ENTRADAS`, y `PROFESOR` sólo si el alumno **tiene o tuvo** turnos con él (si no, 403 `SIN_PERMISO`); `GERENTE` y `ALUMNO`, 403.
- **Errores:** 400 (`mes` o una fecha inválidos, período invertido o de más de 366 días, `alumnoId`, `materiaId` o `profesorId` inválidos), 401, 403 y 404 (el alumno no existe), en JSON. Mismo orden que el JSON: período, alumno y después el permiso del profesor.
- **Nombre del archivo:** `historial-academico-<apellido>-<nombre>-<mes>.pdf` con un mes completo (`historial-academico-gonzalez-lucia-2026-10.pdf`) y `historial-academico-<apellido>-<nombre>-<desde>_<hasta>.pdf` con cualquier otro período (`…-2026-09-05_2026-10-12.pdf`). HU-32 lo pide con `_` entre todas las partes, que la decisión T-123 reserva para las dos fechas de un rango: entre las partes van guiones (decisión T-162, **pendiente de confirmación de las PO**).

**`GET /api/v1/historiales/mis-materias`** (portal, HU-33): cada materia y profesor en los que el alumno de la sesión **tiene o tuvo** turnos, con su `proximoTurno` (`{ fecha, horaInicio, horaFin }`: la primera clase **no cancelada** de hoy en adelante, hasta **366 días**, decisión T-149; `null` si no tiene ninguna) y su `porcentaje` de asistencia sobre **todo** su historial en esa materia con ese profesor. Sin paginar, en el mismo orden que los grupos. Una materia y profesor cuyo primer turno todavía no pasó también aparece, con `porcentaje: 0`.

```json
[
  {
    "materia": { "id": 3, "nombre": "Matemática" },
    "profesor": { "id": 4, "nombre": "Ana", "apellido": "Pérez" },
    "proximoTurno": { "fecha": "2026-10-20", "horaInicio": "08:00", "horaFin": "09:00" },
    "porcentaje": 75
  }
]
```

**`GET /api/v1/historiales/mis-materias/{materiaId}/{profesorId}?mes`** (portal, HU-33): el historial del alumno de la sesión en una materia con un profesor, **por mes** (`mes` es `AAAA-MM`; por defecto, el mes en curso; otro formato es 400 `VALIDACION`). Trae `indicacionesProximaClase` (`{ fecha, indicaciones }` de la última clase realizada con indicaciones, de **cualquier** fecha, también anterior al mes; `null` si no hay), el `resumen` **del mes** y sus `bloques`. Una materia y un profesor en los que no cursa ni cursó → 404 `NO_ENCONTRADO`.

Lo que el alumno **no** ve (ver [Portal del alumno](#portal-del-alumno)): la `observacion` de la ausencia y la del cierre del sistema, la `cancelacion` (ni su motivo ni su detalle), el `plazoAsistencia`, `cerradaPorSistema` y datos de otros alumnos. Las clases **`SIN_REGISTRAR` sí se le muestran** (decisión T-169), sin el plazo ni el cierre del sistema, y **no cuentan** para el `resumen`; las **`AGENDADO`** (una de hoy todavía sin registrar) no: se omiten del bloque, y un bloque que se queda sin ninguna no viene (decisión T-148). `horas` sigue siendo el total del bloque, así que puede ser mayor que la cantidad de `clases`.

```json
{
  "materia": { "id": 3, "nombre": "Matemática" },
  "profesor": { "id": 4, "nombre": "Ana", "apellido": "Pérez" },
  "mes": "2026-10",
  "indicacionesProximaClase": {
    "fecha": "2026-10-13",
    "indicaciones": "Practicar los ejercicios 4 a 10 de la guía"
  },
  "resumen": { "realizadas": 3, "ausencias": 1, "porcentaje": 75 },
  "bloques": [
    {
      "fecha": "2026-10-13",
      "horaInicio": "08:00",
      "horaFin": "10:00",
      "horas": 2,
      "textos": {
        "trabajado": "Ecuaciones de primer grado",
        "indicaciones": "Practicar los ejercicios 4 a 10 de la guía"
      },
      "clases": [
        {
          "turnoId": 31,
          "fecha": "2026-10-13",
          "horaInicio": "08:00",
          "horaFin": "09:00",
          "estado": "REALIZADO",
          "textosPropios": null
        }
      ]
    }
  ]
}
```

## Adjuntos

HU-24 (T-95) y HU-44 (T-123). El **comprobante adjunto** es el archivo que trae la familia para respaldar un pago por transferencia o con débito (no confundir con el comprobante de pago en PDF que emite el centro, HU-15). Con las mismas reglas, es también el comprobante **opcional** de la transferencia a un profesor al pagar su liquidación (HU-44). Reglas en `dominio.md` → Comprobante adjunto.

| Endpoint                                             | Roles                      | Qué hace                                                                                                                |
| ---------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/adjuntos`                              | `MESA_ENTRADAS`, `GERENTE` | Sube el archivo **antes** de registrar el pago o la transferencia a un profesor. 201 `{ id, nombre, tipo, bytes }`; 400 |
| `GET /api/v1/adjuntos/pagos/{pagoId}`                | `MESA_ENTRADAS`, `GERENTE` | El último adjunto activo del pago, con la URL para abrirlo. 200; 404                                                    |
| `GET /api/v1/adjuntos/liquidaciones/{liquidacionId}` | `GERENTE`                  | El último adjunto activo de la liquidación (el comprobante de la transferencia), con la URL. 200; 400; 404              |
| `PUT /api/v1/adjuntos/pagos/{pagoId}`                | `MESA_ENTRADAS`            | Reemplaza el comprobante (conserva el anterior) o lo adjunta a un débito sin adjunto. 200; 400; 404; 409                |
| `DELETE /api/v1/adjuntos/pagos/{pagoId}`             | `MESA_ENTRADAS`            | Quita el comprobante de un pago **con débito** (baja lógica). 204; 404; 409                                             |

Cualquier otro rol recibe 403 `SIN_PERMISO`; el **alumno no ve el comprobante adjunto** (HU-24) y el **profesor no ve el comprobante de la transferencia** (HU-45). El de una liquidación no se reemplaza ni se quita.

**El archivo** (`POST` y `PUT`): multipart con un único campo `archivo`, JPG, PNG o PDF de hasta 5 MB. Además del tipo que declara el navegador se verifica el contenido (la firma): un PNG renombrado a `.pdf` se rechaza. Errores, 400 `VALIDACION` en `["archivo"]`: "El archivo debe ser JPG, PNG o PDF" o "El archivo supera los 5 MB". Se guarda con su nombre original (hasta 200 caracteres; vacío, "comprobante").

**Respuesta 201 del `POST`:** `{ "id": 18, "nombre": "transferencia.pdf", "tipo": "application/pdf", "bytes": 248312 }`. El `id` es el que se manda como `comprobanteAdjuntoId` al registrar el pago (`POST /pagos`, T-96) o el pago de una liquidación (ver [Liquidaciones](#liquidaciones)), que lo vinculan **dentro de su transacción**: si el registro falla, el adjunto queda sin vincular. Un adjunto se vincula a un solo pago **o** a una sola liquidación, y sólo lo puede vincular quien lo subió; si no, el registro responde 400 `ADJUNTO_INVALIDO` en `["comprobanteAdjuntoId"]`, con "El comprobante adjunto no existe o ya se usó en otro pago: volvé a subirlo" (pago) o "El comprobante de la transferencia no existe o ya se usó: volvé a subirlo" (liquidación). Uno que nunca se vincula queda guardado y no se muestra.

**Respuesta 200 del `GET` (y del `PUT`):**

```json
{
  "id": 21,
  "nombre": "transferencia.pdf",
  "tipo": "application/pdf",
  "bytes": 248312,
  "url": "https://…/adjuntos/3f1c….pdf?X-Amz-…",
  "adjuntadoPor": { "id": "usr_mesa_01", "nombre": "Laura", "apellido": "Gómez" },
  "adjuntadoEl": "2026-10-14T13:45:00.000Z"
}
```

- Es el **último activo** del pago: los reemplazados se conservan y no se muestran. Un pago anulado lo sigue mostrando.
- `url`: prefirmada, vence a los 15 min. **Abre el archivo en otra pestaña** (`Content-Disposition: inline`) y, si se guarda, se guarda con su nombre. El frontend la usa como enlace (`target="_blank"`); no la guarda.
- 404 si el pago no existe ("Pago no encontrado") o no tiene adjunto: nunca tuvo, o se quitó ("El pago no tiene comprobante adjunto").

**`GET /adjuntos/liquidaciones/{liquidacionId}`:** la misma respuesta que el de un pago (`AdjuntoDeLiquidacion`), con el último adjunto activo de la liquidación; `adjuntadoPor` es el gerente que registró la transferencia. `liquidacionId` no numérico o menor a 1 → 400. 404 si la liquidación no existe ("Liquidación no encontrada") o no tiene comprobante, porque es opcional o porque es `DESCONTADA`, sin transferencia ("La liquidación no tiene comprobante adjunto").

**`PUT` (reemplazar):** adjunta el archivo nuevo y conserva el anterior (la fila y el archivo); el `GET` muestra el nuevo, con quién lo adjuntó y cuándo. En un pago con débito sin adjunto, lo adjunta. Errores, en orden: 404 si el pago no existe; 409 `PAGO_ANULADO` si está anulado (conserva todo como estaba, HU-42); 409 `CONFLICTO` "Un pago en efectivo no lleva comprobante adjunto" si su forma de pago no lleva comprobante.

**`DELETE` (quitar):** sólo en un pago con débito, donde el comprobante es opcional. Es una baja lógica: los adjuntos activos del pago pasan a inactivos con quién y cuándo, y no se borran ni las filas ni los archivos; después, `GET` → 404 y el pago se ve sin comprobante. 204 sin cuerpo. Errores, en orden: 404 si el pago no existe; 409 `PAGO_ANULADO`; 409 `ADJUNTO_OBLIGATORIO` "Un pago por transferencia no puede quedar sin comprobante: reemplazalo"; 404 si es en efectivo o no tiene adjunto activo.

## Anulaciones

HU-42 (T-104). Anular un pago completo, nunca un turno suelto. Reglas en `dominio.md` → Anulación de pagos.

| Endpoint                         | Roles           | Qué hace                                                                              |
| -------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| `GET /api/v1/anulaciones/previa` | `MESA_ENTRADAS` | El resumen para confirmar y sus avisos. No escribe. 200; 400; 404; 409 `PAGO_ANULADO` |
| `POST /api/v1/anulaciones`       | `MESA_ENTRADAS` | Anula el pago. 201 con `{ pagoId, cantidad }`; 400; 404; 409 `PAGO_ANULADO`           |

Cualquier otro rol recibe 403 `SIN_PERMISO`.

**`GET /anulaciones/previa?pagoId=31`** (`pagoId`: entero positivo; si no, 400 `VALIDACION` en `["pagoId"]`):

```json
{
  "pago": {
    "id": 31,
    "numeroComprobante": 123,
    "alumno": { "id": 12, "nombre": "Juan", "apellido": "Pérez" },
    "total": 32000,
    "cantidad": 4
  },
  "avisos": {
    "deuda": { "cantidad": 5, "total": 40000, "turnosDelPago": 4 },
    "precios": [
      { "materia": { "id": 2, "nombre": "Matemática" }, "cobrado": 8000, "vigente": 9000 }
    ],
    "transferenciaCompartida": {
      "operacion": "0004829137",
      "banco": "Banco Macro",
      "pagos": [
        {
          "pagoId": 32,
          "numeroComprobante": 124,
          "alumno": { "id": 14, "nombre": "Lucía", "apellido": "Álvarez" }
        }
      ]
    }
  }
}
```

- `pago`: lo que muestra la confirmación ("¿Anular el comprobante N.º 123 de Juan Pérez por $ 32.000 (4 turnos)?"). `total` en pesos; `cantidad`, los turnos del pago. El texto lo arma el cliente con estos datos.
- Los avisos **informan, no bloquean**: anular se puede igual. Sin nada que avisar, `deuda` y `transferenciaCompartida` van `null` y `precios` va `[]`.
- `avisos.deuda`: el alumno quedaría con **deuda vencida** (HU-29). `cantidad` y `total` son su deuda vencida de hoy más los turnos del pago con fecha de 30 días o más (`fecha <= hoy - 30`), que al anular dejan de estar pagos, a precio **vigente** (un turno de una materia sin precio cuenta en `cantidad` pero no suma al `total`). `turnosDelPago` es cuántos de esos turnos son de este pago (puede ser 0 si el alumno ya tenía deuda vencida). `null` si no quedaría con ninguna.
- `avisos.precios`: una entrada por materia (y precio cobrado) cuyo precio por hora **vigente** es distinto del que se cobró en el pago, por nombre de materia: "Los turnos se volverán a cobrar a $ 9.000 por hora; en este pago se cobraron a $ 8.000". `vigente` es `null` si la materia ya no tiene precio.
- `avisos.transferenciaCompartida`: sólo si el pago es una transferencia. Los **otros pagos vigentes** con la misma operación y banco (una transferencia puede cubrir a varios alumnos), por número de comprobante. **No se anulan con éste.** `null` si no hay otros.
- Errores, en orden: 400 (`pagoId`); 404 `NO_ENCONTRADO` "Pago no encontrado"; 409 `PAGO_ANULADO` si ya está anulado (no hay nada que confirmar).

**Body de `POST /anulaciones`:**

```json
{ "pagoId": 31, "motivo": "ERROR_CARGA", "detalle": "Se cargó el alumno equivocado" }
```

- `pagoId`: entero positivo.
- `motivo`: `ERROR_CARGA`, `FORMA_PAGO_EQUIVOCADA` u `OTRO`.
- `detalle`: opcional, hasta 500 caracteres; `""`, espacios o `null` = sin detalle. **Obligatorio si `motivo = OTRO`**: 400 `VALIDACION` en `["detalle"]`.

**Respuesta 201:** `{ "pagoId": 31, "cantidad": 4 }`: los turnos que volvieron a quedar pendientes de pago ("Pago anulado. Sus turnos volvieron a quedar pendientes de pago").

**Errores, en orden:** 400 `VALIDACION`; 404 `NO_ENCONTRADO` "Pago no encontrado"; 409 `PAGO_ANULADO` "Un pago anulado no se puede volver a activar" (sin `details`; también si dos anulaciones del mismo pago llegan a la vez: gana una).

**Qué hace, en una transacción con el lock del alumno** (el mismo que pagar, cancelar y reprogramar, así que se serializan): `Pago.estado = ANULADO` (con `updatedById`/`updatedAt`), una `AnulacionPago` (motivo, detalle y quién la creó) y `vigente = null` en todos los `PagoTurno` del pago. **No se borra nada**: el pago conserva todos sus datos, su forma de pago y su comprobante adjunto, y su número no se reutiliza. Las ocurrencias vuelven a `PENDIENTE` en la siguiente lectura del motor (`Ocurrencia.pago`, `cuentas`, deuda) y se pueden cobrar de nuevo con `POST /pagos` **al precio vigente**. Si un pago nuevo de esas ocurrencias llega a la vez, el lock lo ordena: o entra después de la anulación, o recibe 409 `TURNOS_NO_COBRABLES` (`YA_PAGADO`).

El pago anulado se sigue consultando con `GET /pagos/{id}` (`estado: "ANULADO"` y su `anulacion`) y su comprobante en PDF lleva la leyenda "ANULADO" (ver Pagos).

## Usuarios

Lo que vale para cualquier usuario sin importar su rol (HU-28, T-91).

**`GET /api/v1/usuarios/mi-usuario`** (todos los roles): el usuario de la sesión.

```json
{
  "id": "usr_alumno_01",
  "nombre": "Juan",
  "apellido": "Pérez",
  "role": "ALUMNO",
  "usuario": "jperez456",
  "contrasenaInicial": true
}
```

- `usuario` es el de ingreso del alumno; `null` en los demás roles, que ingresan con su email.
- `contrasenaInicial` sale de la cuenta `credential` (decisión T-135): `true` mientras siga siendo la que puso el sistema (el DNI). El portal la usa para el aviso "Por seguridad, te recomendamos cambiar tu contraseña". Sin cuenta, `false`.

**`PATCH /api/v1/usuarios/mi-usuario/contrasena`** (`ALUMNO` en este incremento): body `{ "actual", "nueva", "repeticion" }`. Responde `200` con mi usuario, ya con `contrasenaInicial: false`; **la sesión sigue abierta**. Errores 400 `VALIDACION`, en este orden (el primero que falla gana), con `details` en el campo:

| Campo        | Cuándo                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| el que falte | Alguno de los tres está vacío ("Es obligatoria")                                                            |
| `repeticion` | `nueva` y `repeticion` no coinciden ("Las contraseñas no coinciden")                                        |
| `nueva`      | Tiene menos de 8 caracteres, es igual a la actual o es el DNI del alumno (con o sin puntos)                 |
| `actual`     | No es la contraseña actual ("La contraseña actual no es correcta"): no cambia nada. La verifica Better Auth |

Errores comunes: 401 `NO_AUTENTICADO`; 403 `SIN_PERMISO` en el `PATCH` para cualquier rol que no sea `ALUMNO`.

## Reparto

HU-43 (T-120). El porcentaje que el centro retiene de cada turno cobrado. Reglas en `dominio.md` → Reparto.

| Endpoint                         | Roles     | Qué hace                                                          |
| -------------------------------- | --------- | ----------------------------------------------------------------- |
| `GET /api/v1/reparto/porcentaje` | `GERENTE` | El vigente y el historial paginado (`page`, `pageSize`). 200; 400 |
| `PUT /api/v1/reparto/porcentaje` | `GERENTE` | Registra un porcentaje nuevo. 200 con el nuevo vigente; 400       |

Cualquier otro rol recibe 403 `SIN_PERMISO` en los dos, también si se llama por fuera de las pantallas.

**`GET /reparto/porcentaje?page=1&pageSize=10`** (paginación de [Listados paginados](#listados-paginados)):

```json
{
  "vigente": {
    "porcentaje": 18,
    "desde": "2026-10-15T20:10:00.000Z",
    "cambiadoPor": { "id": "usr_gerente_01", "nombre": "Marta", "apellido": "Ríos" }
  },
  "historial": {
    "data": [
      {
        "id": 3,
        "porcentaje": 18,
        "desde": "2026-10-15T20:10:00.000Z",
        "cambiadoPor": { "…": "…" }
      },
      {
        "id": 2,
        "porcentaje": 15,
        "desde": "2026-09-01T03:00:00.000Z",
        "cambiadoPor": { "…": "…" }
      }
    ],
    "meta": { "page": 1, "pageSize": 10, "total": 2, "totalPages": 1 }
  }
}
```

- `porcentaje`: número con hasta dos decimales (18 = 18 %). `desde`: desde cuándo rige, instante ISO 8601 en UTC. `cambiadoPor`: el usuario que lo registró (`UsuarioAuditoria`).
- `historial` es un listado paginado anidado (`{ data, meta }`), del más reciente al más antiguo: el vigente es la primera fila de la página 1.

**`PUT /reparto/porcentaje`**, body `{ "porcentaje": 18 }`. Responde **200** con el nuevo vigente (`{ porcentaje, desde, cambiadoPor }`, como `vigente`). Agrega una fila al historial y no modifica nada más: los cobros ya registrados conservan su porcentaje. La confirmación ("Desde ahora, el centro retendrá el 18 % de cada turno cobrado…") la muestra la UI.

**Errores:**

- 400 `VALIDACION` en `["porcentaje"]`, con un solo mensaje, si no es un número mayor o igual a 0 y menor que 100 con hasta dos decimales (también un string, `null` o si falta): "El porcentaje debe ser mayor o igual a 0 y menor que 100, con hasta dos decimales".
- 400 `VALIDACION` en `["porcentaje"]` si es igual al vigente: "El porcentaje ya es 15 %". No se crea ninguna fila.
- 500 `ERROR_INTERNO` (en los dos endpoints) si no hay ningún porcentaje configurado: es un error de configuración de la base, se registra en el log y nunca se reemplaza por un valor por defecto (decisión T-161).

## Liquidaciones

HU-44 (T-124). La liquidación mensual de cada profesor: lo que se le debe por los turnos cobrados y dados, con sus ajustes. Reglas (devengo, ajustes, saldo y estados) en `dominio.md` → Liquidaciones; el cálculo es uno solo, el del motor (`convenciones-backend.md` → Liquidaciones). El PDF lo suma T-125 en [Documentos PDF](#documentos-pdf) y los endpoints del profesor, T-126.

| Endpoint                                                        | Roles      | Qué hace                                                                         |
| --------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------- |
| `GET /api/v1/liquidaciones`                                     | `GERENTE`  | Las liquidaciones del mes, una por profesor, con los totales del mes. 200; 400   |
| `GET /api/v1/liquidaciones/profesores/{profesorId}/{mes}`       | `GERENTE`  | La liquidación de un profesor en un mes, con sus turnos y ajustes. 200; 400; 404 |
| `POST /api/v1/liquidaciones/profesores/{profesorId}/{mes}/pago` | `GERENTE`  | Registra la transferencia y cierra la liquidación. 201; 400; 404; 409            |
| `GET /api/v1/liquidaciones/mis-ingresos`                        | `PROFESOR` | Su mes en curso, sus clases sin cobrar y las cobradas sin asistencia. 200        |
| `GET /api/v1/liquidaciones/mis-liquidaciones?page`              | `PROFESOR` | Sus liquidaciones, una fila por mes (sin el en curso). 200; 400                  |
| `GET /api/v1/liquidaciones/mis-liquidaciones/{mes}`             | `PROFESOR` | Su liquidación de un mes. 200; 400                                               |

Cualquier otro rol recibe 403 `SIN_PERMISO`. Los `mis-…` son del profesor de la sesión (HU-45, T-126): ver [Mis ingresos del profesor](#mis-ingresos-del-profesor).

**El mes** (`AAAA-MM`, en el query del listado y en la ruta del detalle y del pago): formato inválido (`2026-13`, `2026-9`) → 400 `VALIDACION` en `["mes"]` "El mes debe tener el formato AAAA-MM". Un mes **posterior al de hoy** → 400 `VALIDACION` en `["mes"]` "El mes no puede ser futuro" en los dos `GET` (en el pago, un mes futuro es 409, ver abajo). El **mes en curso sí se puede pedir**: sus liquidaciones salen `EN_CURSO`.

**Estados:** `EN_CURSO` (mes en curso), `PENDIENTE_DE_PAGO` (mes terminado con total > 0), `SALDO_A_DESCONTAR` (mes terminado con total de 0 o menos: pasa al mes siguiente como ajuste), `PAGADA` y `DESCONTADA` (su saldo lo absorbió la liquidación de `descontadaEnMes`). **Una liquidación cerrada (`PAGADA` o `DESCONTADA`) se muestra congelada**, con los importes guardados al pagarla, aunque después se anule un pago de sus turnos: eso genera un ajuste en otra liquidación (decisiones T-156 y T-163).

**Importes** en pesos (número JSON), sumados en centavos: en cada fila y en los totales, `parteProfesor + totalAjustes = total` y `parteCentro + parteProfesor = totalCobrado`. Los ajustes son negativos.

**`GET /liquidaciones?mes=2026-09&page=1&pageSize=10`** (paginación de [Listados paginados](#listados-paginados)). Sin `mes`, el **último mes terminado** (el anterior al de hoy):

```json
{
  "mes": "2026-09",
  "totales": {
    "cantidadTurnos": 19,
    "totalCobrado": 152000,
    "parteCentro": 22800,
    "parteProfesor": 129200,
    "totalAjustes": -6800,
    "total": 122400
  },
  "data": [
    {
      "profesor": { "id": 4, "nombre": "Ana", "apellido": "Gómez" },
      "estado": "PAGADA",
      "cantidadTurnos": 12,
      "totalCobrado": 96000,
      "parteCentro": 14400,
      "parteProfesor": 81600,
      "totalAjustes": 0,
      "total": 81600,
      "fechaTransferencia": "2026-10-05",
      "descontadaEnMes": null
    },
    {
      "profesor": { "id": 9, "nombre": "Carla", "apellido": "Ruiz" },
      "estado": "SALDO_A_DESCONTAR",
      "cantidadTurnos": 1,
      "totalCobrado": 8000,
      "parteCentro": 1200,
      "parteProfesor": 6800,
      "totalAjustes": -6800,
      "total": 0,
      "fechaTransferencia": null,
      "descontadaEnMes": null
    }
  ],
  "meta": { "page": 1, "pageSize": 10, "total": 2, "totalPages": 1 }
}
```

- `mes`: el pedido o el por defecto (el front arma el selector con él).
- Una fila por profesor **con turnos o ajustes en el mes, aunque esté inactivo**, por apellido y nombre. Un profesor sin movimientos no aparece. Sin ninguno: `data: []` y los totales en 0 ("No hay liquidaciones en …").
- `totales`: la suma de cada columna de **todo el listado**, no de la página.
- `fechaTransferencia`: sólo en una `PAGADA`; `descontadaEnMes`: sólo en una `DESCONTADA` ("Descontada en la liquidación de …"). Si no, `null`.

**`GET /liquidaciones/profesores/{profesorId}/{mes}`**: el detalle, con el mismo cálculo del listado.

```json
{
  "profesor": { "id": 4, "nombre": "Ana", "apellido": "Gómez" },
  "mes": "2026-09",
  "estado": "PAGADA",
  "turnos": [
    {
      "fecha": "2026-09-08",
      "horaInicio": "15:00",
      "horaFin": "16:00",
      "alumno": { "id": 12, "nombre": "Juan", "apellido": "Pérez" },
      "materia": { "id": 2, "nombre": "Matemática" },
      "numeroComprobante": 123,
      "importe": 8000,
      "porcentaje": 15,
      "parteProfesor": 6800
    }
  ],
  "ajustes": [],
  "cantidadTurnos": 1,
  "totalCobrado": 8000,
  "parteCentro": 1200,
  "parteProfesor": 6800,
  "totalAjustes": 0,
  "total": 6800,
  "cerrada": {
    "liquidacionId": 31,
    "fechaTransferencia": "2026-10-05",
    "numeroOperacion": "0004829137",
    "observaciones": null,
    "descontadaEnMes": null,
    "comprobanteAdjunto": {
      "id": 44,
      "nombre": "transferencia-gomez.pdf",
      "tipo": "application/pdf",
      "bytes": 248312,
      "adjuntadoPor": { "id": "usr_gerente_01", "nombre": "Marta", "apellido": "Ríos" },
      "adjuntadoEl": "2026-10-05T14:02:00.000Z"
    },
    "registradaPor": { "id": "usr_gerente_01", "nombre": "Marta", "apellido": "Ríos" },
    "registradaEl": "2026-10-05T14:03:00.000Z"
  },
  "acciones": { "registrarPago": false }
}
```

- `turnos`: cada turno liquidado (fecha, horario `HH:mm`, alumno, materia, número de comprobante del cobro, importe, porcentaje del centro de ese cobro y parte del profesor). La parte del centro por turno no viaja: está en los totales.
- `ajustes`: `{ tipo, texto, importe }`, con `tipo` `ANULACION` ("Ajuste por anulación del comprobante N.º 123 (2 turnos)") o `SALDO_ANTERIOR` ("Saldo de la liquidación de agosto de 2026"). El texto lo arma la API.
- `cerrada`: `null` si está abierta. En una cerrada, `liquidacionId`, la transferencia (`fechaTransferencia`, `numeroOperacion` y `observaciones`; `null` en una `DESCONTADA`), `descontadaEnMes`, el comprobante adjunto y quién registró el pago (`registradaPor`, `UsuarioAuditoria`) y cuándo (`registradaEl`, ISO 8601 UTC).
- `comprobanteAdjunto`: el último activo de una `PAGADA` (opcional: puede ser `null`), **sin URL**. Para abrirlo ("Ver"), el front pide la URL a `GET /adjuntos/liquidaciones/{liquidacionId}` (ver [Adjuntos](#adjuntos)).
- `acciones.registrarPago`: lo decide la API; `true` sólo en `PENDIENTE_DE_PAGO` (mes terminado y total > 0).
- **Profesor sin movimientos en el mes** → 200 con la liquidación vacía: `estado: null`, `turnos: []`, `ajustes: []`, totales en 0, `cerrada: null` y `registrarPago: false`.
- Errores, en orden: 400 `VALIDACION` si `profesorId` no es un entero positivo (`abc`, `0`) o el mes es inválido o futuro; 404 `NO_ENCONTRADO` "Profesor no encontrado" (un profesor inactivo sí se muestra).

**`POST /liquidaciones/profesores/{profesorId}/{mes}/pago`**: registra la transferencia al profesor y cierra la liquidación. Sólo se paga una `PENDIENTE_DE_PAGO` (mes terminado y total > 0), **por el total que calcula la API: sin pagos parciales**. El comprobante (opcional) se sube antes con `POST /adjuntos` y acá se manda su `id` (ver [Adjuntos](#adjuntos)).

```json
{
  "fechaTransferencia": "2026-10-05",
  "numeroOperacion": "0004829137",
  "comprobanteAdjuntoId": 44,
  "observaciones": null,
  "totalConfirmado": 81600
}
```

- `fechaTransferencia`: `AAAA-MM-DD`, obligatoria.
- `numeroOperacion`: obligatorio, hasta 50 caracteres.
- `comprobanteAdjuntoId`: opcional (`null` u omitido = sin comprobante).
- `observaciones`: opcional, hasta 500 caracteres; `""` o espacios = sin observaciones.
- `totalConfirmado`: el `total` que mostró el detalle, mayor a 0. **El monto no se manda**: es un control de que la liquidación no cambió entre que se abrió y se confirmó.

**Respuesta 201**, lo justo para "Pago registrado. La liquidación de septiembre de Gómez, Ana quedó pagada" (el front invalida el listado y el detalle):

```json
{
  "liquidacionId": 31,
  "profesor": { "id": 4, "nombre": "Ana", "apellido": "Gómez" },
  "mes": "2026-09",
  "total": 81600,
  "fechaTransferencia": "2026-10-05"
}
```

**Qué hace, en una transacción:** recalcula la liquidación con el motor, la guarda `PAGADA` con sus turnos, ajustes e importes congelados, la transferencia y quién la registró; cierra como `DESCONTADA` las de saldo negativo que absorbió (`descontadaEnMes` = este mes) y vincula el comprobante. Si algo falla, no se guarda nada. Desde ahí sus turnos no aparecen en otra liquidación, y una anulación posterior de uno de sus pagos no la cambia: se descuenta como ajuste en la siguiente (decisión T-163).

**Errores, en orden:**

1. 400 `VALIDACION` del body o de los parámetros, cada uno en su campo.
2. 404 `NO_ENCONTRADO` "Profesor no encontrado".
3. 409 `CONFLICTO` si el mes es el en curso o futuro: "La liquidación de noviembre de 2026 todavía no se puede pagar: el mes no terminó".
4. 400 `VALIDACION` en `["fechaTransferencia"]`: "La fecha de la transferencia no puede ser futura" o "La transferencia no puede ser anterior al 31/10/2026" (el último día del mes liquidado sí vale).
5. 409 `LIQUIDACION_PAGADA` "La liquidación de octubre de 2026 de Gómez, Ana ya está pagada".
6. 409 `CONFLICTO` "No hay importe a pagar": sin movimientos, `SALDO_A_DESCONTAR` o `DESCONTADA`.
7. 409 `LIQUIDACION_MODIFICADA` "La liquidación cambió desde que la abriste. Revisala antes de pagar": el total calculado no es `totalConfirmado` (por ejemplo, se anuló un pago de uno de sus turnos), o otro pago de la misma liquidación ganó la carrera. No se guarda nada; el front recarga el detalle (T-132).
8. 400 `ADJUNTO_INVALIDO` en `["comprobanteAdjuntoId"]` "El comprobante de la transferencia no existe o ya se usó: volvé a subirlo" (ver [Adjuntos](#adjuntos)); no se guarda nada.

### Mis ingresos del profesor

HU-45 (T-126). Rol `PROFESOR`, con el **profesor de la sesión** (como `GET /alumnos/mis-alumnos`): ningún endpoint recibe un `profesorId`. Un usuario `PROFESOR` sin ficha de profesor → 403 `SIN_PERMISO`. **Nada de otros profesores ni del centro:** ni totales del centro, ni forma de pago, ni el número de comprobante de las familias (decisión T-171). Todo sale del motor de liquidaciones y del de ocurrencias: nada se recalcula.

**Su liquidación** (`esteMes` y el detalle de un mes) tiene el formato del detalle del gerente **sin** `profesor`, `numeroComprobante` en los turnos, `acciones` ni, en `cerrada`, `observaciones`, `comprobanteAdjunto`, `registradaPor` y `registradaEl`. Los totales son los de **su** liquidación (cobrado, parte del centro, su parte, ajustes y total), con el mismo cálculo que ve el gerente.

**`GET /liquidaciones/mis-ingresos`**:

- `esteMes`: la liquidación del mes en curso (`EN_CURSO`), o la vacía (`estado: null`) sin movimientos.
- `clasesSinCobrar`: sus clases con asistencia (`REALIZADO` o `AUSENTE`, no canceladas) y **sin pago vigente**, de los últimos **366 días** (el tope de los otros listados), de la más reciente a la más antigua: `{ turnoId, fecha, horaInicio, horaFin, alumno, materia }`.
- `clasesCobradasSinAsistencia`: de **hoy o anteriores**, con pago vigente, **sin asistencia**, no canceladas y **dentro del plazo** (`plazoDeAsistencia`; una de hoy todavía es `AGENDADO`), con su `vence`, de la más reciente a la más antigua.

```json
{
  "esteMes": {
    "mes": "2026-10",
    "estado": "EN_CURSO",
    "turnos": [
      {
        "fecha": "2026-10-05",
        "horaInicio": "16:00",
        "horaFin": "17:00",
        "alumno": { "id": 12, "nombre": "Lucía", "apellido": "Pérez" },
        "materia": { "id": 3, "nombre": "Matemática" },
        "importe": 8000,
        "porcentaje": 15,
        "parteProfesor": 6800
      }
    ],
    "ajustes": [],
    "cantidadTurnos": 1,
    "totalCobrado": 8000,
    "parteCentro": 1200,
    "parteProfesor": 6800,
    "totalAjustes": 0,
    "total": 6800,
    "cerrada": null
  },
  "clasesSinCobrar": [
    {
      "turnoId": 41,
      "fecha": "2026-10-12",
      "horaInicio": "16:00",
      "horaFin": "17:00",
      "alumno": { "id": 12, "nombre": "Lucía", "apellido": "Pérez" },
      "materia": { "id": 3, "nombre": "Matemática" }
    }
  ],
  "clasesCobradasSinAsistencia": [
    {
      "turnoId": 44,
      "fecha": "2026-10-14",
      "horaInicio": "17:00",
      "horaFin": "18:00",
      "alumno": { "id": 15, "nombre": "Tomás", "apellido": "Aguirre" },
      "materia": { "id": 3, "nombre": "Matemática" },
      "vence": "2026-10-21"
    }
  ]
}
```

**`GET /liquidaciones/mis-liquidaciones?page=1&pageSize=20`** (paginación de [Listados paginados](#listados-paginados)): una fila por mes **con movimientos**, **sin el mes en curso** (está en `esteMes`), del **más reciente al más antiguo**: `{ mes, estado, total, fechaTransferencia }`; `fechaTransferencia` sólo en una `PAGADA`.

```json
{
  "data": [
    { "mes": "2026-09", "estado": "PAGADA", "total": 81600, "fechaTransferencia": "2026-10-05" },
    { "mes": "2026-08", "estado": "PAGADA", "total": 74800, "fechaTransferencia": "2026-09-04" }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 2, "totalPages": 1 }
}
```

**`GET /liquidaciones/mis-liquidaciones/{mes}`**: su liquidación de `mes`, con el formato de arriba. Cualquier mes **no futuro**, también el en curso (devuelve lo mismo que `esteMes`). Sin movimientos: la vacía. Un mes con formato inválido o futuro → 400 `VALIDACION` en `["mes"]`, como el detalle del gerente. En una cerrada, `cerrada` es `{ liquidacionId, fechaTransferencia, numeroOperacion, descontadaEnMes }`.

## Caja

A completar por T-127 (HU-46).

## Portal del alumno

El portal (`/portal`) lo usa el rol `ALUMNO`. **No es una feature de la API**: cada endpoint del alumno vive en la feature dueña del concepto (`pagos`, `ocurrencias`, `cuentas`…) y se documenta en la sección de esa feature, con las convenciones de [Formatos](#formatos), [Errores](#errores) y [Roles](#roles). Acá están la convención y el índice.

- **Nombre:** `mis-…` para una lista (`GET /pagos/mis-pagos`) y `mi-…` para un dato único (`GET /cuentas/mi-cuenta`), igual que `GET /alumnos/mis-alumnos` del profesor. Es un segmento más del path de la feature dueña.
- **Rol:** `requireRole('ALUMNO')`. Un endpoint del personal no se abre al alumno por omisión: si un endpoint existente (por ejemplo, un PDF) también lo sirve, lo declara su sección y vale la misma regla de propiedad.
- **El alumno sale de la sesión.** Ningún endpoint del portal recibe un `alumnoId` ni otro dato que identifique a un alumno: se toma del usuario que inició sesión (`actor.alumnoId`). Pedir un recurso de otro alumno (un turno, un pago, un PDF) responde 403 `SIN_PERMISO`; un usuario con rol `ALUMNO` sin alumno vinculado, también.
- **Qué no se devuelve nunca al alumno:** las observaciones internas de su ficha ni las del turno, la prioridad del turno, la ocupación o los cupos de un bloque, la auditoría (quién cargó cada dato), el comprobante adjunto de un pago ni datos de otros alumnos.
  - **Excepción: el comprobante de pago en PDF.** El alumno descarga el mismo comprobante que le entrega la mesa (`GET /pagos/{id}/pdf`, sólo de sus pagos), con "Registrado por" y, si está anulado, quién lo anuló (decisión T-153). Las respuestas JSON del portal no traen esa auditoría.
- **Sólo lectura, salvo lo que su sección diga.** Cancelar, reprogramar y pagar son de mesa de entradas; el alumno saca turnos (`POST /turnos/mis-turnos`) y cambia su contraseña.

Endpoints del portal. Cada tarea reemplaza su fila con los endpoints reales cuando los implementa:

| Feature       | Endpoints del portal                                                                        | Tarea |
| ------------- | ------------------------------------------------------------------------------------------- | ----- |
| `ocurrencias` | `GET /ocurrencias/mis-turnos?desde&hasta` y `/mis-turnos/{turnoId}/{fecha}`                 | T-84  |
| `alumnos`     | `GET /alumnos/mi-perfil`                                                                    | T-88  |
| `usuarios`    | `GET /usuarios/mi-usuario`, `PATCH /usuarios/mi-usuario/contrasena` ([Usuarios](#usuarios)) | T-91  |
| `turnos`      | `/turnos/mis-turnos` (`POST`) y `/habilitacion`, `/materias`, `/disponibilidad`             | T-93  |
| `pagos`       | `GET /pagos/mis-pagos` y `GET /pagos/{id}/pdf` (sólo sus pagos) ([Pagos](#mis-pagos-hu-37)) | T-98  |
| `cuentas`     | `GET /cuentas/mi-cuenta` ([Cuentas](#cuentas))                                              | T-101 |
| `examenes`    | `GET /examenes/mis-examenes?materiaId` ([Exámenes](#nota-del-examen-hu-34-t-106))           | T-106 |
| `historiales` | `GET /historiales/mis-materias` y `/mis-materias/{materiaId}/{profesorId}?mes`              | T-108 |

## Endpoints del profesor

Como el portal, lo propio del profesor vive en la feature dueña del concepto y se documenta en su sección.

- **Nombre:** la misma convención `mis-…` / `mi-…` del [Portal del alumno](#portal-del-alumno).
- **Rol:** `requireRole('PROFESOR')`.
- **El profesor sale de la sesión.** Ningún endpoint recibe un `profesorId`: uno en el query se ignora.

| Feature         | Endpoints del profesor                                               | Tarea |
| --------------- | -------------------------------------------------------------------- | ----- |
| `alumnos`       | `GET /alumnos/mis-alumnos` ([Alumnos](#alumnos))                     | —     |
| `agendas`       | `GET /agendas/propia` ([Agenda propia](#agenda-propia-del-profesor)) | T-25  |
| `liquidaciones` | A completar por T-126                                                | T-126 |

## Documentos PDF

Los documentos oficiales los genera la API: cada uno es un endpoint `GET` que devuelve el PDF ya armado, en A4, con el encabezado del centro. El frontend no pide el endpoint con `fetchJson`: lo enlaza con `<a href="/api/v1/…/pdf" target="_blank" rel="noopener noreferrer">` y el navegador lo abre en su visor, en otra pestaña, desde donde se descarga. Todos cumplen este contrato:

| Documento                                                                                                                                 | Endpoint                                                     | Roles                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| Comprobante de pago                                                                                                                       | `GET /pagos/{id}/pdf`                                        | `MESA_ENTRADAS`, `GERENTE`, `ALUMNO` (sólo el suyo) |
| Detalle de un turno                                                                                                                       | `GET /ocurrencias/{turnoId}/{fecha}/pdf`                     | `MESA_ENTRADAS`, `PROFESOR`                         |
| Turnos de un alumno                                                                                                                       | `GET /ocurrencias/pdf?alumnoId&…`                            | `MESA_ENTRADAS`                                     |
| Historial académico                                                                                                                       | `GET /historiales/alumnos/{alumnoId}/pdf?mes\|desde&hasta&…` | `MESA_ENTRADAS`, `PROFESOR`                         |
| Agenda de un profesor                                                                                                                     | `GET /agendas/diaria/pdf?profesorId&…`                       | `MESA_ENTRADAS`                                     |
| Tablero del gerente                                                                                                                       | `GET /tablero/pdf?desde&hasta`                               | `GERENTE`                                           |
| Lo propio de cada uno (parámetros, contenido y nombre de archivo) está en su sección: Pagos, Ocurrencias, Historiales, Agendas y Tablero. |

- **200** con el cuerpo binario del PDF y estos headers:

  | Header                   | Valor                                                            | Para qué                                                                           |
  | ------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
  | `Content-Type`           | `application/pdf`                                                |                                                                                    |
  | `Content-Disposition`    | `inline; filename="<nombre>.pdf"; filename*=UTF-8''<nombre>.pdf` | `inline`: se abre en el visor, no se descarga solo. El nombre es el de la descarga |
  | `Cache-Control`          | `no-store`                                                       | Son datos personales: no se guardan en caché                                       |
  | `X-Content-Type-Options` | `nosniff`                                                        |                                                                                    |

- **Nombre del archivo:** en ASCII, sin tildes ni espacios, en minúsculas y con guiones (`comprobante-1024.pdf`); el guion bajo sólo separa las dos fechas de un rango (`…-2026-10-01_2026-10-31.pdf`). Los nombres de persona van como apellido y nombre. Cada endpoint dice cuál es el suyo.
- **Encabezado del documento:** logo, nombre, dirección y teléfono del centro (los de [Centro](#centro)); **"Emitido por"** es el usuario de la sesión que pide el PDF (nombre y apellido) y la **fecha de emisión** es el instante del servidor, en la zona horaria del negocio, como `dd/MM/yyyy HH:mm`.
- **Metadatos del PDF:** el título es el del documento con su referencia ("Comprobante de pago N° 1024"); el autor, el creador y el productor son el centro; el idioma, `es`.
- **Errores: JSON**, con el formato y los códigos de [Errores](#errores) (400 `VALIDACION`, 401 `NO_AUTENTICADO`, 403 `SIN_PERMISO`, 404 `NO_ENCONTRADO`), como el resto de la API. Comportamiento conocido: como el enlace se abre en una pestaña nueva, ante un error (por ejemplo, un 401 con la sesión vencida) esa pestaña muestra el JSON; no hay páginas de error HTML.
- En el OpenAPI, el 200 se declara como `application/pdf` con `type: string, format: binary`.

## Filtros

Nombres fijos de query (un filtro nuevo se agrega a esta lista):

| Query                                | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `q`                                  | Búsqueda por palabras: cada palabra coincide en forma parcial y todas deben coincidir (`juan gonz` encuentra a "González, Juan"). No distingue mayúsculas ni tildes (`gonzalez` encuentra a "González") e ignora los puntos (`30.123` encuentra el DNI `30123456`). Hasta 100 caracteres; se usan las primeras 5 palabras. En la agenda (decisión T-36) busca por nombre de alumno **o** de profesor, nunca mezclando palabras entre los dos; si además se manda `profesorId`, busca sólo por alumno (T-42)                                                                                                                                |
| `estado`                             | `ACTIVO`, `INACTIVO` o `TODOS` (no filtra). Solo en entidades con baja lógica (profesores y materias); por defecto `ACTIVO`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `materiaId`                          | Filtra por materia. En Cuentas (T-101), una o más, repitiendo el parámetro: `?materiaId=2&materiaId=5`. En Pagos (`GET /pagos`), una sola                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `formaPago`                          | Filtra por forma de pago, por su código: `EFECTIVO`, `TRANSFERENCIA` o `DEBITO` (nunca por el nombre). En Pagos (`GET /pagos`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `profesorId`                         | Filtra por profesor. En la agenda (decisión T-42) es la vista personal de su agenda ese día                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `aulaId`                             | Filtra por aula                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `fecha`                              | Fecha `YYYY-MM-DD`. En la agenda diaria (`/agendas/diaria`) y sus selectores, el día a consultar (sin fecha, el de hoy, zona del negocio). En la disponibilidad de turnos, la fecha de la ocupación: hoy o posterior, y el día de la semana sale de ella (sin fecha, la próxima ocurrencia de cada día)                                                                                                                                                                                                                                                                                                                                    |
| `diaSemana`, `horaInicio`, `horaFin` | Un horario semanal: día ISO (1 a 7) y rango de horas `HH:mm` en punto, con el fin posterior al inicio (aulas disponibles)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `desde`, `hasta`                     | Rango de fechas `YYYY-MM-DD`, extremos incluidos. `hasta` no puede ser anterior a `desde`. En las agendas (`/agendas/propia` y `/agendas/profesor`; en `/agendas/centro` son obligatorios): sin `desde`, hoy; sin `hasta`, el mismo día que `desde`; el rango no puede superar los 31 días. En cuentas (`/cuentas/...`): cada extremo es opcional y **no hay tope de días**; cada sección toma la parte del período que le toca (adeudados, lo anterior a hoy; próximos, de hoy al tope de cobro) y la que no tiene parte no aplica (ver Cuentas). En pagos (`GET /pagos`): por fecha de pago, los dos **obligatorios** y sin tope de días |
| `excluirBloqueId`                    | Fila de bloque que no cuenta como ocupación (la que se está editando)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `id`                                 | En un buscador (`GET /pagos/alumnos`, `/pagos/profesores`, `/pagos/materias`), trae sólo esa opción, para mostrar el nombre del filtro elegido                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

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
| 400    | `ADJUNTO_INVALIDO`       | Registrar un pago con `comprobanteAdjuntoId` (T-95/T-96), si el adjunto no existe, ya está vinculado a un pago o a una liquidación, está dado de baja o lo subió otro usuario: "El comprobante adjunto no existe o ya se usó en otro pago: volvé a subirlo". En el pago de una liquidación (T-123/T-124), lo mismo con "El comprobante de la transferencia no existe o ya se usó: volvé a subirlo". `details`: `[{ "path": ["comprobanteAdjuntoId"], "message" }]`                                                                                                                                                                                                                                                                                                                                                                              |
| 403    | `USUARIO_INHABILITADO`   | "Su usuario no está habilitado". Sin `details`. En `/api/v1`, si el usuario fue dado de baja con la sesión abierta; también en el login (ver Autenticación)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 409    | `BLOQUE_LLENO`           | Alta de turnos. Mensaje general: "No hay lugar: …" si alguna hora no tiene lugar en ninguna fecha (incluida una sesión única llena; se rechaza siempre, aun con `asignarDondeHayLugar`), o "Hay fechas sin lugar: …" si solo algunas fechas de un recurrente están llenas (se puede reenviar con `asignarDondeHayLugar: true`). `details`: una entrada por hora con problema, `{ "path": ["bloqueIds", <posición>], "message", "bloqueId", "horaInicio", "horaFin", "capacidadEfectiva", "fechas", "completoDesde", "sinLugar" }`. `fechas`: las fechas llenas (lista finita); `completoDesde`: la fecha desde la cual todas las siguientes están llenas, o `null`. `message` sigue la HU: "La hora de 9:00 a 10:00 está completa el lunes 26/10", "… está completa desde el lunes 02/11" o "… no tiene lugar en ninguna de las fechas pedidas" |
| 409    | `PROFESOR_INACTIVO`      | El mensaje depende de la operación: "El profesor está inactivo: no se le pueden asignar materias" (materias), "… no se le puede cargar un bloque" (bloques) o "… no se le pueden asignar turnos" (turnos). Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 409    | `TURNOS_VIGENTES`        | `details` según el recurso: al quitar materias de un profesor, una entrada por cada una con turnos vigentes (no cancelados), con `path` `["materiaIds", <posición>]`, `message` y `cantidad`; al dar de baja varias horas de un bloque (`DELETE /bloques`), lo mismo con `path` `["bloqueIds", <posición>]`; al editar o dar de baja una sola hora (un solo recurso, no una lista), `{ "cantidad" }` directo; al dar de baja un profesor, un arreglo con cada turno vigente: `{ "alumno": { "id", "nombre", "apellido" }, "materia": { "id", "nombre" }, "tipo", "fecha", "fechaFin", "horaInicio", "horaFin" }` (`fecha` es la de inicio; `fechaFin` es `null` en un recurrente sin fin)                                                                                                                                                       |
| 409    | `MATERIA_INACTIVA`       | Al asignar materias a un profesor, `details`: una entrada por cada materia inactiva pedida, con `path` `["materiaIds", <posición>]`. Al registrar un turno, `[{ "path": ["materiaId"], "message" }]`. En la disponibilidad de turnos, sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 409    | `EXAMEN_FUTURO`          | "Un examen futuro no admite nota", al cargar o corregir la nota de un examen con fecha posterior a hoy (`PATCH /examenes/{id}/nota`). Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 409    | `MATERIA_SIN_TURNOS`     | "El alumno no tiene turnos próximos de esa materia", al cargar un examen o moverlo a otra materia. `details`: `[{ "path": ["materiaId"], "message" }]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 409    | `MATERIA_CON_PROFESORES` | "No se puede dar de baja una materia con profesores asignados". `details`: los profesores con una asignación activa, `[{ "id", "apellido", "nombre", "estado" }]`, para que la UI los liste y enlace a su ficha                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 409    | `MATERIA_SIN_PRECIO`     | "La materia no tiene precio: cárguelo antes de reactivarla", al reactivar una materia sin precio (`PATCH /materias/{id}/reactivacion`): primero hay que cargarle el precio con `PATCH /materias/{id}`. Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 409    | `PROFESOR_SIN_MATERIAS`  | "El profesor no tiene materias asignadas: no se le puede cargar un bloque". Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 409    | `BLOQUE_SUPERPUESTO`     | `details`: una entrada por cada hora en conflicto, `[{ "diaSemana", "horaInicio", "horaFin", "bloqueExistenteId" }]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 409    | `AULA_OCUPADA`           | "No hay un aula disponible en ese horario. Por favor, elija otro horario." `details`: una entrada por cada hora en conflicto, `[{ "diaSemana", "horaInicio", "horaFin", "profesorId" }]` (quién ocupa el aula a esa hora)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 409    | `CAPACIDAD_INSUFICIENTE` | "La capacidad no puede ser menor que la cantidad de turnos que el profesor ya tiene a la vez en una hora", al editar la capacidad de un profesor (T-15). `details`: una entrada por hora en conflicto, sobre el campo: `[{ "path": ["capacidad"], "message", "bloqueId", "diaSemana", "horaInicio", "horaFin", "fecha", "cantidad" }]`, con la fecha en que esa hora tiene más turnos a la vez desde hoy y cuántos                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 409    | `TURNO_CANCELADO`        | "El turno está cancelado: no se puede registrar su asistencia", al registrar o corregir una asistencia (`PUT /asistencias`). Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 409    | `FUERA_DE_PLAZO`         | "El plazo para registrar esta asistencia venció el DD/MM", al registrar o corregir una asistencia pasado el séptimo día (`PUT /asistencias`). Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 409    | `DEUDA_VENCIDA`          | Sacar un turno (`POST /turnos` y `POST /turnos/mis-turnos`, T-93) si el alumno tiene deuda vencida (turnos adeudados de hace 30 días o más). Mesa: "El alumno tiene deuda de más de 30 días (3 turnos · $ 24.000). Debe regularizar el pago para agendar turnos nuevos"; alumno: "Tenés clases adeudadas de hace más de 30 días. Para sacar un turno nuevo, regularizá el pago en la mesa de entrada". `details` es un **objeto**: `{ "cantidad", "total" }` (`total` en pesos, sin los turnos de materia sin precio)                                                                                                                                                                                                                                                                                                                           |
| 409    | `ALUMNO_SUPERPUESTO`     | "El alumno ya tiene un turno en ese horario". Rechazo total (ninguna bandera lo saltea). `details`: un ítem por turno en conflicto (de cualquier profesor), `[{ "turnoId", "tipo", "fechaInicio", "fechaFin", "diaSemana", "horaInicio", "horaFin", "profesor": { "id", "nombre", "apellido" }, "materia": { "id", "nombre" } }]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 409    | `MATERIA_NO_ASIGNADA`    | "La materia no está asignada al profesor" (o su asignación está dada de baja), al registrar un turno. `details`: `[{ "path": ["materiaId"], "message" }]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 409    | `TURNOS_NO_COBRABLES`    | Registrar un pago, si alguna ocurrencia no se puede cobrar (no se registra ninguna): "Algunos turnos no se pueden cobrar". `details`: una entrada por cada ocurrencia que falla, `[{ "path": ["ocurrencias", <posición>], "message", "turnoId", "fecha", "motivo", "pagoId"? }]` (`pagoId` sólo con `YA_PAGADO`); motivos: ver Pagos. Si otro pago la registró al mismo tiempo (última red de la base), "Alguno de los turnos ya fue pagado" sin `details`                                                                                                                                                                                                                                                                                                                                                                                      |
| 409    | `TURNOS_NO_CANCELABLES`  | Cancelar turnos, si alguna ocurrencia no se puede cancelar (no se cancela ninguna): "Algunos turnos no se pueden cancelar". `details`: una entrada por cada ocurrencia que falla, `[{ "path": ["ocurrencias", <posición>], "message", "turnoId", "fecha", "motivo", "pagoId"? }]` (`pagoId` sólo con `PAGADO`); motivos: ver Cancelaciones. Si otra cancelación la registró al mismo tiempo (última red de la base), "Alguno de los turnos ya fue cancelado" sin `details`                                                                                                                                                                                                                                                                                                                                                                      |
| 409    | `TURNOS_PAGADOS`         | Finalizar un turno recurrente, si hay turnos pagados desde `fechaDesde` (no se finaliza): "Hay turnos pagados desde esa fecha: elegí una fecha posterior al último turno pagado (DD/MM)" o, si llegan hasta el final de la serie, "Los turnos pagados llegan hasta el final de la serie (DD/MM): no se puede finalizar". `details` es un **objeto**: `{ "ultimaFechaPagada", "fechaDesdeMinima", "pagadas": [{ "fecha", "horaInicio", "horaFin", "importe" }] }`; `fechaDesdeMinima` es la primera fecha que se puede elegir, o `null` si no queda ninguna; `pagadas` tiene la misma forma que en la previa (ver Finalizaciones)                                                                                                                                                                                                                |
| 409    | `TURNOS_CON_ASISTENCIA`  | Finalizar un turno recurrente desde hoy, si el turno de hoy tiene asistencia registrada (no se finaliza, T-83): "El turno del DD/MM tiene asistencia registrada: elegí una fecha posterior" o, si es la última fecha de la serie, "El turno del DD/MM tiene asistencia registrada y es el último de la serie: no se puede finalizar". `details` es un **objeto**: `{ "ultimaFechaConAsistencia", "fechaDesdeMinima", "conAsistencia": [{ "fecha", "horaInicio", "horaFin", "estado" }] }`, como `TURNOS_PAGADOS`; `conAsistencia` tiene la misma forma que en la previa (ver Finalizaciones)                                                                                                                                                                                                                                                    |
| 409    | `PAGO_ANULADO`           | "El pago está anulado: su comprobante adjunto se conserva como estaba", al reemplazar o quitar el comprobante adjunto de un pago anulado (`PUT`/`DELETE /adjuntos/pagos/{pagoId}`); y "Un pago anulado no se puede volver a activar", al anular (o pedir la confirmación de anular) un pago que ya está anulado (`POST /anulaciones`, `GET /anulaciones/previa`). Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 409    | `ADJUNTO_OBLIGATORIO`    | "Un pago por transferencia no puede quedar sin comprobante: reemplazalo", al quitar el comprobante adjunto de un pago por transferencia (`DELETE /adjuntos/pagos/{pagoId}`). Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 409    | `TURNO_CON_ASISTENCIA`   | "El turno tiene asistencia registrada: no se puede reprogramar", al reprogramar una ocurrencia con asistencia ("Presente" o "Ausente"), aunque sea de hoy (T-83). Sin `details`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Qué hace la UI con cada caso está en `arquitectura-frontend.md` → Manejo de errores en la UI.

## Roles

Valores del campo `role` de la sesión: `MESA_ENTRADAS`, `PROFESOR`, `GERENTE` y `ALUMNO`. Un usuario tiene un solo rol.

| Valor           | Rol              |
| --------------- | ---------------- |
| `MESA_ENTRADAS` | Mesa de entradas |
| `PROFESOR`      | Profesor         |
| `GERENTE`       | Gerente          |
| `ALUMNO`        | Alumno           |

- `ALUMNO` está activo: ingresa con su usuario (ver [Autenticación](#autenticación)) y usa los endpoints del [Portal del alumno](#portal-del-alumno). Su cuenta lleva el alumno vinculado (`Usuario.alumnoId`), que la API toma de la sesión.
- `PROFESOR` usa, además de los endpoints de su agenda y sus asistencias, los [Endpoints del profesor](#endpoints-del-profesor) (`mis-…` / `mi-…`), con el profesor de la sesión.
- Base de datos: catálogo `rol` (lo carga el seed); `Usuario.role` es un FK a él.
- Backend: `ROLES` en `src/server/shared/actor.ts`.
- Frontend: el tipo `Role` de `src/types/index.ts`.

Los dos lados no pueden compartir código, así que un rol nuevo o un cambio de valor se hace en el seed, en `actor.ts` y en `src/types/index.ts` en el mismo PR.

## Autenticación

- El personal ingresa con email y contraseña (`POST /api/auth/sign-in/email`); el alumno, con su usuario y contraseña (`POST /api/auth/sign-in/username`, HU-28). Siempre a través del `authClient`. La contraseña inicial del alumno es su DNI (puede tener 7 dígitos: el ingreso no mide el largo; el mínimo de 8 rige para la contraseña nueva).
- No hay registro público: las cuentas se crean desde el servidor (el seed crea los usuarios de desarrollo y mesa de entradas crea la cuenta de cada profesor al darlo de alta). `POST /api/auth/sign-up/email` responde 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED` y el frontend no tiene pantalla de registro.
- `/api/auth/*` responde con el **formato de Better Auth**, `{ "code", "message" }` (el `authClient` lo expone como `error.code` / `error.message`), no con `{ "error": { … } }`. El `message` de Better Auth viene en inglés: la UI elige el texto según el `code`.
- Códigos que la UI maneja en el login (`POST /api/auth/sign-in/email`):

  | Status | `code`                      | Cuándo                                                                                        | Texto en la UI                           |
  | ------ | --------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------- |
  | 401    | `INVALID_EMAIL_OR_PASSWORD` | Email inexistente o contraseña incorrecta (siempre el mismo, sin indicar cuál falló)          | "Usuario/email o contraseña incorrectos" |
  | 403    | `USUARIO_INHABILITADO`      | Contraseña correcta, pero el usuario está inactivo (message: "Su usuario no está habilitado") | "Su usuario no está habilitado"          |
  | 400    | `INVALID_EMAIL`             | El email no tiene formato válido (el formulario lo valida antes de enviarlo)                  | Error de formato del campo               |

- Códigos que la UI maneja en el ingreso del alumno (`POST /api/auth/sign-in/username`). Usuario inexistente, contraseña incorrecta o usuario con formato inválido muestran **lo mismo**, sin indicar cuál falló:

  | Status | `code`                         | Cuándo                                                                                        | Texto en la UI                           |
  | ------ | ------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------- |
  | 401    | `INVALID_USERNAME_OR_PASSWORD` | Usuario inexistente o contraseña incorrecta                                                   | "Usuario/email o contraseña incorrectos" |
  | 422    | `USERNAME_TOO_SHORT`           | Usuario de menos de 3 caracteres (antes de mirar la contraseña)                               | "Usuario/email o contraseña incorrectos" |
  | 422    | `USERNAME_TOO_LONG`            | Usuario de más de 50 caracteres (antes de mirar la contraseña)                                | "Usuario/email o contraseña incorrectos" |
  | 422    | `INVALID_USERNAME`             | Usuario con algo que no sea minúsculas, números, `.` o `-` (antes de mirar la contraseña)     | "Usuario/email o contraseña incorrectos" |
  | 403    | `USUARIO_INHABILITADO`         | Contraseña correcta, pero el usuario está inactivo (message: "Su usuario no está habilitado") | "Su usuario no está habilitado"          |

- El usuario no se cambia: `POST /api/auth/update-user` con un `username` distinto responde 400 `USERNAME_IS_IMMUTABLE`.

- La sesión vence por inactividad (60 minutos sin pedidos) y se renueva sola con el uso. `rememberMe` no cambia la duración. Una sesión vencida se ve en `/api/v1` como 401 `NO_AUTENTICADO`.
- Los endpoints de `/api/v1` responden 401 sin sesión válida, 403 `USUARIO_INHABILITADO` si el usuario fue dado de baja y 403 `SIN_PERMISO` si el rol no alcanza o si una cuenta `ALUMNO` no tiene alumno vinculado (ver tabla de errores).
- De qué capa sale cada respuesta: `arquitectura-backend.md` → Autenticación y autorización → Qué responde cada falla.
