# Sprint 2 — Tareas (HU-02, HU-03, HU-08, HU-11 a HU-21)

Repositorio: `aula-click` · Sprint: Iteración 2 · Estado inicial de todas las tareas: **Todo**

Estas tareas siguen `AGENTS.md` y `docs/`, y parten del estado de `testing` al cerrar el Sprint 1. Si una tarea y un doc se contradicen, manda el doc y se avisa para corregir la tarea. Las HU salen de `docs/sprint-2/backlog-sprint2.md`; el modelo de datos, del DER tentativo del Sprint 2.

Numeración: continúa la del Sprint 1 (**T-29 en adelante**). HU-21 (tablero del gerente) es **opcional**, igual que lo fue HU-10: sus tareas se marcan como tales, salvo el acceso del gerente, que lo necesita HU-12.

## Regla del sprint: tareas aisladas

En el Sprint 1 varias tareas terminaron editando los mismos archivos (por ejemplo, la API de turnos y la de la agenda tocaban las dos `turnos.*`). En este sprint **cada archivo tiene una sola tarea dueña** mientras dura su trabajo, para que todo se pueda hacer en paralelo. Para lograrlo:

1. **Tareas de reuso primero (bloqueantes, días 1 y 2).** Lo que más de una tarea necesita se construye una sola vez, en su propio PR, y el resto lo consume sin reimplementarlo:
   - T-29 modelo de datos (el único que toca `schema.prisma`, migraciones y seeds).
   - T-30 ocurrencias y reserva en `turnos` (el único que toca `turnos.condiciones` y mueve las agendas a su feature).
   - T-31 prioridad (`examenes.condiciones.ts`).
   - T-32 andamiaje del backend (el único que toca `src/server/app.ts` y `eslint.config.mjs`).
   - T-33 indicadores de turno, T-34 documento imprimible, T-35 andamiaje del frontend y T-36 segmento del gerente.
2. **Una feature por concepto nuevo**, con su carpeta propia en el back (`src/server/features/<f>/`) y en el front (`src/features/<f>/`): `agendas`, `ocurrencias`, `cancelaciones`, `finalizaciones`, `reprogramaciones`, `pagos`, `cuentas`, `examenes`, `documentos`, `tablero`. Ninguna tarea agrega endpoints a una feature que es de otra tarea.
3. **Slots con contrato fijo.** Donde varias HU muestran algo en la misma pantalla (acciones del detalle del turno, pestañas de la ficha del alumno, calendario dentro de la agenda, botón PDF), el andamiaje (T-35) deja un componente _placeholder_ por HU, **con sus props definitivas**, en la carpeta de la feature dueña, y lo compone desde `app/`. Cada tarea después sólo rellena su propio archivo.
4. **Documentación.** Es la única excepción aceptada: cada tarea escribe **sólo en la sección de su feature** de `contrato-api.md` y `dominio.md` (T-32 deja creadas las secciones) y agrega sus filas al final de `decisiones.md` con el próximo ID libre. Si hay conflicto, es de una línea y se resuelve en el merge.
5. Si durante una tarea aparece la necesidad de tocar un archivo que es de otra, **no se toca**: se avisa en el issue de la dueña (o se abre una tarea de reuso) y se acuerda quién lo hace.

## Orden y dependencias

```
Día 1 (en paralelo, sin dependencias):
  T-29 Modelo de datos + migración + seed ─────────┬──> T-30 Ocurrencias y reserva (turnos.condiciones) + feature agendas
  T-32 Andamiaje back (routers vacíos, app.ts) ────┘            │
  T-33 Indicadores de turno (UI)                                ├──> T-31 Prioridad (examenes.condiciones)   [sólo necesita T-29]
  T-34 Documento imprimible (UI)                                │
  T-35 Andamiaje front (agendas, slots, pestañas) ──────────────┤  (se conecta con las URLs nuevas de T-30)
  T-36 Segmento del gerente y menús (UI)                        │
                                                                ▼
Con T-29 mergeada:           T-37 FIX alumnos/profesores API ──> T-38 FIX formularios
                             T-39 Materias con precio API ─────> T-40 Materias UI (+ T-36)
                             T-55 Exámenes API (+ T-30) ───────> T-56 Exámenes UI
Con T-30 mergeada:           T-41 Registrar turno API ─────────> T-42 Registrar turno UI
                             T-43 Ocurrencias API (+ T-31) ────> T-44 Detalle del turno y turnos del alumno UI
                             T-45 Cancelar API ────────────────> T-46 Cancelar UI
                             T-47 Finalizar API ───────────────> T-48 Finalizar UI
                             T-49 Reprogramar API ─────────────> T-50 Reprogramar UI
                             T-51 Pagos API ───────────────────> T-52 Registrar pago y comprobante UI (+ T-34)
                             T-53 Cuentas API ─────────────────> T-54 Pagos del alumno y vista global UI
                             T-57 Agendas v2 API (+ T-31) ─────┬> T-58 Prioridad y filtros en las agendas UI
                                                               └> T-59 Calendario semanal UI
                             T-60 PDF de turno y agenda UI (T-34 + T-44 + T-58)
Opcional:                    T-61 Tablero API (+ T-53) ────────> T-62 Tablero UI (+ T-36)
```

- **T-29 y T-32 se mergean el día 1.** Nadie genera migraciones propias en todo el sprint: si a una tarea le falta un campo, se pide en T-29 (o en un FIX de T-29), no se agrega en su PR.
- **T-30 es la cadena crítica:** casi todo el backend de turnos cuelga de ella. Conviene tomarla temprano, con PR chico y revisión rápida. Mientras tanto, las tareas que la consumen pueden empezar contra las firmas que fija su alcance, con el repository mockeado en los tests (así se testean los services igual).
- Las pantallas pueden empezar en paralelo con su API contra el contrato escrito en cada tarea, igual que en el Sprint 1, y se conectan cuando la API se mergea.
- Los placeholders de T-35 no muestran nada (devuelven `null` o un texto "Próximamente"): la app sigue funcionando mientras las HU se completan.

## Mapa de archivos (quién es dueño de qué)

| Zona                                                                                                                                                                                                                                                                                                                                                         | Tarea dueña                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed*.ts`, `.env.example` (si hiciera falta)                                                                                                                                                                                                                                                           | T-29                                                                             |
| `src/server/app.ts`, `eslint.config.mjs`, `src/server/features/*/…routes.ts` vacíos iniciales                                                                                                                                                                                                                                                                | T-32                                                                             |
| `src/server/features/turnos/**` (incluye `*.condiciones.ts`) y `src/server/features/agendas/**`                                                                                                                                                                                                                                                              | T-30; después `turnos/*` (salvo condiciones) pasa a T-41 y `agendas/*` a T-57    |
| `src/server/features/examenes/examenes.condiciones.ts` (+ su test)                                                                                                                                                                                                                                                                                           | T-31                                                                             |
| `src/server/features/examenes/**` (salvo condiciones)                                                                                                                                                                                                                                                                                                        | T-55                                                                             |
| `src/server/features/alumnos/**`, `profesores/**` (validation y service)                                                                                                                                                                                                                                                                                     | T-37                                                                             |
| `src/server/features/materias/**`                                                                                                                                                                                                                                                                                                                            | T-39                                                                             |
| `src/server/features/ocurrencias/**`                                                                                                                                                                                                                                                                                                                         | T-43                                                                             |
| `cancelaciones/**`, `finalizaciones/**`, `reprogramaciones/**` (back)                                                                                                                                                                                                                                                                                        | T-45, T-47, T-49                                                                 |
| `pagos/**` (back) · `cuentas/**` (back) · `tablero/**` (back)                                                                                                                                                                                                                                                                                                | T-51 · T-53 · T-61                                                               |
| `src/components/turno/**`, tokens de color nuevos en `globals.css`                                                                                                                                                                                                                                                                                           | T-33                                                                             |
| `src/components/impresion/**`, `src/app/impresion.css`, `src/app/layout.tsx` (import), `src/hooks/use-imprimir.ts`, `app-shell.tsx`, `public/` (logo)                                                                                                                                                                                                        | T-34                                                                             |
| `src/features/agendas/**` (estructura), placeholders de todas las features nuevas, `app/mesa/_componentes/**`, `app/profesor/_componentes/**`, `AlumnoDetalle.tsx`, páginas de `app/mesa/agenda`, `app/profesor/agenda`, `app/mesa/alumnos/[alumnoId]`, `app/profesor/alumnos/[alumnoId]`, `app/mesa/pagos`, `features/turnos/components/RegistrarTurno.tsx` | T-35 (después, cada placeholder pasa a su tarea)                                 |
| `app/gerente/**`, `components/layout/*-sidebar.tsx`, `features/auth/roles.ts`, `SegmentoDeRol.tsx`                                                                                                                                                                                                                                                           | T-36 (después `app/gerente/materias` pasa a T-40 y `app/gerente/tablero` a T-62) |
| `features/alumnos` (form, edición, schema, `DatosAlumno.tsx`), `features/profesores` (form, edición, schema)                                                                                                                                                                                                                                                 | T-38                                                                             |
| `src/features/materias/**`, `app/mesa/materias/**`, `app/gerente/materias/**`                                                                                                                                                                                                                                                                                | T-40                                                                             |
| `features/turnos` (formulario, confirmación, rechazos, schema, types, api del alta, `RegistrarTurno.tsx` después de T-35)                                                                                                                                                                                                                                    | T-42                                                                             |
| `features/turnos` (archivos nuevos de reprogramación y `FiltrosDisponibilidad`, `ResultadosDisponibilidad`, `HorasDelBloque`)                                                                                                                                                                                                                                | T-50                                                                             |
| `src/features/ocurrencias/**` · `cancelaciones/**` · `finalizaciones/**` · `pagos/**` · `cuentas/**` · `examenes/**` · `documentos/**` (front)                                                                                                                                                                                                               | T-44 · T-46 · T-48 · T-52 · T-54 · T-56 · T-60                                   |
| `features/agendas`: tablas, filtros, `agendas.api.ts`, `agendas.types.ts`                                                                                                                                                                                                                                                                                    | T-58                                                                             |
| `features/agendas`: `CalendarioSemanal` y archivos nuevos del calendario                                                                                                                                                                                                                                                                                     | T-59                                                                             |

## Definición de Hecho (aplica a todas las tareas)

- Rama creada desde `testing` con el nombre indicado; PR a `testing` que referencia el issue (`Closes #N`). Nadie commitea directo a `testing` ni a `main`.
- **El PR sólo modifica archivos de los que la tarea es dueña** (ver el mapa). Si necesitó tocar otro, lo explica en la descripción del PR y lo acordó antes con la dueña.
- `pnpm check` pasa localmente y en el CI. `/revisar-arquitectura` no reporta violaciones.
- Backend: cada endpoint declarado con `createRoute()`, con todos sus status codes, errores con `ErrorResponseSchema`, y `requireAuth()` + `requireRole(...)`. Un test por service con el repository mockeado: camino feliz y un caso por cada error que lanza (`it.todo` no cuenta). Fechas con `hoy()` y reloj inyectable.
- Frontend: cada componente con datos maneja carga, vacío y error (401/403/404); llamadas sólo por `fetchJson` desde `features/<entidad>/api/`; **ninguna regla de negocio calculada en el cliente** (si una acción está permitida, cuánto cuesta un turno o qué prioridad tiene, lo dice la API).
- Nada se borra físicamente: las bajas son lógicas (`estado`); las cancelaciones, finalizaciones y reprogramaciones se registran en su tabla.
- Si el cambio toca el contrato de la API, una regla o la estructura, se actualiza la sección de la feature en el doc correspondiente en el mismo PR (`AGENTS.md`, regla 9).
- Al menos un integrante que no sea el autor revisa la PR.

## Vocabulario del sprint

- **Turno (serie):** una fila de `Turno`. Es la regla: alumno, materia, una hora de un bloque, tipo (`RECURRENTE` o `SESION_UNICA`) y rango de fechas. HU-08 sigue con el enfoque del Sprint 1 (decisiones T-37 y T-41): las fechas sin lugar **no se guardan**; se avisan al registrar y un recurrente con fechas llenas se guarda en **tramos** (varios `Turno` `RECURRENTE`). No hay tabla de excepciones.
- **Ocurrencia:** un turno en una fecha concreta. Es lo que se cancela, se paga, se reprograma y tiene prioridad. **Se identifica por `(turnoId, fecha original de la serie)`**, aunque después se reprograme a otra fecha u hora: así el pago y la cancelación siguen apuntando a la misma ocurrencia (HU-20: "el turno conserva su identidad y su pago").
- **Estado de una ocurrencia** (lo calcula la API): `AGENDADO`, `CANCELADO` o `SIN_REGISTRAR` (agendado de una fecha anterior a hoy; mientras no exista la HU de asistencia, todo turno pasado no cancelado es "Sin registrar"). La UI lo muestra como "Agendado", "Cancelado" y "Sin registrar".
- **Estado de pago:** `PENDIENTE` o `PAGADO` (hay un `PagoTurno` de un `Pago` `VIGENTE` para esa ocurrencia).

---

## T-29 · [Back] Modelo de datos del Sprint 2: esquema, migración y seed

- **HU:** Transversal (habilita HU-02, HU-08, HU-11 a HU-21)
- **Área:** Backend
- **Rama:** `feat/modelo-datos-sprint2`
- **Prioridad:** Bloqueante, se mergea el día 1

**Descripción**
Traducir el DER tentativo del Sprint 2 a `prisma/schema.prisma` en **una sola migración**, para que ninguna otra tarea del sprint toque el modelo. Es la única tarea que edita `schema.prisma`, `prisma/migrations/` y los seeds.

**Alcance**

1. `Materia.precioHora`: `Decimal(10,2)`, **nullable** (null = "Sin precio"). CHECK a mano: `precio_hora > 0` cuando no es nulo. En el `migration.sql`, después de agregar la columna: `UPDATE materia SET estado = 'INACTIVO' WHERE precio_hora IS NULL` (HU-12: las materias anteriores sin precio quedan inactivas).
2. `Turno`:
   - `motivoConsulta` pasa a **`observaciones`** (HU-08). En la migración se **renombra la columna** (`ALTER TABLE turno RENAME COLUMN motivo_consulta TO observaciones`), no se borra y se crea: Prisma genera drop/add y hay que corregir el SQL a mano para no perder datos.
   - Nuevo `temas` (`String?`): "Temas a trabajar". Que sea obligatorio en sesión única lo valida la API.
3. `CancelacionTurno` (DER): `turnoId`, `fechaOcurrencia` (`@db.Date`, fecha **original** de la ocurrencia), `motivo`, `detalle` (`VarChar(500)`, opcional), `createdById`, `createdAt`. `@@unique([turnoId, fechaOcurrencia])` (en este incremento no se deshace una cancelación).
   - Enum `MotivoCancelacion`: `CANCELACION_ALUMNO`, `CANCELACION_PROFESOR`, `PROBLEMA_ADMINISTRATIVO`, `OTRO` (lo comparten HU-13 y HU-14).
4. `FinalizacionRecurrencia` (DER): `turnoId` **único** (0..1 por turno), `fechaDesde`, `motivo` (`MotivoCancelacion`), `detalle` (`VarChar(500)`), `createdById`, `createdAt`.
5. `ReprogramacionTurno` (DER): `turnoId`, `fechaOrigen`, `bloqueAgendaOrigenId`, `fechaDestino`, `bloqueAgendaDestinoId`, `createdById`, `createdAt`. Índices por `(turnoId, fechaOrigen)` y por `(bloqueAgendaDestinoId, fechaDestino)` (este último lo usa la ocupación).
   - `fechaOrigen` es siempre la **fecha original** de la ocurrencia (su identidad). Si se reprograma dos veces, hay dos filas con la misma `fechaOrigen`: vale la última (por `createdAt`, `id` como desempate); las anteriores quedan como historial.
6. `Examen` reemplaza a `ExamenMateria` (DER): `alumnoId`, `materiaId`, `fecha`, `tipo`, `observaciones` (`VarChar(500)`), `estado` (baja lógica = "eliminar" de HU-17), auditoría completa. Enum `TipoExamen`: `PARCIAL`, `FINAL`, `RECUPERATORIO`, `TRABAJO_PRACTICO`, `OTRO`. Se saca el `@@unique([alumnoId, materiaId, fecha])` (la regla de "un examen pendiente por materia" es de la API); índice por `(alumnoId, materiaId, fecha)`. Si `examen_materia` tiene datos, la migración los copia.
7. `FormaPago` (DER): `nombre` único, `estado`, auditoría. El seed carga **"Efectivo"** (HU-15: único medio en este sprint; el ABM es HU-23, fuera de alcance).
8. `Pago` (DER): `alumnoId`, `formaPagoId`, `numeroComprobante` (`Int`, único, correlativo: `@default(autoincrement())` sobre una columna que no es la PK, o una secuencia en el SQL), `importeTotal` (`Decimal(10,2)`), `fechaPago` (`@db.Date`), `montoRecibido` (`Decimal(10,2)`, opcional), `observaciones` (`VarChar(500)`), `estado` (enum `EstadoPago`: `VIGENTE`, `ANULADO`), auditoría completa.
9. `PagoTurno` (DER): `pagoId`, `turnoId`, `fecha` (fecha **original** de la ocurrencia), `importeAplicado` (`Decimal(10,2)`). Índice por `(turnoId, fecha)`. Que una ocurrencia no se pague dos veces lo garantiza la API con lock (T-51), porque un pago anulado libera la ocurrencia.
10. `Alumno.email` y `Alumno.telefono` pasan a **nullable** (HU-02: son opcionales para menores; lo valida la API, T-37).
11. `Turno.estado` no cambia. A partir de este sprint una cancelación se registra **siempre** en `CancelacionTurno` (también la de una sesión única); el valor `CANCELADO` del enum queda sólo para datos anteriores. Dejarlo dicho en el comentario del modelo.
12. Relaciones inversas de auditoría en `Usuario` para todas las tablas nuevas.
13. Seeds:
    - `seed.ts`: precios para las materias de ejemplo, forma de pago "Efectivo". El usuario `GERENTE` ya existe: verificar que pueda iniciar sesión.
    - `seed-datos-demo.ts` / `seed-agenda-demo.ts`: pasar de `examenMateria` a `examen` y sumar datos para probar el sprint: exámenes cercanos y lejanos (prioridades Alta, Media y Baja), un recurrente guardado en tramos, una cancelación, una reprogramación, un pago con dos ocurrencias y turnos pasados impagos (deuda).
14. Documentación: `docs/dominio.md` → Turnos (serie, ocurrencia y su identidad; los tramos de T-37 siguen igual), Pagos y Exámenes; `docs/decisiones.md`: nueva decisión que fija la identidad de la ocurrencia.
15. La migración la genera y la aplica la persona con `pnpm db:migrate` (`AGENTS.md`, regla 10), y revisa a mano el SQL (rename, CHECK, update de materias).

**Criterios de aceptación**

- Con la base del Sprint 1, `pnpm db:migrate` no pierde datos: los `motivo_consulta` aparecen en `observaciones` y las materias sin precio quedan `INACTIVO`.
- Con la base vacía, migración + seed dejan todas las tablas nuevas y los datos de demo.
- Un `precio_hora <= 0` falla a nivel de base.
- El seed sigue siendo idempotente.

---

## T-30 · [Back] Reuso: ocurrencias y reserva en `turnos.condiciones`; agendas en su propia feature

- **HU:** Transversal (la usan HU-08, HU-13, HU-14, HU-15, HU-16, HU-18, HU-19, HU-20)
- **Área:** Backend
- **Rama:** `feat/turnos-ocurrencias`
- **Depende de:** T-29, T-32
- **Prioridad:** Bloqueante (cadena crítica)

**Descripción**
Seis features nuevas necesitan lo mismo: expandir un turno en sus ocurrencias, saber si una ocurrencia está cancelada, reprogramada o pagada, calcular la ocupación de una hora en una fecha, controlar que el alumno no se superponga y tomar los locks de la reserva. Hoy eso vive en `turnos.reglas.ts` y `turnos.service.ts`, que **otra feature no puede importar** (sólo repository o condiciones). Esta tarea lo publica **una sola vez** en las condiciones de `turnos`, para que nadie lo reimplemente. Además saca las agendas de `turnos` a su propia feature, para que las tareas de agenda (T-57) y de registrar turno (T-41) no editen los mismos archivos.

**Alcance**

1. Nuevo `src/server/features/turnos/ocurrencias.condiciones.ts` (reciben el cliente, `prisma` o `tx`, y de Prisma sólo importan tipos, decisión T-39):
   - `leerOcurrencias(client, filtro)`: `filtro = { desde, hasta, alumnoId?, profesorId?, materiaId?, aulaId?, turnoIds?, bloqueAgendaIds? }` (rango obligatorio). Devuelve `Ocurrencia[]`:
     `{ turnoId, fechaOriginal, fecha, bloqueAgendaId, diaSemana, horaInicio, horaFin, profesorId, aulaId, alumnoId, materiaId, tipo, estado: 'AGENDADO' | 'CANCELADO' | 'SIN_REGISTRAR', pago: { estado: 'PENDIENTE' | 'PAGADO', pagoId?, importeAplicado? }, reprogramadaDesde?: { fecha, bloqueAgendaId }, cancelacion?: { motivo, detalle, createdById, createdAt } }`.
     Reglas, en este orden: las fechas del rango del turno que caen en el día del bloque (respetando `fechaFin`, que HU-14 acorta; cada tramo es un turno propio, como hoy); cada reprogramación vigente mueve la ocurrencia a su destino (fecha y bloque); `CANCELADO` si hay `CancelacionTurno` para su fecha original; `SIN_REGISTRAR` si no está cancelada y su fecha efectiva es anterior a `hoy()`; `PAGADO` si hay un `PagoTurno` de un `Pago` `VIGENTE` con su fecha original. El filtro de rango, profesor, aula y bloque se aplica sobre la fecha y el bloque **efectivos** (una ocurrencia reprogramada aparece donde quedó, no donde estaba).
   - `ocupacionEn(client, { bloqueAgendaId, fecha, excluir?: { turnoId, fechaOriginal } })`: cuántas ocurrencias **ocupan lugar** (no canceladas) en esa hora y esa fecha, contando las que llegaron por reprogramación y sin contar las que se fueron.
   - `superposicionesDelAlumno(client, { alumnoId, fecha, horaInicio, horaFin, excluir? })`: ocurrencias no canceladas del alumno que se pisan en ese horario.
   - `bloquearParaReserva(tx, { profesorId, bloqueAgendaIds, alumnoId })`: los locks en el orden de T-38 (`profesor` `FOR SHARE`, filas de `bloque_agenda` por id `FOR UPDATE`, `alumno` `FOR UPDATE`). Lo usan el alta (T-41), la reprogramación (T-49), la cancelación (T-45), la finalización (T-47) y el pago (T-51), así no hay deadlocks entre ellas.
   - `materiasDelProfesorConAlumno(client, { profesorId, alumnoId })`: materias de los turnos del alumno con ese profesor (la usa T-55 para el profesor en exámenes).
   - Los tipos que devuelven se re-exportan desde el archivo (nadie importa la validation de `turnos`).
2. Las condiciones existentes de `turnos.condiciones.ts` (vigentes por materia, por bloques, por profesor y ocupación máxima por fila) pasan a contar con el mismo motor: una hora con una ocurrencia cancelada o reprogramada tiene ese lugar libre. **Sus firmas no cambian**, así `profesores`, `bloques`, `materias` y `alumnos` no se tocan.
3. `turnos.service`/`repository` (disponibilidad y alta) usan `ocupacionEn`, `superposicionesDelAlumno` y `bloquearParaReserva`. `expandirOcurrencias` y la lógica duplicada de `turnos.reglas.ts` se eliminan o se reducen a los predicados puros que usan las condiciones. El comportamiento con los datos del Sprint 1 no cambia: los tests actuales siguen pasando.
4. Mover a la feature **`agendas`** (router creado por T-32) los endpoints de agenda, sin cambiar su contrato salvo la URL:
   - `GET /turnos/agenda` → `GET /agendas/diaria`; `/turnos/agenda-propia` → `/agendas/propia`; `/turnos/agenda-profesor` → `/agendas/profesor`; `/turnos/materias` → `/agendas/materias`; `/turnos/aulas` → `/agendas/aulas`.
   - Sus services leen con `leerOcurrencias`. Por ahora siguen excluyendo las canceladas (mostrarlas es T-57).
   - Se mueven sus tests.
5. Quedan en `turnos`: disponibilidad, alta y detalle (`GET /turnos/{id}`).
6. Tests: del motor (excepcional, a nivel repository, como el de T-23) con un caso por regla del punto 1 (recurrente en tramos, cancelación, reprogramación dentro y fuera del rango, pago vigente y anulado, finalización, `SIN_REGISTRAR` con reloj fijo); de `ocupacionEn` con una reprogramación que entra y otra que sale.
7. Documentación: `convenciones-backend.md` (ocurrencias, "ocupa lugar" con las tablas nuevas, orden de locks compartido), `arquitectura-backend.md` (feature `agendas`, lista de features), `contrato-api.md` (URLs nuevas de las agendas; avisar al front: T-35 las conecta).

**Fuera de alcance**
Mostrar canceladas, prioridad y estado de pago en las agendas (T-57); `observaciones` y `temas` en el alta (T-41).

**Criterios de aceptación**

- Una ocurrencia cancelada o reprogramada libera su lugar: `ocupacionEn` y la disponibilidad lo reflejan.
- Una ocurrencia reprogramada ocupa lugar en su destino y el alumno no puede superponerse con ella.
- Las agendas responden en `/api/v1/agendas/*` igual que antes en `/turnos/*`.
- Ningún archivo fuera de `turnos/`, `agendas/` y los docs cambió.

---

## T-31 · [Back] Reuso: cálculo de la prioridad del turno (`examenes.condiciones.ts`)

- **HU:** HU-18 Prioridad del turno (la usan T-43 y T-57)
- **Área:** Backend
- **Rama:** `feat/examenes-prioridad`
- **Depende de:** T-29

**Descripción**
La prioridad se muestra en las agendas, en el calendario y en el detalle del turno, que son dos features distintas (`agendas` y `ocurrencias`). Para que el cálculo exista una sola vez, la feature dueña de los exámenes publica la lectura y la regla en sus condiciones.

**Alcance**

1. `src/server/features/examenes/examenes.condiciones.ts`:
   - `prioridadPorDias(dias: number | null)`: `ALTA` de 0 a 10, `MEDIA` de 11 a 20, `BAJA` más de 20 o `null` (sin examen).
   - `leerPrioridades(client, items: { alumnoId, materiaId, fecha }[])`: **una sola consulta** para todo el lote (exámenes `ACTIVO` de esos alumnos y materias con fecha `>=` la menor fecha pedida). Para cada ítem toma el próximo examen de esa materia con fecha `>=` la fecha del turno y devuelve `{ prioridad, examen?: { id, fecha, tipo, materiaNombre, dias } }` indexado por `alumnoId-materiaId-fecha`.
   - Las ocurrencias canceladas no se piden: las filtra quien llama.
2. Test de `examenes.condiciones` (función pura y lectura con cliente falso): 0 y 10 días → Alta; 11 y 20 → Media; 21 → Baja; sin examen → Baja; un examen anterior al turno no cuenta; un examen dado de baja no cuenta; dos turnos de la misma serie con el mismo examen dan prioridades distintas.
3. `docs/dominio.md` → Prioridad: la regla con los exámenes nuevos (el examen puede ser el mismo día: Alta).

**Criterios de aceptación**

- La prioridad no se persiste y cambia en la próxima consulta si cambia un examen.
- La consulta es una sola por lote, no una por turno.

---

## T-32 · [Back] Andamiaje: features nuevas registradas y secciones de docs

- **HU:** Transversal
- **Área:** Backend
- **Rama:** `feat/andamiaje-sprint2-api`
- **Prioridad:** Bloqueante, se mergea el día 1 (es chica)

**Descripción**
`src/server/app.ts` es un punto de conflicto (`AGENTS.md` → Flujo de trabajo). Esta tarea registra de una vez todas las features del sprint con routers vacíos, para que ninguna otra tarea tenga que tocar `app.ts`.

**Alcance**

1. Crear `src/server/features/<f>/<f>.routes.ts` con `export const <f>Routes = createRouter()` (sin endpoints) para: `agendas`, `ocurrencias`, `cancelaciones`, `finalizaciones`, `reprogramaciones`, `pagos`, `cuentas`, `examenes`, `tablero`.
2. Registrarlas en `src/server/app.ts`, una línea cada una (`app.route('/<f>', <f>Routes)`).
3. Verificar en `eslint.config.mjs` que un archivo `turnos/ocurrencias.condiciones.ts` y `examenes/examenes.condiciones.ts` quedan cubiertos por las reglas de condiciones (importables desde otras features, con Prisma sólo en tipos). Si hace falta ajustar el config o el test `eslint-limites.test.ts`, se hace acá: es la única tarea del sprint que toca `eslint.config.mjs`.
4. Documentación, para que cada tarea escriba sólo en lo suyo:
   - `docs/contrato-api.md`: una sección vacía por feature nueva ("A completar por T-xx").
   - `docs/dominio.md`: secciones Cancelación, Finalización, Reprogramación, Pagos, Deuda, Exámenes y Prioridad, con la tarea que las completa.
   - `docs/arquitectura-backend.md`: lista de features del Sprint 2 y una línea de qué es cada una.
   - `AGENTS.md` → Alcance: Sprint 2.

**Criterios de aceptación**

- `pnpm check` pasa y `/api/v1/docs` sigue funcionando.
- Ninguna otra tarea del sprint necesita modificar `app.ts` ni `eslint.config.mjs`.

---

## T-33 · [Front] Reuso: indicadores de estado, pago y prioridad del turno

- **HU:** HU-13, HU-15, HU-16, HU-18, HU-19 (la usan T-44, T-54, T-58, T-59, T-60)
- **Área:** Frontend
- **Rama:** `feat/ui-indicadores-turno`
- **Prioridad:** Día 1, sin dependencias

**Descripción**
El estado de un turno, su estado de pago y su prioridad se muestran en las agendas, el calendario, el detalle, la ficha del alumno y los pagos. Se construyen una sola vez como componentes de UI sin entidad.

**Alcance**

1. `src/components/turno/` (sólo reciben props planas; no importan de `features`):
   - `EstadoTurnoBadge({ estado })`: "Agendado", "Cancelado", "Sin registrar", cada uno con su color (la HU de estados está "a definir": usar las variantes de `Badge` que ya existen y dejar los colores en un solo lugar).
   - `EstadoPagoBadge({ estado })`: "Pendiente" / "Pagado".
   - `PrioridadIndicador({ prioridad, examen?, variante: 'fila' | 'punto' | 'detalle' })`: franja lateral y punto de color con la palabra escrita (HU-18). Alta en rojo, Media en amarillo, Baja **sin distintivo** salvo en `detalle`. Tooltip con el examen que la determina: "Examen de Matemática el 15/10 (en 5 días)".
2. Los tokens de color nuevos (prioridad alta y media) en `globals.css`, siguiendo la paleta de T-13/T-28. El canal visual de la prioridad tiene que ser distinto del de estado (franja + punto, no un badge igual al de estado).
3. Texto del tooltip armado con `date-fns` desde los datos que manda la API (días incluidos): el componente no calcula la prioridad.
4. Documentar los componentes en `docs/arquitectura-frontend.md` → Componentes compartidos.

**Criterios de aceptación**

- Los tres componentes se ven bien en tema claro y oscuro y en mobile.
- Una prioridad Baja no muestra distintivo en una fila y sí se lee en el detalle.

---

## T-34 · [Front] Reuso: documento imprimible con el encabezado oficial del centro

- **HU:** HU-11 PDF de turno y agenda; HU-15 (comprobante)
- **Área:** Frontend
- **Rama:** `feat/ui-documento-imprimible`
- **Prioridad:** Día 1, sin dependencias

**Descripción**
HU-11 y HU-15 piden documentos oficiales con el mismo encabezado, que se guardan como PDF desde el diálogo de impresión del navegador, en A4 y sin el menú ni los botones. Se construye una vez y lo usan T-52 (comprobante) y T-60 (turno y agenda).

**Alcance**

1. `src/components/impresion/datos-centro.ts`: nombre, dirección y teléfono del centro como constantes, y el logo en `public/` (HU-11: vienen precargados, sin pantalla para editarlos). **Pedir los datos reales a las PO**; mientras tanto, valores de ejemplo marcados.
2. `DocumentoOficial({ titulo, emitidoPor, children })`: encabezado con logo, nombre, dirección, teléfono y fecha y hora de emisión (del navegador, formateada con `date-fns`), y el contenido.
3. `src/app/impresion.css` (importado en el layout raíz): `@page { size: A4 }`, márgenes, y en `@media print` se ocultan el sidebar, el header y todo lo marcado con `data-no-imprimir`. `app-shell.tsx` marca sus partes.
4. `src/hooks/use-imprimir.ts`: `useImprimirCuandoEsteListo(listo: boolean)` llama a `window.print()` una sola vez cuando los datos cargaron.
5. Página de prueba sólo en desarrollo o un ejemplo en el doc, para verificar el A4.
6. `docs/arquitectura-frontend.md` → Documentos imprimibles: el patrón (ruta propia `/…/imprimir` o `/…/comprobante` que usa `DocumentoOficial` y `useImprimirCuandoEsteListo`).

**Criterios de aceptación**

- En la vista previa de impresión sólo se ve el documento, en A4, con el encabezado completo.
- No se agrega ninguna dependencia (se usa el diálogo del navegador).

---

## T-35 · [Front] Andamiaje: feature `agendas`, detalle del turno con acciones y pestañas de la ficha del alumno

- **HU:** Transversal (habilita HU-02, HU-11, HU-13 a HU-20 en el frontend)
- **Área:** Frontend
- **Rama:** `feat/andamiaje-sprint2-ui`
- **Depende de:** T-30 para las URLs de las agendas (puede empezar en paralelo y conectarse al final)
- **Prioridad:** Bloqueante para el frontend, días 1 y 2

**Descripción**
Varias HU muestran algo en las mismas pantallas: el detalle del turno tiene las acciones de cancelar, finalizar, reprogramar, registrar pago y PDF; la ficha del alumno suma las pestañas Turnos, Exámenes y Pagos; la agenda suma el calendario y el botón PDF. Si cada HU editara esos archivos, chocarían. Esta tarea deja la estructura armada con **un placeholder por HU, con sus props definitivas**, compuesto desde `app/` (mismo patrón que `renderAgenda` en la ficha del profesor). Después cada tarea sólo completa su archivo.

**Alcance**

1. **Feature `agendas`:** mover de `features/turnos` a `features/agendas` todo lo de agenda (componentes `Agenda*`, `NavegacionFecha`, `SelectorVistaAgenda`, `FiltroProfesorAgenda`, sus hooks, api, keys, types y tests) y apuntar a las URLs nuevas `/api/v1/agendas/*` (T-30). Sin cambios visuales.
2. **Features nuevas del front**, cada una con `api/<f>.keys.ts`, un hook `use-invalidar-<f>.ts` (para que otras features refresquen su caché después de una mutación, usando sólo hooks) y sus placeholders:

   | Feature          | Placeholder (props definitivas)                                                                                             | Lo completa |
   | ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------- |
   | `ocurrencias`    | `OcurrenciaDetalle({ turnoId, fecha, onCerrar, renderAcciones })`, `TurnosDelAlumno({ alumnoId, renderAccionesSeleccion })` | T-44        |
   | `cancelaciones`  | `AccionCancelarTurno({ ocurrencia })`, `AccionCancelarVarios({ alumnoId, ocurrencias, onListo })`                           | T-46        |
   | `finalizaciones` | `AccionFinalizarTurno({ ocurrencia })`                                                                                      | T-48        |
   | `turnos`         | `AccionReprogramarTurno({ ocurrencia })`                                                                                    | T-50        |
   | `pagos`          | `AccionRegistrarPago({ ocurrencia })`, `RegistrarPagoDialog({ alumnoId, ocurrencias, onCerrar })`                           | T-52        |
   | `cuentas`        | `PagosDelAlumno({ alumnoId, renderRegistrarPago })`, `PagosGlobal({ renderRegistrarPago })`                                 | T-54        |
   | `examenes`       | `ExamenesDelAlumno({ alumnoId, rol })`                                                                                      | T-56        |
   | `documentos`     | `AccionPdfTurno({ ocurrencia })`, `BotonPdfAgenda({ fecha, filtros })`                                                      | T-60        |
   | `agendas`        | `CalendarioSemanal({ origen, filtros, renderDetalle })`                                                                     | T-59        |
   - El tipo de `ocurrencia` que reciben las acciones es `OcurrenciaDetalle` del contrato de T-43; se declara en `src/types/ocurrencia.ts` (tipo compartido, para que ninguna feature importe los types de otra). Incluye `acciones: { cancelar, finalizar, reprogramar, registrarPago }`, que calcula la API: cada acción decide si se muestra con ese dato, nunca con reglas propias.

3. **Detalle del turno compuesto:** `src/app/mesa/_componentes/detalle-turno.tsx` arma `OcurrenciaDetalle` con `renderAcciones` = Reprogramar, Cancelar, Finalizar, Registrar pago y PDF. `src/app/profesor/_componentes/detalle-turno.tsx`, sin acciones (el profesor no cancela ni reprograma en este incremento).
   - Se abre con `?detalle=<turnoId>&fecha=<fechaOriginal>` sobre la pantalla que lo muestra.
   - Las pantallas de agenda (`features/agendas`) reciben `renderDetalle` desde su página de `app/`.
   - `RegistrarTurno` (confirmación del alta) abre el mismo detalle con la primera fecha del turno. Se elimina `TurnoDetalleModal`.
4. **Agendas (las tres: diaria, de un profesor y "Mi agenda"):**
   - Selector **"Calendario / Lista"** (HU-19), que recuerda la última vista **por usuario** en `localStorage` (clave con el id del usuario, con `try/catch`). La vista Calendario renderiza el placeholder `CalendarioSemanal`.
   - Hook `use-filtros-agenda.ts` con el estado de los filtros en la URL, **incluidos `estado` y `prioridad`** aunque todavía no haya controles: lo consumen la lista (T-58) y el calendario (T-59).
   - En la agenda diaria, el slot `BotonPdfAgenda` en el encabezado.
5. **Ficha del alumno:** `AlumnoDetalle` pasa a tener pestañas en la URL (`?tab=datos|turnos|examenes|pagos`, como la del profesor) con `renderTurnos`, `renderExamenes` y `renderPagos`. Se extrae `DatosAlumno` a su propio archivo (lo toca T-38). Composición:
   - `app/mesa/alumnos/[alumnoId]/page.tsx`: las cuatro pestañas; Turnos con `TurnosDelAlumno` y `renderAccionesSeleccion` = `AccionCancelarVarios`; Pagos con `PagosDelAlumno` y `renderRegistrarPago` = `RegistrarPagoDialog`.
   - `app/profesor/alumnos/[alumnoId]/page.tsx`: Datos y Exámenes.
6. **Página `app/mesa/pagos/page.tsx`** con `PagosGlobal` y `renderRegistrarPago`.
7. `docs/arquitectura-frontend.md`: estructura con las features nuevas, el patrón de acciones en slots compuestas desde `app/_componentes`, y la regla de que una acción se muestra según `ocurrencia.acciones`.

**Criterios de aceptación**

- La app se ve y funciona igual que al cerrar el Sprint 1, con las pestañas y el selector nuevos vacíos.
- Cada placeholder existe con las props de la tabla y compila.
- Ninguna feature importa componentes de otra: todo se compone en `app/`.

---

## T-36 · [Front] HU-21 · Segmento del gerente, menús y "No tiene permiso"

- **HU:** HU-21 Tablero del gerente (acceso; lo necesita HU-12) y HU-16 (menú "Pagos")
- **Área:** Frontend
- **Rama:** `feat/gerente-segmento-ui`
- **Prioridad:** Día 1, sin dependencias (el usuario gerente ya está en el seed)

**Descripción**
El gerente pasa a tener acceso con su propia sección. Esta tarea arma el segmento `/gerente` y cambia la navegación entre roles; no construye las pantallas de materias ni del tablero.

**Alcance**

1. `features/auth/roles.ts`: `GERENTE` → `/gerente`. Al iniciar sesión, el gerente llega a `/gerente/tablero`.
2. `app/gerente/layout.tsx` con `AppShell` y `GerenteSidebar` (en `components/layout/`): "Tablero" y "Materias". "Formas de pago" (HU-23) no entra en este sprint: no se muestra.
3. Placeholders: `app/gerente/page.tsx` (redirige a tablero), `app/gerente/tablero/page.tsx` (título; lo completa T-62) y `app/gerente/materias/page.tsx` (título; lo completa T-40).
4. `SegmentoDeRol`: si un usuario entra a un segmento de otro rol, en lugar de redirigir muestra **"No tiene permiso para acceder a esta sección"** con un enlace a su pantalla de inicio (HU-21). Vale para los tres roles. Sigue siendo navegación, no seguridad.
5. `mesa-sidebar.tsx`: nueva opción **"Pagos"** (`/mesa/pagos`, página de T-35).
6. `UserMenu` muestra nombre y rol "Gerente".
7. `docs/arquitectura-frontend.md` → Roles y URLs: `/gerente` existe; el aviso de permiso.

**Criterios de aceptación**

- El gerente del seed inicia sesión, llega a Tablero y ve sólo su menú.
- Un gerente que escribe `/mesa/alumnos` ve el aviso con el enlace a su inicio; un usuario de mesa que escribe `/gerente` también.
- Mesa de entradas ve "Pagos" en su menú.

---

## T-37 · [Back] FIX · HU-02 / HU-03 · DNI no editable y contacto del alumno según la edad

- **HU:** HU-02 Gestión de datos del alumno; HU-03 Gestión de datos del profesor
- **Área:** Backend
- **Rama:** `fix/alumnos-profesores-sprint2-api`
- **Depende de:** T-29 (email y teléfono del alumno nullable)

**Descripción**
El backlog del Sprint 2 cambia dos reglas ya implementadas: el DNI deja de poder modificarse (antes se podía editar a uno no usado) y el email y el teléfono del alumno pasan a ser obligatorios sólo si es mayor de edad (corrige la decisión T-25). La capacidad del profesor frente a los turnos vigentes ya está (T-15): sólo se verifica que siga cubierta con el motor nuevo.

**Alcance**

1. `alumnos`:
   - Alta: obligatorios nombre, apellido, DNI y fecha de nacimiento; **si es mayor**, también email y teléfono; **si es menor**, email y teléfono propios opcionales y obligatorios nombre, apellido, teléfono y email del tutor (el DNI del tutor sigue opcional). Un solo 400 `VALIDACION` con todos los campos faltantes en `details`, como hoy.
   - Edición: `PATCH` con `dni` → 400 `VALIDACION` "El DNI no se puede modificar" (se rechaza, no se ignora). Las reglas de edad se evalúan sobre el alumno resultante: si al cambiar la fecha de nacimiento pasa a ser mayor y le falta email o teléfono → 400 con esos campos.
   - DTOs: `email` y `telefono` pueden ser `null`.
2. `profesores`: `PATCH` con `dni` → 400 con el mismo mensaje. Un test que confirme que la regla de capacidad (`CAPACIDAD_INSUFICIENTE`) sigue funcionando.
3. Tests del service: mayor sin email → 400; menor sin email propio y con tutor → 201; edición de un menor que pasa a mayor sin email → 400; intento de cambiar DNI (alumno y profesor) → 400.
4. Documentación: `dominio.md` → Alumnos y Profesores; `decisiones.md` → T-25 actualizada; `contrato-api.md` (campos nullable, DNI no editable).

**Criterios de aceptación**

- Un alumno menor se guarda sin email ni teléfono propios si tiene los datos del tutor.
- Ningún `PATCH` puede cambiar el DNI de un alumno o de un profesor.

---

## T-38 · [Front] FIX · HU-02 / HU-03 · Formularios de alumno y profesor

- **HU:** HU-02, HU-03
- **Área:** Frontend
- **Rama:** `fix/alumnos-profesores-sprint2-ui`
- **Depende de:** T-37 (puede empezar en paralelo), T-35 (extrae `DatosAlumno`)

**Alcance**

1. Formulario de alumno: email y teléfono marcados como obligatorios sólo si es mayor (ayuda visual con el cálculo de edad que ya existe, T-28; la validación es de la API). En la edición, el DNI se muestra como dato de sólo lectura y no se envía.
2. `DatosAlumno`: email y teléfono vacíos se muestran como "—".
3. Formulario de profesor: en la edición, el DNI de sólo lectura y fuera del body.
4. Los 400 de la API se muestran en el campo correspondiente (incluido el caso "pasa a ser mayor").
5. Archivos: `features/alumnos` (`alumnos.schema.ts`, `AlumnoForm`, `AlumnoEditar`, `AvisoMenorDeEdad`, `DatosAlumno`) y `features/profesores` (`profesores.schema.ts`, `ProfesorForm`, `ProfesorEditar`). No toca `AlumnoDetalle` ni `ProfesorDetalle`.

**Criterios de aceptación**

- Dar de alta un menor sin email propio funciona; un mayor sin email marca el campo.
- En ninguna edición se puede cambiar el DNI.

---

## T-39 · [Back] HU-12 · API de materias con precio, exclusiva del gerente

- **HU:** HU-12 Gestión de materias con precio
- **Área:** Backend
- **Rama:** `feat/materias-precio-api`
- **Depende de:** T-29

**Descripción**
El catálogo de materias pasa a tener precio por hora y lo administra sólo el gerente. Mesa de entradas conserva la lectura.

**Alcance**

1. Roles: `POST /materias`, `PATCH /materias/{id}`, `PATCH /materias/{id}/baja` y `PATCH /materias/{id}/reactivacion` sólo `GERENTE` (403 para el resto, aunque llamen por fuera de la pantalla). Listado, detalle y selector: `MESA_ENTRADAS` y `GERENTE` (y los roles que ya los usan).
2. Alta y edición con `precioHora`: número mayor a 0 con hasta dos decimales (en JSON como número; en la base `Decimal(10,2)`). Nombre único sin tildes ni mayúsculas, como hoy. Descripción opcional.
3. **Nuevo `PATCH /materias/{id}`** (edición de nombre, descripción y precio) y **nuevo `PATCH /materias/{id}/reactivacion`** (con confirmación en el front). Reactivar una materia sin precio → 409 `MATERIA_SIN_PRECIO` (primero hay que cargarlo).
4. Listado y detalle con `precioHora` y `sinPrecio`; el listado mantiene filtro por estado y buscador.
5. Baja: se mantiene la regla (sin profesores asignados; si los tiene, 409 con cuántos y cuáles).
6. Cambiar el precio no toca `PagoTurno.importeAplicado` (los pagos guardan su importe): no hay nada que hacer, sólo un test que lo confirme conceptualmente en el service (no se actualiza nada más que la materia).
7. Tests del service: precio 0 o con tres decimales → 400; mesa de entradas → 403 en cada escritura; reactivar sin precio → 409; edición con nombre duplicado → 409.
8. Documentación: `contrato-api.md` → Materias (roles, campos, códigos); `dominio.md` → Materias.

**Criterios de aceptación**

- Un usuario de mesa no puede crear, editar, dar de baja ni reactivar una materia (403), y sí listarla y verla con su precio.
- Las materias sin precio aparecen inactivas y marcadas "Sin precio", y no salen en el selector.

---

## T-40 · [Front] HU-12 · Pantallas de materias para el gerente y de sólo lectura para mesa

- **HU:** HU-12
- **Área:** Frontend
- **Rama:** `feat/materias-precio-ui`
- **Depende de:** T-39, T-36 (puede empezar en paralelo)

**Alcance**

1. `features/materias`: precio en el formulario (alta y edición), en el listado ("Sin precio" como etiqueta) y en el detalle; botón "Editar"; botón "Reactivar" con confirmación en las inactivas; baja con confirmación como hoy.
2. Las acciones de escritura se muestran sólo si el rol de la sesión es `GERENTE` (la seguridad la da la API: un 403 se maneja igual).
3. `app/gerente/materias/**`: listado, nueva y detalle (mismo patrón de modal que mesa). `app/mesa/materias/**`: sin "+ Nueva materia" ni acciones.
4. Precio formateado en pesos con dos decimales.

**Criterios de aceptación**

- El gerente da de alta, edita (incluido el precio), da de baja y reactiva una materia.
- Mesa de entradas ve el listado con precios y el detalle, sin botones de escritura.

---

## T-41 · [Back] HU-08 · Registrar turno: observaciones y temas a trabajar

- **HU:** HU-08 Registrar turno
- **Área:** Backend
- **Rama:** `feat/turnos-alta-sprint2-api`
- **Depende de:** T-30 (dueña de `turnos/*` hasta mergearse)

**Descripción**
El alta de turnos existe (T-21) y el manejo de fechas sin lugar **se mantiene como quedó al cerrar el Sprint 1**: se avisan al registrar, "Asignar igual" guarda el recurrente en tramos y no se guardan excepciones (decisiones T-37 y T-41). Lo único que cambia HU-08 en este sprint son dos campos: el "motivo de consulta" pasa a llamarse "Observaciones" y aparecen los "Temas a trabajar".

**Alcance**

1. `POST /turnos`: `motivoConsulta` pasa a **`observaciones`** (opcional) y se agrega **`temas`**: opcional si es `RECURRENTE`, **obligatorio si es `SESION_UNICA`** (400 `VALIDACION` en `temas`). Con "Asignar igual", todos los tramos de una hora llevan las mismas observaciones y temas.
2. `GET /turnos/{id}` (detalle del turno o tramo): `observaciones` y `temas` en lugar de `motivoConsulta`.
3. Sin cambios en disponibilidad, `BLOQUE_LLENO`, `fechasSinTurno`, tramos ni `asignarDondeHayLugar` (la ocupación ya descuenta cancelaciones y reprogramaciones por T-30).
4. Tests del service: sesión única sin temas → 400; recurrente sin temas → 201; los tramos de "Asignar igual" copian observaciones y temas; ejemplos del OpenAPI actualizados.
5. Documentación: `contrato-api.md` → Turnos (campos renombrados y nuevos), `dominio.md` → Turnos. Anotar en `decisiones.md` que HU-08 del Sprint 2 ("excepciones" y "fechas exceptuadas en el detalle") se resuelve con el enfoque del Sprint 1: aviso al registrar y tramos, sin guardar excepciones.

**Criterios de aceptación**

- Una sesión única sin temas a trabajar se rechaza; un recurrente sin temas se registra.
- "Asignar igual" sigue funcionando exactamente como al cerrar el Sprint 1.

---

## T-42 · [Front] HU-08 · Registrar turno: observaciones y temas a trabajar

- **HU:** HU-08
- **Área:** Frontend
- **Rama:** `feat/turnos-alta-sprint2-ui`
- **Depende de:** T-41 (puede empezar en paralelo), T-35

**Alcance**

1. `TurnoForm`: campo "Observaciones" (reemplaza "Motivo de consulta") y "Temas a trabajar", marcado obligatorio cuando el tipo es "Sesión única" (el 400 de la API se muestra en el campo).
2. `ConfirmacionTurno`: muestra observaciones y temas. El aviso de fechas sin turno, "Asignar igual" y los tramos quedan como están (Sprint 1).
3. `turnos.schema.ts`, `turnos.types.ts`, `turnos.api.ts` del alta con los campos nuevos.
4. Archivos propios: `TurnoForm`, `ConfirmacionTurno`, `RechazoAlta`, `RegistrarTurno` (después de T-35) y los de schema/types/api del alta. **No toca** `FiltrosDisponibilidad`, `ResultadosDisponibilidad` ni `HorasDelBloque` (son de T-50).

**Criterios de aceptación**

- Una sesión única no se puede confirmar sin temas; los temas y las observaciones se ven en la confirmación y en el detalle.
- El recorrido de un recurrente con fechas llenas sigue igual que en el Sprint 1.

---

## T-43 · [Back] Ocurrencias: detalle de un turno en una fecha y turnos del alumno

- **HU:** HU-02 (turnos en la ficha), HU-13, HU-14, HU-15, HU-18, HU-20 (el detalle desde el que se opera)
- **Área:** Backend
- **Rama:** `feat/ocurrencias-api`
- **Depende de:** T-30, T-31

**Descripción**
Todas las acciones del sprint se hacen desde el detalle de un turno en una fecha. Esta feature es la lectura de ese detalle y de los turnos de un alumno, y **calcula en la API qué acciones están permitidas**, para que ninguna pantalla repita las reglas.

**Alcance**

1. `GET /ocurrencias/{turnoId}/{fecha}` (`fecha` = fecha original). Roles: `MESA_ENTRADAS`; `PROFESOR` sólo si el turno es suyo (403 si no), con todas las acciones en `false`. Devuelve:
   - alumno (id, nombre, apellido, DNI), materia, profesor, aula, fecha y horario **efectivos**, tipo;
   - serie: período (`fechaInicio`, `fechaFin`), fechas reprogramadas (la fecha original de cada ocurrencia que se movió, HU-20), finalización ("Finalizada el …", motivo, detalle, quién y cuándo);
   - `estado` (`AGENDADO` / `CANCELADO` / `SIN_REGISTRAR`), `observaciones`, `temas`;
   - `pago`: `PENDIENTE` o `PAGADO` con importe, forma de pago, fecha, número de comprobante, `pagoId` y quién lo registró; si está pendiente, el **importe vigente** (precio de la materia);
   - `cancelacion`: motivo, detalle, quién y cuándo;
   - `reprogramacion`: desde qué fecha, hora y profesor se movió, quién y cuándo;
   - `prioridad` y el examen que la determina (T-31), salvo cancelada;
   - auditoría (quién creó el turno y quién lo modificó por última vez);
   - `acciones`: `{ cancelar: { visible, habilitada, motivo? }, finalizar: { visible }, reprogramar: { visible }, registrarPago: { visible } }` con las reglas de HU-13 (agendado, pendiente, hoy o posterior; si está pagada, visible pero deshabilitada con "El turno está pagado. Para cancelarlo, primero hay que anular el pago"), HU-14 (recurrente vigente, no finalizado), HU-20 (agendado, hoy o posterior) y HU-15 (no cancelado, pendiente).
   - 404 si el turno no existe o esa fecha no es una ocurrencia suya.
2. `GET /ocurrencias?alumnoId&desde?&hasta?` (`MESA_ENTRADAS`): las ocurrencias del alumno, por defecto desde 30 días atrás hasta 8 semanas adelante (rango máximo acotado, como las agendas), ordenadas por fecha y hora, cada una con estado, estado de pago, prioridad, profesor, materia y `cancelable` (mismas reglas que `acciones.cancelar`).
3. Todo con `leerOcurrencias` (T-30) y `leerPrioridades` (T-31): la feature no reimplementa expansiones ni prioridades.
4. Tests del service con reloj fijo: cada combinación de `acciones` (pasada, cancelada, pagada, sesión única vs recurrente, finalizada), profesor ajeno → 403, fecha que no es ocurrencia → 404.
5. `contrato-api.md` → Ocurrencias (y el tipo que comparte el front, `src/types/ocurrencia.ts`).

**Criterios de aceptación**

- El detalle de una ocurrencia reprogramada muestra su fecha nueva y desde dónde se movió.
- Las acciones permitidas salen siempre de la API.

---

## T-44 · [Front] Detalle del turno y pestaña "Turnos" de la ficha del alumno

- **HU:** HU-02 (turnos del alumno), HU-13 a HU-20 (detalle)
- **Área:** Frontend
- **Rama:** `feat/ocurrencias-ui`
- **Depende de:** T-43, T-35, T-33

**Alcance**

1. `features/ocurrencias`: `api`, hooks `useOcurrencia`, `useOcurrenciasDelAlumno`. Si el contrato final de T-43 difiere del tipo que dejó T-35, esta tarea ajusta `src/types/ocurrencia.ts` (pasa a ser suya) y avisa a T-46, T-48, T-50, T-52 y T-60.
2. `OcurrenciaDetalle`: todos los datos de T-43 con `EstadoTurnoBadge`, `EstadoPagoBadge` y `PrioridadIndicador variante="detalle"`; secciones de pago, cancelación, reprogramación, serie (período del tramo, fechas reprogramadas, finalización) y trazabilidad; `renderAcciones(ocurrencia)` al pie.
3. `TurnosDelAlumno`: lista (fecha, horario, materia, profesor, estado, pago, prioridad), clic abre el detalle; casilla de selección sólo en las `cancelable`; "Seleccionar todos" / "Quitar selección"; `renderAccionesSeleccion(seleccionadas)`.
4. Estados de carga, vacío ("Sin turnos") y error.

**Criterios de aceptación**

- Desde la agenda y desde la ficha del alumno se abre el mismo detalle, con sus datos y las acciones que manda la API.
- La pantalla no decide ninguna regla: sólo usa `acciones` y `cancelable`.

---

## T-45 · [Back] HU-13 · API de cancelación de turnos

- **HU:** HU-13 Cancelar un turno
- **Área:** Backend
- **Rama:** `feat/cancelaciones-api`
- **Depende de:** T-30

**Alcance**

1. `POST /cancelaciones` (`MESA_ENTRADAS`), body `{ ocurrencias: [{ turnoId, fecha }], motivo, detalle? }`:
   - `motivo` del enum `MotivoCancelacion`; `detalle` hasta 500 caracteres, **obligatorio si `motivo = OTRO`** (400).
   - Todas las ocurrencias del **mismo alumno** (400 si no).
   - **Todo o nada**, en una transacción con `bloquearParaReserva` y relectura con `leerOcurrencias`: cada una tiene que estar `AGENDADO`, con pago `PENDIENTE` y fecha efectiva hoy o posterior. Si alguna no cumple → 409 `TURNOS_NO_CANCELABLES` con `details` por ocurrencia y el motivo (`PAGADO`, `PASADO`, `YA_CANCELADO`, `NO_EXISTE`), y no se cancela ninguna.
   - Inserta una `CancelacionTurno` por ocurrencia (fecha original), también para una sesión única. Responde `{ cantidad }`.
2. Una cancelación sólo afecta a esa fecha: el resto de la serie sigue igual (lo garantiza el motor).
3. Tests del service: una y varias; una pagada entre varias → 409 sin cancelar nada; `OTRO` sin detalle → 400; pasada → 409; carrera con un pago simultáneo (el lock serializa).
4. Documentación: `contrato-api.md` → Cancelaciones (código nuevo `TURNOS_NO_CANCELABLES`), `dominio.md` → Cancelación.

**Criterios de aceptación**

- Cancelar una fecha de una serie libera sólo esa fecha: la hora vuelve a tener lugar ese día.
- Una ocurrencia pagada no se cancela.

---

## T-46 · [Front] HU-13 · Cancelar uno o varios turnos

- **HU:** HU-13
- **Área:** Frontend
- **Rama:** `feat/cancelaciones-ui`
- **Depende de:** T-45, T-35 (puede empezar en paralelo)

**Alcance**

1. `AccionCancelarTurno`: botón "Cancelar turno" según `ocurrencia.acciones.cancelar`; deshabilitado con la aclaración de pago cuando corresponde.
2. `AccionCancelarVarios` y un diálogo común: motivo (lista), detalle (obligatorio con "Otro", contador de 500), confirmación con el resumen ("¿Cancelar el turno de Matemática de Ana Pérez del lunes 12/10 de 9:00 a 10:00?" o la lista completa con la cantidad).
3. Mensajes: "Turno cancelado. El lugar quedó disponible." / "Se cancelaron N turnos. Los lugares quedaron disponibles." El 409 muestra cuáles no se pudieron cancelar.
4. Después de cancelar, invalida `ocurrencias`, `agendas` y `cuentas` con sus hooks `use-invalidar-*`.

**Criterios de aceptación**

- Recorrido desde la agenda (uno) y desde la ficha del alumno (varios).
- El turno cancelado sigue viéndose como "Cancelado" con su motivo en el detalle.

---

## T-47 · [Back] HU-14 · API para finalizar un turno recurrente

- **HU:** HU-14 Finalizar un turno recurrente
- **Área:** Backend
- **Rama:** `feat/finalizaciones-api`
- **Depende de:** T-30

**Alcance**

1. `GET /finalizaciones/previa?turnoId&fechaDesde` (`MESA_ENTRADAS`): `{ cantidad, desde, hasta | null, pagadas: [{ fecha, horaInicio, horaFin, importe }] }` para el mensaje "Se liberan 7 turnos, del 19/10 al 30/11" o "Se liberan todos los turnos desde el 19/10".
2. `POST /finalizaciones` `{ turnoId, fechaDesde, motivo, detalle? }`:
   - El turno es `RECURRENTE`, vigente y sin finalización previa (409 si no).
   - `fechaDesde`: hoy o posterior, en el día de la serie y posterior a `fechaInicio` (400).
   - Si alguna ocurrencia desde `fechaDesde` está pagada → 409 `TURNOS_PAGADOS` con fecha, horario e importe de cada una.
   - En una transacción con lock: `FinalizacionRecurrencia` + `Turno.fechaFin` = última ocurrencia anterior a `fechaDesde` (así deja de ser vigente al día siguiente y libera bajas de profesor, de materia y de bloques). Las ocurrencias anteriores no cambian. Una ocurrencia de la serie reprogramada a una fecha posterior también se libera (es de la serie); dejarlo en `decisiones.md`.
   - Motivo y detalle con las reglas de HU-13.
   - **Tramos:** como los tramos no están vinculados entre sí (Sprint 1), se finaliza **el turno (tramo) desde cuyo detalle se opera**. La previa informa si el alumno tiene otros tramos posteriores de la misma hora y materia (`otrosTramos: [{ turnoId, fechaInicio, fechaFin }]`), para que el usuario los finalice también. Confirmar con las PO.
3. Tests del service: previa con y sin fin; previa con tramos posteriores; con pagadas → 409; fecha que no cae en el día → 400; sesión única → 409; ya finalizada → 409.
4. `contrato-api.md` → Finalizaciones; `dominio.md` → Finalización.

**Criterios de aceptación**

- Después de finalizar, la serie no aparece en las agendas desde la fecha indicada y su lugar queda libre.
- No se puede finalizar si hay turnos pagados a liberar.

---

## T-48 · [Front] HU-14 · Finalizar un turno recurrente

- **HU:** HU-14
- **Área:** Frontend
- **Rama:** `feat/finalizaciones-ui`
- **Depende de:** T-47, T-35 (puede empezar en paralelo)

**Alcance**

1. `AccionFinalizarTurno`: botón "Finalizar turno" según `ocurrencia.acciones.finalizar`.
2. Diálogo: fecha desde (con `CalendarioFecha`; que caiga en el día lo valida la API), motivo y detalle; al elegir la fecha pide la previa y muestra cuántos se liberan; si hay pagados, los lista (fecha, horario, importe) y no deja confirmar.
3. Éxito: toast y el detalle muestra "Finalizada el [fecha]" (lo trae la API). Invalida `ocurrencias`, `agendas` y `cuentas`.

**Criterios de aceptación**

- Recorrido completo desde el detalle de un recurrente, con y sin fecha de fin.

---

## T-49 · [Back] HU-20 · API para reprogramar un turno

- **HU:** HU-20 Reprogramar un turno
- **Área:** Backend
- **Rama:** `feat/reprogramaciones-api`
- **Depende de:** T-30

**Alcance**

1. `POST /reprogramaciones` (`MESA_ENTRADAS`) `{ turnoId, fecha (original), bloqueAgendaDestinoId, fechaDestino }`:
   - La ocurrencia está `AGENDADO` con fecha efectiva hoy o posterior (409 si no). **Pagada se puede** (el pago no se toca).
   - Validaciones de HU-08 sobre el destino: profesor activo con la materia asignada (409 `PROFESOR_INACTIVO` / `MATERIA_NO_ASIGNADA`), `fechaDestino` hoy o posterior y en el día del bloque (400), lugar con `ocupacionEn` (409 `BLOQUE_LLENO`) y sin superposición del alumno con `superposicionesDelAlumno`, **excluyendo la propia ocurrencia** (409 `ALUMNO_SUPERPUESTO`).
   - Transacción con `bloquearParaReserva` (bloques de origen y destino ordenados por id). Inserta `ReprogramacionTurno` (origen = posición efectiva actual) y actualiza la auditoría de modificación del `Turno`.
   - Responde el cambio para el mensaje: "Del lunes 12/10 9:00–10:00 con Prof. Gómez al jueves 15/10 17:00–18:00 con Prof. Ruiz".
2. La búsqueda de horarios reutiliza `GET /turnos/disponibilidad` con `fecha` (no hay endpoint nuevo).
3. Tests del service: mismo profesor y otro profesor; hora llena → 409; superposición consigo misma no cuenta; pasada → 409; reprogramar dos veces conserva la fecha original como identidad.
4. `contrato-api.md` → Reprogramaciones; `dominio.md` → Reprogramación.

**Criterios de aceptación**

- La ocurrencia reprogramada conserva su pago y su identidad; la fecha original queda libre y el detalle muestra desde dónde se reprogramó.

---

## T-50 · [Front] HU-20 · Reprogramar un turno

- **HU:** HU-20
- **Área:** Frontend
- **Rama:** `feat/reprogramaciones-ui`
- **Depende de:** T-49, T-35 (puede empezar en paralelo)

**Descripción**
La reprogramación usa la misma búsqueda de horarios que registrar turno, por eso vive en `features/turnos` (archivos nuevos): así reutiliza sus componentes sin importarlos desde otra feature.

**Alcance**

1. `AccionReprogramarTurno` (placeholder de T-35) y `ReprogramarTurnoDialog` (archivo nuevo): búsqueda con alumno y materia fijos, profesor y día opcionales, una sola hora, fecha nueva; confirmación con el texto del cambio; éxito "Turno reprogramado".
2. `FiltrosDisponibilidad`, `ResultadosDisponibilidad` y `HorasDelBloque` suman las props que hagan falta (materia fija, selección de una sola hora) **sin cambiar** el comportamiento de registrar turno. Son de esta tarea (T-42 no los toca).
3. API y types en archivos nuevos (`api/reprogramaciones.api.ts`, `reprogramacion.types.ts`), para no chocar con `turnos.api.ts`.
4. Invalida `ocurrencias`, `agendas` y la disponibilidad.

**Criterios de aceptación**

- Reprogramar a otro profesor y a otro día muestra la confirmación y el detalle refleja el cambio.
- Registrar turno sigue funcionando igual.

---

## T-51 · [Back] HU-15 · API para registrar el pago de turnos y su comprobante

- **HU:** HU-15 Registrar el pago de un turno
- **Área:** Backend
- **Rama:** `feat/pagos-api`
- **Depende de:** T-30

**Alcance**

1. `POST /pagos` (`MESA_ENTRADAS`) `{ alumnoId, ocurrencias: [{ turnoId, fecha }], fechaPago, observaciones? }`:
   - Forma de pago: "Efectivo" (única en este sprint; se toma del catálogo, no viene en el body).
   - `fechaPago` obligatoria, no futura (400); observaciones hasta 500.
   - Todas las ocurrencias son del alumno (400), no canceladas, con pago `PENDIENTE`; pasadas o futuras, y las futuras de una serie dentro de las **próximas 8 semanas**.
   - **Todo o nada** en una transacción con `bloquearParaReserva` y relectura: si alguna dejó de poder cobrarse (otro usuario la cobró o la canceló) → 409 `TURNOS_NO_COBRABLES` con cuáles y por qué, y no se registra nada.
   - Importe de cada una = `precioHora` **vigente** de su materia al momento del pago (no viene del front). `Pago` con `importeTotal`, `numeroComprobante` correlativo, estado `VIGENTE`; un `PagoTurno` por ocurrencia con su `importeAplicado`.
   - Responde `{ pagoId, numeroComprobante, cantidad, total }` para "Pago registrado: 4 turnos por $ 32.000".
2. `GET /pagos/{id}`: datos del comprobante: número, fecha de pago, alumno (nombre, apellido, DNI), cada turno (fecha, horario, materia, profesor, importe), total, forma de pago, observaciones y usuario que lo registró.
3. Anular un pago **no está en los criterios de HU-15** (sólo se lo menciona desde HU-13, HU-14 y HU-16): queda fuera del sprint y se consulta a las PO. `Pago.estado` ya contempla `ANULADO` y el motor sólo cuenta pagos `VIGENTE`, así que agregarlo después no cambia nada de lo anterior.
4. Tests del service: uno y varios turnos; turno cancelado o ya pagado → 409 sin registrar nada; fecha futura → 400; turno de otro alumno → 400; el importe sale del precio vigente; dos pagos simultáneos de la misma ocurrencia → sólo uno.
5. `contrato-api.md` → Pagos; `dominio.md` → Pagos.

**Criterios de aceptación**

- Al registrar, las ocurrencias pasan a "Pagado" y quedan vinculadas al mismo comprobante.
- Cambiar el precio de la materia después no cambia el importe de un pago ya registrado.

---

## T-52 · [Front] HU-15 · Registrar pago y comprobante

- **HU:** HU-15
- **Área:** Frontend
- **Rama:** `feat/pagos-ui`
- **Depende de:** T-51, T-34, T-35 (puede empezar en paralelo)

**Alcance**

1. `AccionRegistrarPago` (desde el detalle, con esa ocurrencia) y `RegistrarPagoDialog` (una o varias, lo abren el detalle y `cuentas`): resumen de cada turno (fecha, horario, materia, profesor, importe) con los importes que manda la API, total, forma de pago "Efectivo", fecha de pago (hoy por defecto) y observaciones.
2. Confirmación: "¿Registrar el pago de 4 turnos por $ 32.000 en efectivo?". Éxito: "Pago registrado: 4 turnos por $ 32.000" con **"Imprimir comprobante"**. El 409 muestra qué turnos ya no se pueden cobrar.
3. Comprobante: ruta `app/mesa/pagos/[pagoId]/comprobante/page.tsx` con `DocumentoOficial` (T-34) y `useImprimirCuandoEsteListo`.
4. Invalida `ocurrencias`, `cuentas` y `agendas`.

**Criterios de aceptación**

- Registrar el pago de un turno desde su detalle e imprimir el comprobante en A4.
- El total y los importes no se calculan en el cliente más allá de sumar lo que muestra la API.

---

## T-53 · [Back] HU-16 · API de pagos y deuda del alumno (feature `cuentas`)

- **HU:** HU-16 Pagos y deuda del alumno
- **Área:** Backend
- **Rama:** `feat/cuentas-api`
- **Depende de:** T-30

**Descripción**
La deuda se consulta en la ficha del alumno, en la vista global "Pagos" y en el tablero del gerente (T-61). Para que el cálculo exista una sola vez, esta feature lo publica también en sus condiciones.

**Alcance**

1. `cuentas.condiciones.ts`: `leerAdeudados(client, { alumnoId?, hoy })` y `totalAdeudado(client, { alumnoId?, hoy })`. Adeudado = ocurrencia con pago `PENDIENTE`, fecha anterior a hoy y estado `SIN_REGISTRAR` (o "Realizado"/"Ausente" cuando exista la asistencia); los cancelados no. Importe = precio vigente de la materia. Los usa T-61.
2. `GET /cuentas/alumnos/{alumnoId}` (`MESA_ENTRADAS`): `{ totalAdeudado, pagadoDelMes, adeudados[], proximos[], pagos[] }`:
   - `adeudados`: fecha, horario, materia, profesor, estado ("Sin registrar"), importe; del más antiguo al más reciente.
   - `proximos`: ocurrencias `AGENDADO` impagas de hoy en adelante, incluidas las de series de las **próximas 8 semanas**; no suman a la deuda.
   - `pagos`: historial (número, fecha, cantidad de turnos, total, `pagoId`).
3. `GET /cuentas/adeudados?alumnoId?&page&pageSize` (`MESA_ENTRADAS`): vista global paginada de todos los adeudados (alumno, fecha, horario, materia, profesor, estado, importe), del más antiguo al más reciente, con `totalAdeudado` de todos en `meta` o junto a la página.
4. El rango "desde" de la deuda es la fecha de inicio más antigua de los turnos impagos (no un rango fijo); si hace falta acotarlo por rendimiento, se deja escrito en `decisiones.md`.
5. Tests del service con reloj fijo: pasado impago → adeuda; cancelado → no; pagado → no; futuro → en próximos; cambio de precio → importe nuevo en los impagos.
6. `contrato-api.md` → Cuentas; `dominio.md` → Deuda.

**Criterios de aceptación**

- Después de registrar un pago o cancelar un turno, la siguiente consulta ya no lo muestra como adeudado.
- El total adeudado global coincide con la suma de los adeudados.

---

## T-54 · [Front] HU-16 · Pestaña "Pagos" del alumno y vista global "Pagos"

- **HU:** HU-16
- **Área:** Frontend
- **Rama:** `feat/cuentas-ui`
- **Depende de:** T-53, T-35 (puede empezar en paralelo)

**Alcance**

1. `PagosDelAlumno`: total adeudado y pagado del mes arriba; "Turnos adeudados" y debajo "Próximos turnos", con casillas, "Seleccionar todos los adeudados" y "Quitar selección", resumen "4 turnos seleccionados · $ 32.000", botón "Registrar pago" (deshabilitado sin selección) y acción por fila; historial de pagos con enlace al comprobante. Vacíos: "Sin pagos registrados"; sin deuda pero con pagos, total en $ 0 y el historial.
2. `PagosGlobal` (`/mesa/pagos`): total adeudado de todos, listado paginado, filtro por alumno con el buscador de `features/alumnos` (su hook); con alumno filtrado se habilitan las casillas para cobrar varios; sin filtro, cobro de a uno; enlace a la ficha de cada alumno.
3. El registro del pago se abre con `renderRegistrarPago` (compuesto en `app/` por T-35); al terminar se refresca con `use-invalidar-cuentas`.

**Criterios de aceptación**

- Cobrar dos turnos adeudados de un alumno desde su pestaña y verlos desaparecer de la deuda.
- En la vista global, filtrar por un alumno habilita la selección múltiple.

---

## T-55 · [Back] HU-17 · API de exámenes del alumno

- **HU:** HU-17 Registrar exámenes del alumno
- **Área:** Backend
- **Rama:** `feat/examenes-api`
- **Depende de:** T-29, T-30 (`materiasDelProfesorConAlumno`)

**Alcance**

1. `GET /examenes?alumnoId` (`MESA_ENTRADAS`, `PROFESOR`): `{ proximos[], pasados[] }`; próximos ordenados por fecha con `diasRestantes` (0 = hoy), pasados aparte. Cada uno con materia, fecha, tipo, observaciones y auditoría **con el rol** de quien lo cargó y de quien lo modificó.
2. `GET /examenes/materias?alumnoId`: materias ofrecibles. Mesa: activas del catálogo. Profesor: las que le dicta a ese alumno (`materiasDelProfesorConAlumno`).
3. `POST /examenes`, `PATCH /examenes/{id}`, `PATCH /examenes/{id}/baja` (eliminar = baja lógica, con confirmación en el front):
   - Materia activa (409 `MATERIA_INACTIVA`), fecha obligatoria, tipo del enum, observaciones hasta 500.
   - **Un examen pendiente por materia:** si ya hay uno activo con fecha `>= hoy` en esa materia → 409 `EXAMEN_PENDIENTE` con el existente (id, tipo, fecha) en `details`, para ofrecer editarlo. Los pasados no cuentan.
   - Fecha pasada permitida; la respuesta trae `pasado: true` para el aviso.
   - Profesor: sólo materias que le dicta al alumno, para crear, editar y eliminar (403 si no).
4. **No toca `examenes.condiciones.ts`** (es de T-31); la prioridad se recalcula sola porque no se persiste.
5. Tests del service: duplicado pendiente → 409 con el existente; pasado permitido; profesor con materia ajena → 403; baja lógica.
6. `contrato-api.md` → Exámenes; `dominio.md` → Exámenes.

**Criterios de aceptación**

- No se puede cargar un segundo examen pendiente de la misma materia; sí el siguiente cuando el anterior ya pasó.
- Un examen cargado por el profesor muestra su rol en la trazabilidad.

---

## T-56 · [Front] HU-17 · Pestaña "Exámenes" (mesa de entradas y profesor)

- **HU:** HU-17
- **Área:** Frontend
- **Rama:** `feat/examenes-ui`
- **Depende de:** T-55, T-35 (puede empezar en paralelo)

**Alcance**

1. `ExamenesDelAlumno({ alumnoId, rol })`: próximos ("en 5 días", "hoy", con `diasRestantes` de la API) y pasados separados; "+ Nuevo examen"; editar y eliminar (con confirmación) por fila.
2. Formulario: materia (del selector de `/examenes/materias`), fecha, tipo, observaciones (contador de 500). Aviso si la fecha es pasada (ayuda visual; la API también lo devuelve). El 409 `EXAMEN_PENDIENTE` muestra el existente y ofrece "Editar ese examen".
3. Trazabilidad con el rol ("Cargado por … (Profesor) el …").
4. Lo usan la ficha de mesa y "Mis alumnos" del profesor (composición de T-35).

**Criterios de aceptación**

- El profesor carga un examen de una materia que dicta y no ve las que no dicta.
- Mesa de entradas edita y elimina cualquiera.

---

## T-57 · [Back] HU-18 / HU-19 · Agendas v2: estado, pago, prioridad, filtros y rango del centro

- **HU:** HU-18 Prioridad del turno; HU-19 Agenda en calendario semanal (y HU-13: los cancelados se siguen viendo)
- **Área:** Backend
- **Rama:** `feat/agendas-v2-api`
- **Depende de:** T-30 (dueña de `agendas/*` hasta mergearse), T-31

**Alcance**

1. Cada ítem de `/agendas/diaria`, `/agendas/propia` y `/agendas/profesor` pasa a ser una ocurrencia con: `turnoId`, `fechaOriginal`, `fecha`, `bloqueAgendaId`, `estado` (`AGENDADO` / `CANCELADO` / `SIN_REGISTRAR`), `estadoPago`, `prioridad` + examen (no en canceladas, con `leerPrioridades`), `reprogramada` (bool). **Los cancelados ahora se incluyen** (HU-13: se siguen viendo con su estado).
2. Filtros nuevos, combinables con los existentes: `estado` y `prioridad` en las tres agendas.
3. Nuevo **`GET /agendas/centro?desde&hasta&profesorId?&materiaId?&aulaId?&estado?&prioridad?`** (`MESA_ENTRADAS`): arreglo sin paginar de ocurrencias de todos los profesores, rango máximo de 31 días (como T-43/T-44 de decisiones), para el calendario semanal de la agenda del centro. Agrupar por clase (fecha + bloque) es presentación: lo hace el front.
4. Los selectores de materias y aulas de la agenda siguen igual (no filtran por estado de la entidad).
5. Tests del service con reloj fijo: canceladas incluidas y sin prioridad; filtros por estado y prioridad; `/centro` con rango de una semana; más de 31 días → 400.
6. `contrato-api.md` → Agendas; decisión nueva si cambia el criterio de "no mostrar cancelados" (T-23).

**Criterios de aceptación**

- La agenda diaria filtrada por prioridad "Alta" sólo trae esas ocurrencias.
- Una ocurrencia cancelada aparece con su estado y sin prioridad.

---

## T-58 · [Front] HU-18 · Prioridad, estado y filtros en las agendas (vista lista)

- **HU:** HU-18 (y HU-13, HU-15: estado y pago visibles)
- **Área:** Frontend
- **Rama:** `feat/agendas-prioridad-ui`
- **Depende de:** T-57, T-33, T-35

**Alcance**

1. `agendas.types.ts` y `agendas.api.ts` con los campos y filtros nuevos (son de esta tarea).
2. Tablas de la agenda diaria, del profesor y de "Mi agenda": `PrioridadIndicador variante="fila"` (franja + punto + palabra, tooltip con el examen), `EstadoTurnoBadge` (incluidos cancelados) y `EstadoPagoBadge` donde corresponda (mesa).
3. Controles de filtro de **estado** y **prioridad** (en las tres agendas; la HU pide prioridad al menos en la diaria), que escriben en `use-filtros-agenda` (T-35), así el calendario (T-59) los recibe sin tocar estos archivos.
4. Clic en una fila abre el detalle con `?detalle&fecha`.

**Criterios de aceptación**

- Las prioridades Alta y Media se distinguen del estado a simple vista; Baja no tiene distintivo.
- Filtrar por prioridad y estado se combina con fecha, profesor, materia y búsqueda.

---

## T-59 · [Front] HU-19 · Calendario semanal

- **HU:** HU-19 Agenda en calendario semanal
- **Área:** Frontend
- **Rama:** `feat/agendas-calendario-ui`
- **Depende de:** T-57, T-33, T-35

**Alcance**

1. Completar `CalendarioSemanal({ origen, filtros, renderDetalle })` (placeholder de T-35) y sus archivos nuevos (hook y api del rango en archivos propios: `use-calendario.ts`, `calendario.api.ts`), para `origen` = centro (`/agendas/centro`), profesor (`/agendas/profesor`) y propia (`/agendas/propia`).
2. Grilla: días en columnas de lunes a domingo, **ocultando los días sin turnos**; horas en filas desde la primera hasta la última con turnos de la semana. Semana actual por defecto con hoy destacado; semana anterior, siguiente y "Hoy".
3. **Una clase = un bloque** (misma fecha y misma hora de bloque): muestra horario, materia y, según el origen, profesor y aula, más un resumen de alumnos ("3 alumnos") que deja ver de un vistazo cuándo una hora tiene varios. Clic expande/contrae: cada alumno con nombre, `EstadoTurnoBadge` y `PrioridadIndicador`; clic en un alumno abre `renderDetalle`.
4. Los filtros (`filtros`, de `use-filtros-agenda`) se aplican: se ven las clases con al menos un turno que coincida y, adentro, sólo los que coinciden. Una clase sin turnos vigentes esa fecha no se muestra.
5. Mobile: la grilla se desplaza dentro de su contenedor, sin scroll horizontal de la página.

**Criterios de aceptación**

- Una hora con tres alumnos es un solo bloque que se expande y muestra los tres con su estado y prioridad.
- El selector Calendario/Lista recuerda la última vista del usuario (T-35) y los filtros valen en las dos.

---

## T-60 · [Front] HU-11 · PDF del turno y de la agenda del día

- **HU:** HU-11 PDF de turno y agenda
- **Área:** Frontend
- **Rama:** `feat/documentos-pdf-ui`
- **Depende de:** T-34, T-35, T-44 (hook `useOcurrencia`), T-58 (filtros de la agenda)

**Alcance**

1. `AccionPdfTurno`: botón "Generar PDF" que abre `app/mesa/turnos/[turnoId]/imprimir/page.tsx?fecha=`: resumen con `DocumentoOficial`: alumno (nombre, apellido, DNI), materia, profesor, aula, día y horario, tipo con sus fechas (si es recurrente, el período completo de la serie), temas a trabajar, fecha de emisión y usuario que lo emitió (de la sesión).
2. `BotonPdfAgenda`: abre `app/mesa/agenda/imprimir/page.tsx` con la fecha y los filtros de la URL; encabezado con la fecha y los filtros aplicados, lista con horario, alumno, profesor, materia, aula y estado, **todas las filas del día** (no sólo la página visible).
3. Usa sólo hooks de otras features (`useOcurrencia`, el de la agenda); los componentes y rutas son de `features/documentos` y de las páginas `imprimir`.
4. Se imprime al cargar (`useImprimirCuandoEsteListo`) y se guarda como PDF desde el diálogo del navegador.

**Criterios de aceptación**

- Desde el detalle de un turno y desde la agenda del día se obtiene un PDF A4 sólo con el contenido y el encabezado oficial.

---

## T-61 · [Back] HU-21 · API del tablero del gerente (opcional)

- **HU:** HU-21 Tablero del gerente
- **Área:** Backend
- **Rama:** `feat/tablero-api`
- **Depende de:** T-30, T-53 (`cuentas.condiciones`)
- **Prioridad:** Opcional. Se hace sólo si sobra margen, después de las HU obligatorias

**Alcance**

1. `GET /tablero?desde&hasta` (`GERENTE`; el front traduce "Hoy", "Esta semana", "Este mes" o un rango): sólo agregados, sin datos de un alumno, un pago o una agenda puntual.
   - Turnos del período por estado, con cantidad y porcentaje: cancelados, sin registrar, agendados (si el período incluye fechas futuras). "Asistió" y "No asistió" dependen de la HU de asistencia (HU-22, no está en el sprint): se devuelven en 0 con una marca `disponible: false` — **confirmar con las PO**.
   - Ocupación: ocurrencias no canceladas / capacidad efectiva total de las horas con clase del período.
   - Alumnos nuevos del período (alta en el período). "Atendidos" depende de la asistencia: mismo criterio que arriba.
   - Top 5 materias por turnos; top 5 profesores por turnos "Asistió" (depende de asistencia; mientras tanto, por turnos no cancelados pasados, **a confirmar**).
   - Pagos: total cobrado en el período (pagos `VIGENTE` por `fechaPago`) y total adeudado a la fecha con `totalAdeudado` de `cuentas.condiciones` (no se recalcula acá).
2. Todo con `leerOcurrencias`; nada se persiste.
3. Tests del service con datos falsos por cada indicador.

**Criterios de aceptación**

- Un usuario que no es gerente recibe 403.
- El total adeudado coincide con el de la vista global de pagos.

---

## T-62 · [Front] HU-21 · Tablero del gerente (opcional)

- **HU:** HU-21
- **Área:** Frontend
- **Rama:** `feat/tablero-ui`
- **Depende de:** T-61, T-36
- **Prioridad:** Opcional, igual que T-61

**Alcance**

1. `app/gerente/tablero/page.tsx` + `features/tablero`: selector de período (Esta semana por defecto), tarjetas por indicador con el período al que corresponden, porcentajes y los dos top 5.
2. Los indicadores con `disponible: false` se muestran como "Disponible cuando se registre la asistencia".
3. Sólo lectura: sin enlaces a fichas ni agendas.

**Criterios de aceptación**

- Cambiar el período actualiza todos los números.

---

## Puntos a confirmar con las PO (no bloquean el inicio)

1. **HU-08 "excepciones":** se sigue con el enfoque del Sprint 1 (aviso al registrar y tramos, sin guardar excepciones). Conviene ajustar la redacción de la HU para que no pida "fechas exceptuadas en el detalle".
2. **Anulación de pago:** HU-13, HU-14 y HU-16 la nombran "desde el detalle del pago (HU-15)", pero HU-15 no la tiene entre sus criterios. Queda fuera del sprint; el modelo ya la soporta (`Pago.estado`).
3. **"HU Estados (a definir)" y asistencia (HU-22):** sin ellas, un turno pasado no cancelado es "Sin registrar" y los indicadores de asistencia del tablero no se pueden calcular.
4. **Datos del centro** para el encabezado oficial (nombre, dirección, teléfono y logo).
5. **Finalizar un recurrente guardado en tramos** (HU-14): se finaliza el tramo del detalle y se avisan los tramos posteriores (T-47).
