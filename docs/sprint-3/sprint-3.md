# Sprint 3 — Tareas (HU-22 a HU-37, HU-39, HU-42 y HU-43 a HU-47)

Repositorio: `aula-click` · Sprint: Iteración 3 · Estado inicial de todas las tareas: **Todo**

Estas tareas siguen `AGENTS.md` y `docs/`, y parten del estado de `testing` al cerrar el Sprint 2 (incluidos los FIX T-66 a T-71 y los documentos PDF del backend, decisión T-122). Si una tarea y un doc se contradicen, manda el doc y se avisa para corregir la tarea. Las HU salen de `docs/sprint-3/backlog-sprint3.md`.

Numeración: continúa la del Sprint 2, cuyos últimos FIX llegaron a T-71: **43 tareas, de T-72 a T-114**. Los FIX del sprint siguen desde T-115 (T-115 a T-117). La **ampliación del 15/10** (HU-43 a HU-47, ver "Ampliación del 15/10") suma **19 tareas, de T-118 a T-136**; los FIX que vengan después siguen desde T-137. Las decisiones de `docs/decisiones.md` usan el mismo prefijo `T-` con otra numeración (la próxima libre es **T-131**): una "decisión T-xx" es una fila de ese archivo, no una tarea de este.

**Estimación:** puntos relativos entre las tareas de este sprint (1, 2, 3, 5, 8), para balancear los carriles. No son horas ni se comparan con los puntos de función de las HU.

## Lectura del sprint

- **Es el sprint más cargado y el último:** 18 HU y 73 puntos de función, sin un sprint siguiente que absorba lo que no cierre. Por eso el plan deja lo **estirable** al final de cada carril (propuesta a confirmar con las PO, ver "Puntos a confirmar"): la pestaña "Asistencia" del tablero (parte de T-112 y T-113), el PDF del historial (T-110 y el botón de T-109), los exámenes del portal (parte de T-106 y T-111) y "Mis pagos" (T-103). Recortarlos no rompe nada de lo demás.
- **Tres frentes que casi no se cruzan** y arrancan en paralelo el día 1: **asistencia e historial** (HU-22, HU-31 a HU-35, HU-39), **portal del alumno** (HU-26 a HU-30, HU-33, HU-35, HU-37) y **pagos** (HU-23 a HU-25, HU-36, HU-37, HU-42).
- **Dos cadenas críticas:** T-72 → T-74 (el motor de ocurrencias aprende la asistencia: de ahí cuelga todo lo que muestra estados) y T-72 → T-75 (la sesión del alumno: de ahí cuelga todo el portal). Se toman el día 1, con PR chicos y revisión en el día.
- **El día 5 es de integración:** T-114 recorre el sistema por rol sobre `testing`; lo que encuentre se corrige con tareas FIX (T-115 en adelante), como en el Sprint 2.

## Regla del sprint: tareas aisladas

Se mantiene la del Sprint 2: **cada archivo tiene una sola tarea dueña** mientras dura su trabajo, para que todo se pueda hacer en paralelo.

1. **Tareas de reuso primero (bloqueantes, días 1 y 2).** Lo que más de una tarea necesita se construye una sola vez, en su propio PR:
   - T-72 modelo de datos (la única que toca `schema.prisma`, migraciones y seeds; si a una tarea le falta un campo, se pide con un FIX de T-72, no se agrega en su PR).
   - T-73 andamiaje del backend (la única que toca `src/server/app.ts` y `eslint.config.mjs`; construye la validación de archivos de `shared/`).
   - T-74 motor de ocurrencias v3 (la única que toca `turnos/ocurrencias.condiciones.ts`, `turnos/ocurrencias.formato.ts` y `turnos/turnos.reglas.ts`).
   - T-75 sesión del alumno (la única que toca `src/lib/auth.ts`, `src/lib/auth-reglas.ts`, `src/server/middlewares/auth.ts` y `src/server/shared/actor.ts`).
   - T-76 deuda con asistencia y deuda vencida (`cuentas.reglas.ts` y `cuentas.condiciones.ts`).
   - T-77 estados de asistencia en la UI, T-78 campo de archivo, T-79 andamiaje del frontend y T-80 segmento del portal.
2. **Una feature por concepto nuevo**, con su carpeta en el back (`src/server/features/<f>/`) y en el front (`src/features/<f>/`): `asistencias`, `historiales`, `adjuntos` (comprobantes adjuntos de un pago), `anulaciones` (de pagos) y `usuarios` (lo que vale para cualquier usuario: su cuenta y su contraseña, `arquitectura-backend.md` → Qué es una feature). Ninguna tarea agrega endpoints a una feature que es de otra tarea.
3. **El portal no es una feature.** Un rol no es una feature (`arquitectura-backend.md`): cada endpoint del alumno vive en la feature dueña del concepto y se nombra `mis-…` / `mi-…`, como `GET /alumnos/mis-alumnos` del profesor. **El alumno sale de la sesión** (`actor.alumnoId`, T-75): ningún endpoint del portal recibe un `alumnoId`, así no hay forma de pedir datos de otro alumno cambiando un parámetro.
4. **Slots con contrato fijo.** Donde varias HU muestran algo en la misma pantalla (pestañas de la ficha del alumno, subpestañas de "Pagos", detalle del pago, páginas del portal), el andamiaje (T-79 y T-80) deja un placeholder por HU **con sus props definitivas**, en la carpeta de la feature dueña, y lo compone desde `app/`. Cada tarea después sólo completa su archivo.
5. **Documentación.** Cada tarea escribe **sólo en la sección de su feature** de `contrato-api.md` y `dominio.md` (T-73 deja creadas las secciones nuevas) y agrega sus filas al final de `decisiones.md` con el próximo ID libre (T-131 en adelante). Si hay conflicto, es de una línea y se resuelve en el merge.
6. Si durante una tarea hace falta tocar un archivo de otra, **no se toca**: se avisa en el issue de la dueña y se acuerda quién lo hace. Si dos tareas terminan en un mismo PR (como T-52, T-53 y T-54 en el Sprint 2), se dice en la descripción del PR y las dos tareas suman una "Actualización".

## Orden y dependencias

```
Día 1 (en paralelo, sin dependencias entre sí):
  T-72 Modelo de datos + migración + seed ──┬──> T-74 Motor de ocurrencias v3 (asistencia, plazo, pago vigente) [cadena crítica]
                                            ├──> T-75 Sesión del alumno (usuario, actor.alumnoId)          [cadena crítica del portal]
                                            └──> T-95 Adjuntos API (+ T-73)
  T-73 Andamiaje back (routers vacíos, app.ts, shared/archivos, secciones de docs)
  T-77 Estados de asistencia (UI)        T-78 Campo de archivo (UI)
  T-79 Andamiaje front (pestañas, subpestañas, detalle del pago, slots)
  T-80 Segmento del portal (/portal, ingreso con usuario, menú, celular, placeholders; se conecta con T-75)

Con T-72 mergeada:     T-88 Alumnos: foto y acceso (+ T-73) ─────┬──> T-89 Foto del alumno UI (+ T-78, T-79)
                                                                 └──> T-90 Acceso al portal UI (+ T-79)
                       T-106 Exámenes: nota y portal (+ T-75) ───┬──> T-107 Nota del examen UI
                                                                 └──> T-111 Mis materias UI (+ T-108, T-80)
Con T-74 mergeada:     T-76 Deuda (cuentas.condiciones) ─────────┬──> T-93 Sacar turno y tope de deuda (+ T-75) ──> T-94 Sacar turno UI (+ T-80)
                                                                 ├──> T-101 Cuentas: varias materias y portal      ──┬──> T-102 "Seleccionar todo" UI
                                                                 │                                                  └──> T-103 Mis pagos UI (+ T-98)
                                                                 └──> T-104 Anulaciones (+ T-96) ──> T-105 Anular pago UI (+ T-99)
                       T-81 Asistencia API ──────────────────────┬──> T-82 Pantalla "Asistencia" UI (+ T-77, T-79)
                                                                 └──> T-108 Historial académico API (+ T-84) ──┬──> T-109 Historial UI (+ T-79)
                                                                                                               └──> T-110 PDF del historial (+ T-106)
                       T-83 FIX: con asistencia no se cancela, reprograma ni finaliza
                       T-84 Ocurrencias v3 (+ T-75) ─────────────────> T-85 Detalle del turno UI (+ T-77, T-79, T-80)
                       T-86 Agendas sin estados de asistencia ───────> T-87 Agendas UI y "Mi calendario" (+ T-84, T-80)
                       T-96 Pagos con medios (+ T-95) ───────────┬──> T-97 Registrar pago UI (+ T-78)
                                                                 └──> T-98 Pagos realizados API ──┬──> T-99 Detalle del pago UI (+ T-79)
                                                                                                  └──> T-100 Pagos realizados UI (+ T-79)
                       T-112 Tablero por secciones (+ T-76, T-96) ──> T-113 Tablero UI
Con T-75 mergeada:     T-91 Usuarios: mi usuario y contraseña ──> T-92 Menú del alumno y Configuración (+ T-80, T-88)
Día 5:                 T-114 Verificación integrada por rol y guion de la review
```

- **T-72 y T-73 se mergean el día 1; T-74 y T-75, a más tardar el día 2.** Nadie genera migraciones propias en todo el sprint.
- **T-74 es la cadena crítica del backend:** asistencia, ocurrencias, agendas, deuda, historial y tablero leen los estados nuevos de ahí. Mientras tanto, las tareas que la consumen empiezan contra las firmas que fija su alcance, con el repository mockeado en los tests (como en el Sprint 2 con T-30).
- **T-75 es la cadena crítica del portal:** sin ella el alumno no inicia sesión. El seed de T-72 trae un alumno con usuario y contraseña para probar desde que T-75 se mergea.
- Las pantallas empiezan en paralelo con su API contra el contrato escrito en cada tarea y se conectan cuando la API se mergea. Los placeholders de T-79 y T-80 devuelven `null` o "Próximamente": la app sigue funcionando mientras las HU se completan.
- **Orden de merge entre consumidores de los estados:** después de T-74, un turno con asistencia del seed se ve "Realizado" o "Ausente", pero todavía no se cobra ni se adeuda hasta T-96 y T-76. Ninguna de las dos espera a la otra; T-114 verifica la combinación.

## Carriles sugeridos

Un punto de partida para repartir el sprint entre 6 personas, respetando las dependencias (el orden dentro de cada carril es el de ejecución). Se rebalancea en la daily del día 3 según lo mergeado.

| Carril                                | Tareas, en orden                                        | Puntos |
| ------------------------------------- | ------------------------------------------------------- | ------ |
| A · Back: asistencia e historial      | T-72 → T-81 → T-83 → T-86 → T-106 → T-108 → T-110       | 23     |
| B · Back: motor, lecturas y tablero   | T-74 → T-76 → T-91 → T-84 → T-101 → T-93 → T-112        | 25     |
| C · Back: sesión, alumnos y pagos     | T-73 → T-75 → T-95 → T-88 → T-96 → T-98 → T-104         | 24     |
| D · Front: profesor y mesa de entrada | T-77 → T-79 → T-82 → T-85 → T-109 → T-107 (+ T-114)     | 22     |
| E · Front: portal del alumno          | T-80 → T-92 → T-89 → T-90 → T-87 → T-94 → T-111 → T-103 | 25     |
| F · Front: pagos y gerente            | T-78 → T-97 → T-99 → T-100 → T-102 → T-105 → T-113      | 23     |

- **B, C y E son los carriles con más riesgo** (las dos cadenas críticas del día 1 y el portal, que depende de las dos). D es el que tiene más margen: absorbe lo que se atrase, en este orden: T-112/T-113, T-104/T-105 y T-93/T-94.
- Total: 142 puntos. No hay velocidad histórica en puntos: la referencia real es el tablero del día 3.
- T-82 (pantalla de asistencia, 8 puntos) es la tarea más grande del sprint: conviene que su autora y la de T-81 acuerden el contrato el día 1 y trabajen en par.

## Mapa de archivos (quién es dueño de qué)

| Zona                                                                                                                                                                                                                                                                                                                                                                                                                              | Tarea dueña                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed*.ts`, `.env.example` (si hiciera falta)                                                                                                                                                                                                                                                                                                                                | T-72                                                                                              |
| `src/server/app.ts`, `eslint.config.mjs`, `src/server/shared/archivos.ts` (+ test), routers vacíos de las features nuevas                                                                                                                                                                                                                                                                                                         | T-73                                                                                              |
| `src/server/features/turnos/ocurrencias.condiciones.ts`, `ocurrencias.formato.ts`, `turnos.reglas.ts` (+ tests); la constante `ESTADOS_OCURRENCIA` de `agendas.validation.ts` y `ocurrencias.validation.ts`                                                                                                                                                                                                                       | T-74; después, `textosDeHorasSeguidas` (+ test), T-84                                             |
| `src/lib/auth.ts`, `src/lib/auth-reglas.ts`, `src/server/middlewares/auth.ts`, `src/server/shared/actor.ts` (+ tests)                                                                                                                                                                                                                                                                                                             | T-75                                                                                              |
| `src/server/features/cuentas/cuentas.reglas.ts`, `cuentas.condiciones.ts` (+ tests)                                                                                                                                                                                                                                                                                                                                               | T-76                                                                                              |
| `src/server/features/cuentas/**` (salvo reglas y condiciones)                                                                                                                                                                                                                                                                                                                                                                     | T-101                                                                                             |
| `src/server/features/asistencias/**`                                                                                                                                                                                                                                                                                                                                                                                              | T-81                                                                                              |
| `src/server/features/cancelaciones/**`, `finalizaciones/**`, `reprogramaciones/**`                                                                                                                                                                                                                                                                                                                                                | T-83                                                                                              |
| `src/server/features/ocurrencias/**`                                                                                                                                                                                                                                                                                                                                                                                              | T-84 (después de T-74)                                                                            |
| `src/server/features/agendas/**`                                                                                                                                                                                                                                                                                                                                                                                                  | T-86 (después de T-74)                                                                            |
| `src/server/features/alumnos/**`                                                                                                                                                                                                                                                                                                                                                                                                  | T-88                                                                                              |
| `src/server/features/usuarios/**`, `src/server/features/centro/centro.routes.ts` (rol del alumno)                                                                                                                                                                                                                                                                                                                                 | T-91                                                                                              |
| `src/server/features/turnos/**` (salvo lo de T-74)                                                                                                                                                                                                                                                                                                                                                                                | T-93                                                                                              |
| `src/server/features/adjuntos/**`, `src/lib/storage.ts`                                                                                                                                                                                                                                                                                                                                                                           | T-95                                                                                              |
| `src/server/features/pagos/**`                                                                                                                                                                                                                                                                                                                                                                                                    | T-96; después T-98                                                                                |
| `src/server/features/anulaciones/**`                                                                                                                                                                                                                                                                                                                                                                                              | T-104                                                                                             |
| `src/server/features/examenes/**` (incluidas sus condiciones)                                                                                                                                                                                                                                                                                                                                                                     | T-106                                                                                             |
| `src/server/features/historiales/**`                                                                                                                                                                                                                                                                                                                                                                                              | T-108; la plantilla PDF (`historiales.pdf.tsx`, `.documentos.ts`, `.formato.ts`) y su ruta, T-110 |
| `src/server/features/tablero/**`                                                                                                                                                                                                                                                                                                                                                                                                  | T-112                                                                                             |
| `src/components/turno/**`, tokens de color nuevos en `globals.css`                                                                                                                                                                                                                                                                                                                                                                | T-77                                                                                              |
| `src/components/ui/campo-archivo.tsx`                                                                                                                                                                                                                                                                                                                                                                                             | T-78                                                                                              |
| `AlumnoDetalle.tsx` (y `AlumnoForm.tsx` y `DatosAlumno.tsx`, sólo para montar los placeholders del acceso), `app/mesa/_componentes/**`, `app/profesor/_componentes/**`, `app/gerente/_componentes/**`, `app/mesa/pagos/page.tsx`, `app/gerente/pagos/**`, `app/profesor/asistencia/**`, `profesor-sidebar.tsx`, `gerente-sidebar.tsx`, placeholders de las features nuevas del personal, `src/types/pago.ts` (tipos de los slots) | T-79 (después, cada placeholder pasa a su tarea)                                                  |
| `features/auth` (`roles.ts`, `SegmentoDeRol.tsx`, `LoginForm`, `auth-client`, `auth.schema`, `interpretar-error-login`), `app/page.tsx`, `app/portal/**`, `components/layout/portal-sidebar.tsx`, `components/layout/app-shell.tsx`, `components/layout/sidebar-nav.tsx`, `src/features/centro/**`, placeholders del portal                                                                                                       | T-80 (después, cada página del portal pasa a su tarea)                                            |
| `src/features/asistencias/**` (salvo `components/RegistrarAsistenciaTurno.tsx`, de T-85)                                                                                                                                                                                                                                                                                                                                          | T-82                                                                                              |
| `src/features/ocurrencias/**`, `src/types/ocurrencia.ts`, `app/portal/_componentes/detalle-turno.tsx`                                                                                                                                                                                                                                                                                                                             | T-85                                                                                              |
| `src/features/agendas/**`, `app/portal/calendario/**`                                                                                                                                                                                                                                                                                                                                                                             | T-87                                                                                              |
| `features/alumnos` (formulario, edición, listado, detalle, schema, types, api, "Mis alumnos"), salvo los archivos de acceso; después de T-79                                                                                                                                                                                                                                                                                      | T-89                                                                                              |
| `features/alumnos`: `AccesoPortalAlta.tsx`, `AccesoPortalFicha.tsx`, `api/acceso.api.ts`, `hooks/use-acceso-*.ts`                                                                                                                                                                                                                                                                                                                 | T-90                                                                                              |
| `features/auth/components/UserMenu.tsx`, `src/features/usuarios/**`, `app/portal/configuracion/**`                                                                                                                                                                                                                                                                                                                                | T-92                                                                                              |
| `features/turnos`: archivos nuevos del portal (`SacarTurno*`, `api/mis-turnos.api.ts`, `mis-turnos.types.ts`) y `RechazoAlta.tsx`; `app/portal/turnos/**`                                                                                                                                                                                                                                                                         | T-94                                                                                              |
| `features/pagos`: `RegistrarPagoDialog`, schema, types y api del alta, `api/adjuntos.api.ts`, `hooks/use-subir-adjunto.ts`; `src/types/pago.ts` después de T-79                                                                                                                                                                                                                                                                   | T-97                                                                                              |
| `features/pagos`: `PagoDetalle`, `EnlaceDetallePago`, `ReemplazarAdjuntoDialog`, `QuitarAdjuntoDialog`, `hooks/use-pago.ts`, `hooks/use-reemplazar-adjunto.ts`, `hooks/use-quitar-adjunto.ts`                                                                                                                                                                                                                                     | T-99                                                                                              |
| `features/pagos`: `PagosRealizados`, sus filtros, `api/pagos-realizados.api.ts`, `hooks/use-pagos-realizados.ts`                                                                                                                                                                                                                                                                                                                  | T-100                                                                                             |
| `src/features/cuentas/**` (salvo `MisPendientes`)                                                                                                                                                                                                                                                                                                                                                                                 | T-102                                                                                             |
| `features/cuentas/components/MisPendientes.tsx` y su hook y api; `features/pagos/components/MisPagosRealizados.tsx` y su hook; `app/portal/pagos/**`                                                                                                                                                                                                                                                                              | T-103                                                                                             |
| `src/features/anulaciones/**`                                                                                                                                                                                                                                                                                                                                                                                                     | T-105                                                                                             |
| `src/features/examenes/**` (salvo `MisExamenes`)                                                                                                                                                                                                                                                                                                                                                                                  | T-107                                                                                             |
| `src/features/historiales/**` (salvo `MisMaterias*` y `MiMateria*`)                                                                                                                                                                                                                                                                                                                                                               | T-109                                                                                             |
| `features/historiales`: `MisMaterias*`, `MiMateria*` y sus hooks; `features/examenes/components/MisExamenes.tsx` y su hook; `app/portal/materias/**`                                                                                                                                                                                                                                                                              | T-111                                                                                             |
| `src/features/tablero/**`, `app/gerente/tablero/**`                                                                                                                                                                                                                                                                                                                                                                               | T-113                                                                                             |

## Definición de Hecho (aplica a todas las tareas)

- Rama creada desde `testing` con el nombre indicado; PR a `testing` que referencia el issue (`Closes #N`). Nadie commitea directo a `testing` ni a `main`.
- **El PR sólo modifica archivos de los que la tarea es dueña** (ver el mapa). Si necesitó tocar otro, lo explica en la descripción del PR y lo acordó antes con la dueña.
- `pnpm check` pasa localmente y en el CI. `/revisar-arquitectura` no reporta violaciones.
- Backend: cada endpoint declarado con `createRoute()`, con todos sus status codes, errores con `ErrorResponseSchema`, y `requireAuth()` + `requireRole(...)`. Un test por service con el repository mockeado: camino feliz y un caso por cada error que lanza (`it.todo` no cuenta). Fechas con `hoy()` y reloj inyectable.
- **Portal:** todo endpoint con rol `ALUMNO` toma el alumno de `actor.alumnoId` y tiene un test que pide datos de **otro** alumno (un turno, un pago, un PDF) y recibe 403. Ninguna respuesta para el alumno trae observaciones internas de la ficha, prioridad, ocupación o cupos, ni datos de otros alumnos: un test de la respuesta lo fija.
- **Archivos:** tipo y tamaño se validan en la API (`shared/archivos.ts`, T-73); en la base se guarda la clave, no la URL; para verlos se genera una URL prefirmada (`arquitectura-backend.md` → Archivos). La foto del alumno sigue el patrón de la del profesor (al reemplazarla o quitarla se borra el archivo anterior); un comprobante adjunto reemplazado, en cambio, **se conserva** (HU-24).
- Frontend: cada componente con datos maneja carga, vacío y error (401/403/404); llamadas sólo por `fetchJson` desde `features/<entidad>/api/` (salvo los PDF, que se enlazan, decisión T-123); **ninguna regla de negocio calculada en el cliente** (si una acción está permitida, cuánto se debe, si un plazo venció o qué usuario se genera, lo dice la API).
- **Las pantallas del portal** se verifican a 360 px de ancho, sin scroll horizontal de la página.
- Nada se borra físicamente: anular un pago cambia su estado y registra la anulación; corregir una asistencia la actualiza con su auditoría (`updatedById`, `updatedAt`).
- Si el cambio toca el contrato de la API, una regla o la estructura, se actualiza la sección de la feature en el doc correspondiente en el mismo PR (`AGENTS.md`, regla 9).
- Al menos un integrante que no sea el autor revisa la PR.

## Vocabulario del sprint

- **Asistencia:** el registro de una ocurrencia `(turnoId, fecha)` por su profesor: "Presente" o "Ausente", con "Qué se trabajó" e "Indicaciones para la próxima sesión" (presente) u "Observación" (ausente). Vive en `AsistenciaTurno`, una fila por ocurrencia.
- **Estado de una ocurrencia** (lo calcula la API, T-74), en este orden: `CANCELADO` si hay cancelación; `REALIZADO` si la asistencia es "Presente"; `AUSENTE` si es "Ausente"; `SIN_REGISTRAR` si es de una fecha anterior a hoy y no tiene asistencia; `AGENDADO` en otro caso. La UI los muestra como "Cancelado", "Realizado", "Ausente", "Sin registrar" y "Agendado".
- **Dónde se ve la asistencia** (decisión de las PO): sólo en el **detalle del turno** (desde el que el profesor del turno también la registra, T-84 y T-85), además de la pantalla "Asistencia" del profesor, el historial académico, su PDF y "Mis materias". **Ninguna vista de calendario ni de lista cambia** (calendario semanal, listas de las agendas, turnos de la ficha del alumno, "Mi calendario" del portal y el PDF de la agenda): muestran "Agendado" y "Cancelado" como hoy y un turno pasado no cancelado sin distintivo de asistencia (variante "sin asistencia" de T-77).
- **Plazo de registro:** hasta las 23:59 del séptimo día después de la fecha del turno (`vence` = fecha + 7). Un "Sin registrar" dentro del plazo se ve "Sin registrar · vence el 12/10"; vencido, "Sin registrar · cerrado por el sistema", definitivo y de sólo lectura. **El cierre se calcula al leer** (propuesta, ver "Puntos a confirmar"): no hay un proceso programado ni una fila que lo guarde.
- **Clase:** como en HU-19, una hora de un profesor en una fecha. **Horas seguidas:** las ocurrencias no canceladas de un mismo alumno, profesor y materia en un día, una a continuación de la otra (de 8 a 9 y de 9 a 10, sí; de 8 a 9 y de 20 a 21, no; una hora cancelada en el medio corta el grupo). Cada hora sigue siendo una ocurrencia, con su estado y su asistencia: se cobra, se cuenta en los indicadores y en los porcentajes por separado. Cómo se ven (ajuste del equipo y de las PO del 14/10, que reemplaza el punto 7 de "Puntos a confirmar"):
  - **Pantalla "Asistencia" del profesor:** cada clase muestra a todos sus alumnos, una fila por hora (FIX de T-82), y "Aplicar también a…" registra de una vez las otras horas seguidas sin registrar.
  - **Detalle del turno (también el del portal), historial, su PDF y "Mis materias":** las horas seguidas se muestran **juntas**, con el estado de **cada** hora y "Qué se trabajó" e "Indicaciones para la próxima sesión" **una sola vez**. Si alguna hora tiene otros textos (porque se corrigió sola), se muestran también los de esa hora.
  - **Desde el detalle del turno**, el profesor del turno registra la asistencia de esa hora y, con "Aplicar también a…", la de sus otras horas seguidas sin registrar, con los mismos textos.
  - Los textos se guardan en **cada** hora (una asistencia por ocurrencia): "una sola vez" es cómo se muestran. Qué textos van una vez y cuáles aparte lo decide la API (`textosDeHorasSeguidas`, T-84), así el detalle, el historial, el PDF y el portal dicen lo mismo.
  - Las listas y los calendarios no cambian: no muestran la asistencia (ver "Dónde se ve la asistencia").
- **Forma de pago:** "Efectivo", "Transferencia" o "Tarjeta de débito", identificadas por un código fijo (`EFECTIVO`, `TRANSFERENCIA`, `DEBITO`), no por el nombre.
- **Comprobante de pago** (el PDF que emite el centro, HU-15) y **comprobante adjunto** (el archivo que trae la familia, HU-24): son dos cosas distintas y la UI las nombra siempre así.
- **Pago vigente / anulado:** un pago anulado conserva todos sus datos, pero sus turnos vuelven a estar pendientes: el estado de pago de una ocurrencia sólo mira los pagos **vigentes**.
- **Deuda vencida:** turnos adeudados (ya dados e impagos, HU-16) con fecha de hace **30 días o más**. Bloquea sacar turnos nuevos (HU-29), desde el portal y desde la mesa de entrada.
- **Alumno de la sesión:** el alumno vinculado al usuario que inició sesión (`actor.alumnoId`). **Contraseña inicial:** la que pone el sistema (el DNI del alumno) al crear el acceso o al restablecerla; mientras siga siendo esa, el portal recomienda cambiarla.

---

## T-72 · [Back] Modelo de datos del Sprint 3: esquema, migración y seed

- **HU:** Transversal (habilita HU-22, HU-23, HU-24, HU-26, HU-27, HU-28, HU-34 y HU-42)
- **Área:** Backend
- **Rama:** `feat/modelo-datos-sprint3`
- **Estimación:** 5
- **Prioridad:** Bloqueante, se mergea el día 1

**Descripción**
Todo lo que el sprint necesita guardar, en **una sola migración generada por Prisma** (decisión T-50: sin SQL a mano), para que ninguna otra tarea toque el modelo. Es la única tarea que edita `schema.prisma`, `prisma/migrations/` y los seeds.

**Alcance**

1. **Asistencia (HU-22):** modelo `AsistenciaTurno` con `turnoId`, `fechaOcurrencia` (`@db.Date`), `estado` (enum `EstadoAsistencia`: `PRESENTE`, `AUSENTE`), `trabajado` y `indicaciones` (`VarChar(1000)`, opcionales), `observacion` (`VarChar(500)`, opcional) y auditoría completa. `@@unique([turnoId, fechaOcurrencia])`: una asistencia por ocurrencia; corregirla es actualizarla. "Sin registrar" no se guarda: es que no haya fila (y el cierre a los 7 días se calcula, ver Vocabulario).
2. **Formas de pago (HU-23):** `FormaPago.tipoFormaPago` (enum `TipoFormaPago`: `EFECTIVO`, `TRANSFERENCIA`, `DEBITO`; columna `tipo_forma_pago`), único. Se agrega **nullable** para que la migración que genera Prisma funcione sobre una base con datos, y el seed la completa por nombre (decisión T-134). Las reglas de cada medio se deciden por el tipo, nunca por el nombre.
3. **Datos del medio en `Pago` (HU-23)**, opcionales en la base (la obligatoriedad según el medio la valida la API, T-96): `transferenciaOperacion` (`VarChar(50)`), `transferenciaBanco` (`VarChar(100)`), `transferenciaTitular` (`VarChar(100)`), `debitoRed` (enum `RedDebito`: `VISA_DEBITO`, `MASTERCARD_DEBITO`, `MAESTRO`, `CABAL_DEBITO`, `OTRA`), `debitoCupon` (`VarChar(20)`) y `debitoUltimos4` (`Char(4)`). Índices por `(transferenciaOperacion, transferenciaBanco)` (aviso de transferencia compartida, HU-42) y por `fechaPago` (historial y tablero; era el pendiente de la decisión T-119).
4. **Comprobante adjunto (HU-24):** modelo `ComprobanteAdjunto` con `pagoId` (**nullable**: el archivo se sube antes de registrar el pago y se vincula al registrarlo, T-95/T-96), `archivoKey`, `mimeType`, `nombreArchivo`, `bytes`, `createdById` y `createdAt`. Un pago puede tener varios: el que se muestra es el último **activo** (`createdAt`, `id` como desempate) y los anteriores quedan guardados (HU-24, reemplazo). **Baja lógica** (HU-24, quitar el adjunto de un pago con débito): `estado` (`Estado`, default `ACTIVO`), `updatedById` y `updatedAt`; quitarlo lo pasa a `INACTIVO` con quién y cuándo, sin borrar la fila ni el archivo (decisión T-136). Índice por `pagoId`.
5. **Anulación (HU-42):** modelo `AnulacionPago`, con el patrón de `CancelacionTurno`: `pagoId` único, `motivo` (enum `MotivoAnulacion`: `ERROR_CARGA`, `FORMA_PAGO_EQUIVOCADA`, `OTRO`), `detalle` (`VarChar(500)`, opcional), `createdById` y `createdAt`. `Pago.estado` (`VIGENTE` / `ANULADO`) pasa a usarse.
6. **`PagoTurno` con pagos anulados** (la decisión T-49 ya lo anticipó): sale `@@unique([turnoId, fechaOcurrencia])` y entra `vigente Boolean? @default(true)` con `@@unique([turnoId, fechaOcurrencia, vigente])`. Anular pone `vigente = null` en sus filas: en Postgres dos `NULL` no chocan, así que una ocurrencia puede tener varios pagos anulados y **un solo pago vigente**, garantizado por la base y sin índice parcial. Verificar que Prisma lo genere sin SQL a mano; si no, se discute antes de mergear (es la red contra el pago doble).
7. **Foto del alumno (HU-26):** `Alumno.avatarKey`, `avatarMimeType` y `avatarUpdatedAt`, como la del profesor en `Usuario`.
8. **Acceso al portal (HU-27, HU-28)**, en `Usuario` y en `Account`:
   - `username` (único, opcional) y `displayUsername` (opcional): los campos del plugin `username` de Better Auth (T-75), mapeados a snake_case.
   - `alumnoId` (`Int?`, único, FK a `Alumno`): el vínculo cuenta ↔ alumno. Va en `Usuario` (al revés que `Profesor.usuarioId`) para que Better Auth lo devuelva en la sesión y `requireAuth()` arme `actor.alumnoId` sin otra consulta (T-75). La asimetría queda explicada en el comentario del modelo y en `decisiones.md`.
   - En **`Account`** (la cuenta `credential`, junto a `password`; no en `Usuario` ni en `Session`, decisión T-135): `contrasenaInicial` (`Boolean`, default `false`), `true` mientras la contraseña sea la que puso el sistema (aviso de HU-28); y `contrasenaRestablecidaPorId` (FK a `Usuario`) y `contrasenaRestablecidaFecha` (opcionales), quién y cuándo la restableció por última vez (HU-27). Quién creó el acceso y cuándo es la auditoría del propio `Usuario`. Better Auth no devuelve estas columnas en la sesión: se leen con una consulta a la cuenta.
   - Los campos obligatorios de `Usuario` se completan con los del alumno: `email` **sintético** (`<usuario>@alumnos.aulaclick.invalid`, un dominio reservado que no entrega correo: Better Auth exige email y el alumno ingresa con su usuario), `dni` el del alumno y `telefono` el del alumno o, si no tiene, el del tutor (uno de los dos es obligatorio por HU-02). No cambia la nulabilidad de ninguna columna de `Usuario`. Lo arma T-88.
9. **Nota del examen (HU-34)** en `Examen`: `resultado` (enum `ResultadoExamen`: `CON_NOTA`, `AUSENTE`; `null` = "Sin nota"), `nota` (`Decimal(4,2)`, opcional; que sea de 1 a 10 lo valida la API) y la trazabilidad propia de la nota (`notaCreatedById`, `notaCreatedAt`, `notaUpdatedById`, `notaUpdatedAt`, opcionales), porque la del examen ya registra quién lo cargó.
10. Relaciones inversas de auditoría en `Usuario` para todo lo nuevo. Comentarios del schema: asistencia (estado calculado y cierre por plazo sin fila), pago vigente o anulado y el único con `vigente`, comprobante adjunto que se sube antes del pago, `Usuario.alumnoId` y el email sintético. Se actualizan los comentarios que quedan viejos: `Pago.estado` "sin uso en este sprint", `Alumno` "sin vínculo a Usuario todavía", `FormaPago` "Efectivo, único medio".
11. **Seeds** (idempotentes):
    - `seed.ts`: las tres formas de pago con su código ("Efectivo", "Transferencia", "Tarjeta de débito"); los pagos existentes quedan en "Efectivo".
    - Un **alumno de demo con acceso al portal**: usuario generado con la regla de HU-27, contraseña inicial = su DNI hasheado con `hashPassword()`, `contrasenaInicial: true` en su cuenta, rol `ALUMNO` y su `alumnoId`. Sus datos por variables `SEED_*` en `.env.example`, como los demás usuarios del seed.
    - Datos para probar el sprint (en el seed de demo que corresponda): asistencias (presentes con textos, ausentes con observación, una fila de horas seguidas con un estado distinto por hora), turnos sin registrar dentro del plazo y vencidos, un pago por transferencia con un comprobante adjunto de ejemplo (clave de prueba, sin archivo real), uno con débito, un pago anulado con su motivo, exámenes rendidos con nota, con "Ausente" y sin nota, y un alumno con deuda de más de 30 días.
12. Documentación: `dominio.md` → Roles (el alumno tiene cuenta) y Pagos (formas de pago); `decisiones.md`: `Usuario.alumnoId`, el único de `PagoTurno` con `vigente` (reemplaza la parte de la decisión T-49 que fijaba el único simple), el email sintético y cómo se agregó `FormaPago.tipoFormaPago`.
13. La migración la genera y la aplica la persona con `pnpm db:migrate` (`AGENTS.md`, regla 10), sin editar el SQL.

**Criterios de aceptación**

- Con la base del Sprint 2, `pnpm db:migrate` y `pnpm db:seed` no pierden datos: los pagos existentes quedan vigentes, en "Efectivo", con sus `PagoTurno` en `vigente = true`.
- Con la base vacía, migración y seed dejan las tablas nuevas y los datos de demo, incluido el alumno con usuario (inicia sesión cuando se mergea T-75).
- Un segundo `PagoTurno` vigente para la misma ocurrencia falla en la base; uno con `vigente = null`, no.
- El seed sigue siendo idempotente. `pnpm db:generate` y `pnpm check` pasan.

---

## T-73 · [Back] Andamiaje: features nuevas registradas, validación de archivos y secciones de docs

- **HU:** Transversal
- **Área:** Backend
- **Rama:** `feat/andamiaje-sprint3-api`
- **Estimación:** 2
- **Prioridad:** Bloqueante, se mergea el día 1 (es chica)

**Descripción**
`src/server/app.ts` y `eslint.config.mjs` son puntos de conflicto. Esta tarea registra de una vez las features nuevas del sprint con routers vacíos y construye la única pieza de `shared/` que necesitan dos HU (la foto del alumno y el comprobante adjunto validan archivos).

**Alcance**

1. Crear `src/server/features/<f>/<f>.routes.ts` con `export const <f>Routes = createRouter()` (sin endpoints) para `asistencias`, `historiales`, `adjuntos`, `anulaciones` y `usuarios`, y registrarlas en `app.ts`, una línea cada una.
2. **`src/server/shared/archivos.ts`** (pieza "A construir": se especifica en `convenciones-backend.md` y lleva tests), sin importar `lib/` ni features:
   - `archivoSchema({ tipos, maxBytes, mensajes })`: el campo de un multipart (`File`), con el tipo permitido (mapa MIME → extensión) y el tamaño máximo; los mensajes los pasa quien lo usa ("La foto debe ser JPG o PNG", "El archivo debe ser JPG, PNG o PDF", "El archivo supera los 5 MB").
   - Además del tipo que declara el navegador, verifica la **firma** del archivo (los primeros bytes: JPG, PNG y PDF), para no guardar un archivo con la extensión cambiada.
   - `claveDeArchivo(carpeta, extension)`: una clave única para el almacenamiento (`<carpeta>/<uuid>.<ext>`).
   - No migra la validación de la foto del profesor (es de `profesores`, que no tiene dueña en este sprint): queda anotado como FIX posible.
3. Verificar que los `*.condiciones.ts` nuevos (`asistencias`, `adjuntos`) quedan cubiertos por las reglas de ESLint de condiciones; si hay que ajustar el config o `eslint-limites.test.ts`, se hace acá.
4. Documentación, para que cada tarea escriba sólo en lo suyo:
   - `contrato-api.md`: una sección vacía por feature nueva ("A completar por T-xx") y una sección **"Portal del alumno"** con la convención: endpoints `mis-…` / `mi-…` en la feature dueña, rol `ALUMNO`, el alumno sale de la sesión, qué no se devuelve nunca (observaciones internas, prioridad, ocupación, datos de otros alumnos) y la tabla de endpoints del portal, que completa cada tarea con su fila.
   - `dominio.md`: el título pasa a "Sprints 1 a 3" y suma las secciones Asistencia, Historial académico, Portal del alumno, Comprobante adjunto, Anulación de pagos, Notas de exámenes y Tope de deuda, cada una con la tarea que la completa.
   - `arquitectura-backend.md`: features del Sprint 3 con una línea de qué es cada una.
   - `AGENTS.md` → Alcance del Sprint 3.

**Criterios de aceptación**

- `pnpm check` pasa y `/api/v1/docs` sigue funcionando.
- Ninguna otra tarea del sprint necesita modificar `app.ts` ni `eslint.config.mjs`.
- `archivoSchema` rechaza un PNG renombrado a `.pdf` y uno de más de 5 MB, con el mensaje que se le pasó.

---

## T-74 · [Back] Reuso: motor de ocurrencias v3 — asistencia, plazo de registro y pagos anulados

- **HU:** HU-22 (la usan HU-30, HU-31, HU-33, HU-39 y HU-42)
- **Área:** Backend
- **Rama:** `feat/ocurrencias-asistencia`
- **Depende de:** T-72
- **Estimación:** 5
- **Prioridad:** Bloqueante (cadena crítica)

**Descripción**
Agendas, ocurrencias, cuentas, historial, tablero y la propia asistencia necesitan saber lo mismo: en qué estado está un turno en una fecha ahora que existe la asistencia, cuándo vence el plazo para registrarla y si sigue pagado cuando el pago se anula. Como en el Sprint 2 (T-30), se calcula **una sola vez** en el motor de `turnos` y las features lo leen de ahí.

**Alcance**

1. Reglas puras en `turnos.reglas.ts` (con tests):
   - `ESTADOS_OCURRENCIA` y `EstadoOcurrencia`: `AGENDADO`, `CANCELADO`, `SIN_REGISTRAR`, `REALIZADO`, `AUSENTE`.
   - `estadoDeOcurrencia({ fecha, cancelada, asistencia }, hoy)`, con la precedencia del Vocabulario: cancelada gana; después la asistencia (`PRESENTE` → `REALIZADO`, `AUSENTE` → `AUSENTE`); sin asistencia, `SIN_REGISTRAR` si la fecha es anterior a hoy y `AGENDADO` si no.
   - `PLAZO_ASISTENCIA_DIAS = 7` y `plazoDeAsistencia(fecha, hoy)` → `{ vence, vencido }`: `vence` = fecha + 7 días; `vencido` = hoy posterior a `vence` (el día 7 entero todavía se puede registrar, "hasta las 23:59").
   - `OBSERVACION_CIERRE_SISTEMA`: "No registrada por el profesor en el plazo de 7 días. Cierre automático del sistema".
   - `agruparHorasSeguidas(ocurrencias)`: agrupa las ocurrencias **no canceladas** de un mismo alumno, profesor, materia y fecha cuyas horas son consecutivas (`horaFin` de una = `horaInicio` de la siguiente). Devuelve grupos `{ alumnoId, profesorId, materiaId, fecha, horaInicio, horaFin, horas, ocurrencias }`; una hora suelta es un grupo de una. Una hora cancelada en el medio corta el grupo. Las horas de un grupo pueden tener estados distintos: el grupo no los mezcla, los conserva por hora. La usan la pantalla "Asistencia" (T-81) y, desde el ajuste del 14/10, el detalle del turno (T-84) y el historial (T-108), que muestran las horas seguidas juntas (ver "Vocabulario del sprint" → Horas seguidas).
2. `ocurrencias.condiciones.ts`:
   - `Ocurrencia` suma `asistencia: { estado: 'PRESENTE' | 'AUSENTE', trabajado, indicaciones, observacion, createdById, createdAt, updatedById, updatedAt } | null` y `plazoAsistencia: { vence, vencido } | null` (`null` en las canceladas y en las de fecha posterior a hoy).
   - `leerOcurrencias` lee `asistencia_turno` del rango con **una sola consulta** (como las cancelaciones) y el `pago` sólo con los `PagoTurno` **vigentes**: un pago anulado no cuenta y la ocurrencia vuelve a `PENDIENTE`. **Reemplaza la definición D del Sprint 2** ("no se mira `Pago.estado`").
   - `ocupacionEn`, `ocupacionesEn` y `superposicionesDelAlumno` no cambian: una ocurrencia `REALIZADO` o `AUSENTE` ocupa su lugar como cualquier no cancelada.
   - Publica `ESTADOS_OCURRENCIA`, `plazoDeAsistencia`, `PLAZO_ASISTENCIA_DIAS`, `OBSERVACION_CIERRE_SISTEMA` y `agruparHorasSeguidas`, para que nadie importe `turnos.reglas.ts`.
3. `ocurrencias.formato.ts`: `etiquetaEstado` con "Realizado" y "Ausente", y el texto de un "Sin registrar" según su plazo ("Sin registrar · vence el 12/10" / "Sin registrar · cerrado por el sistema"), que usan los PDF de agenda y de turnos del alumno.
4. Para que `pnpm check` pase, esta tarea actualiza **sólo** la constante `ESTADOS_OCURRENCIA` que `agendas.validation.ts` y `ocurrencias.validation.ts` copian del motor; lo demás de esas features es de T-86 y T-84.
5. Tests (motor a nivel repository, como el de T-30, y reglas puras): la precedencia con cada combinación; el día 7 dentro del plazo y el 8 vencido, con reloj fijo; una ocurrencia de un pago anulado sale `PENDIENTE` y con un pago nuevo vigente, `PAGADO`; horas seguidas (consecutivas, con hueco, con otra materia o profesor, con una cancelada en el medio, con estados distintos). Los tests del Sprint 2 siguen pasando.
6. Documentación: `convenciones-backend.md` → Ocurrencias (estados nuevos, plazo, pago vigente, horas seguidas); `dominio.md` → Asistencia (estados y plazo); `decisiones.md`: precedencia de estados, cierre calculado al leer (pendiente de confirmación de las PO) y el reemplazo de la definición D.

**Fuera de alcance**
Cómo cobra (T-96), adeuda (T-76) y cancela, reprograma o finaliza (T-83) cada feature un turno con asistencia; mostrar los estados (T-84, T-86).

**Criterios de aceptación**

- Un turno con asistencia "Presente" se lee `REALIZADO` en todas las features sin que ninguna lo recalcule.
- Una ocurrencia cuyo pago se anuló se lee `PENDIENTE`.
- El plazo y el cierre no dependen de un proceso programado: con el reloj del día 8, el turno se lee vencido.

---

## T-75 · [Back] Reuso: sesión del alumno — ingreso con usuario y `actor.alumnoId`

- **HU:** HU-28 Ingreso al portal (la usan todas las HU del portal)
- **Área:** Backend
- **Rama:** `feat/sesion-alumno`
- **Depende de:** T-72
- **Estimación:** 3
- **Prioridad:** Bloqueante del portal, se mergea a más tardar el día 2

**Descripción**
El alumno ingresa con un usuario (no con email) y todo endpoint del portal tiene que saber qué alumno es sin recibirlo por parámetro. Esta tarea configura Better Auth y el middleware una sola vez.

**Alcance**

1. Plugin **`username`** de Better Auth (`better-auth/plugins`; viene con `better-auth` 1.7.5, **no es una dependencia nueva**):
   - `usernameValidator` propio que acepte minúsculas, números, `.` y `-`: el validador por defecto (`/^[a-zA-Z0-9_.]+$/`) rechaza el "jperez456-2" de HU-27.
   - `maxUsernameLength` mayor que el default de 30, que un apellido compuesto supera ("jfernandezdelacolina456-2"). Proponer 50 y dejar los límites en `auth-reglas.ts`.
   - Normalización a minúsculas (la del plugin). Verificar que ningún endpoint de Better Auth le permita a un usuario cambiar su propio `username` (HU-27: el usuario no cambia).
2. `forzarRecordarSesion` también para **`/sign-in/username`**: hoy sólo mira `/sign-in/email`, y con `rememberMe: false` la sesión del alumno duraría 1 día sin renovarse.
3. La guarda de usuario inhabilitado (`databaseHooks.session.create.before`) vale igual para el ingreso con usuario: un test o una verificación manual lo deja dicho.
4. `additionalFields.alumnoId` (`number`, `required: false`, `input: false`): sale en la sesión. `Actor` (`shared/actor.ts`) suma `alumnoId?: number` y `requireAuth()` lo setea para el rol `ALUMNO`. Un usuario `ALUMNO` sin `alumnoId` es una cuenta mal formada: 403 `SIN_PERMISO`.
5. `alumnoDeLaSesion(actor)` en `shared/actor.ts`: devuelve `actor.alumnoId` o lanza 403. La usan todos los endpoints `mis-…`, así ninguno repite el chequeo.
6. Contrato del ingreso para el front (T-80): con usuario inexistente, contraseña incorrecta o un usuario con formato inválido (el plugin responde 422 `USERNAME_TOO_SHORT`, `USERNAME_TOO_LONG` o `INVALID_USERNAME` **antes** de mirar la contraseña), la UI muestra lo mismo: "Usuario o contraseña incorrectos" (HU-28). Los códigos van en `contrato-api.md` → Autenticación.
7. **Contraseña inicial con un DNI de 7 dígitos:** el ingreso no exige largo mínimo (en Better Auth 1.7.5 sólo lo miden el alta, el cambio y el restablecimiento de contraseña) y el alta de la cuenta (T-88) hashea con `hashPassword()`. Un test lo fija, porque el mínimo de 8 de `LARGO_MINIMO_PASSWORD` sí rige para la contraseña nueva (HU-28).
8. Tests: middleware con sesión `ALUMNO` (`actor.alumnoId`), `ALUMNO` sin `alumnoId` → 403, el validador de usuario (con `-`, con tilde, largo) y `forzarRecordarSesion` con `/sign-in/username`.
9. Documentación: `arquitectura-backend.md` → Autenticación (ingreso con usuario, `actor.alumnoId`, `alumnoDeLaSesion`); `contrato-api.md` → Autenticación y Roles (`ALUMNO` activo desde este sprint); `decisiones.md`.

**Criterios de aceptación**

- El alumno del seed inicia sesión con su usuario y su DNI (`POST /api/auth/sign-in/username`) y su sesión se renueva por actividad como la del personal.
- El personal sigue ingresando con su email; el registro público sigue cerrado.
- Un endpoint con `requireRole('ALUMNO')` obtiene el alumno de la sesión sin consultar la base.

---

## T-76 · [Back] Reuso: deuda con asistencia, pagos anulados y deuda vencida (`cuentas.condiciones`)

- **HU:** HU-22 (amplía HU-16), HU-29 (tope de deuda), HU-42 (aviso)
- **Área:** Backend
- **Rama:** `feat/deuda-sprint3`
- **Depende de:** T-74
- **Estimación:** 2

**Descripción**
La deuda se consulta en la cuenta del alumno, en las vistas globales, en el tablero, en el portal, al sacar un turno y al anular un pago. Con la asistencia cambia qué se adeuda y aparece la "deuda vencida": se resuelve una sola vez en las condiciones de `cuentas`.

**Alcance**

1. `cuentas.reglas.ts`:
   - `esAdeudado`: fecha anterior a hoy, **no cancelada** (`SIN_REGISTRAR`, `REALIZADO` o `AUSENTE`, también un "Sin registrar" cerrado por el sistema: HU-22, "el lugar del alumno estuvo reservado") y pago `PENDIENTE`.
   - `esProximo`: de hoy en adelante, no cancelada, pago `PENDIENTE` y hasta el tope de cobro. Un turno de **hoy** con asistencia sigue en próximos: la fecha separa las dos secciones, como en HU-16 (propuesta, ver "Puntos a confirmar").
   - `DIAS_DEUDA_VENCIDA = 30` y `esDeudaVencida(ocurrencia, hoy)`: adeudada y con fecha de **hace 30 días o más**.
2. `cuentas.condiciones.ts`: `deudaVencida(client, { alumnoId, hoy })` → `{ cantidad, total }` (con `cantidad: 0` si no hay). Re-exporta `importeVigente` y `DIAS_DEUDA_VENCIDA`. La usan T-93 (tope al sacar turno) y T-104 (aviso al anular).
3. Un pago anulado ya no cuenta como pago (lo resuelve el motor, T-74): sus turnos vuelven solos a adeudados o próximos. Sólo se agregan los tests.
4. Tests con reloj fijo: `REALIZADO` y `AUSENTE` pasados e impagos → adeudados; cerrado por el sistema → adeudado; anulado → vuelve a adeudado; deuda vencida justo a los 30 días y no a los 29; un turno de hoy con asistencia → próximo.
5. Documentación: `dominio.md` → Deuda (estados que se adeudan) y Tope de deuda (la regla de los 30 días; la completa T-93).

**Criterios de aceptación**

- Un turno "Realizado" impago de la semana pasada suma al total adeudado en la ficha, en la vista global y en el tablero, sin cambios en esas features.
- `deudaVencida` coincide con la suma de los adeudados de 30 días o más de ese alumno.

---

## T-77 · [Front] Reuso: estados de asistencia y plazo de registro (`components/turno`)

- **HU:** HU-22 (la usan T-82, T-85, T-87, T-109 y T-111; la variante "sin asistencia", T-85 y T-87)
- **Área:** Frontend
- **Rama:** `feat/ui-estados-asistencia`
- **Estimación:** 1
- **Prioridad:** Día 1, sin dependencias

**Alcance**

1. `indicadores-turno.ts`: `ESTADO_TURNO` suma `REALIZADO` ("Realizado") y `AUSENTE` ("Ausente"), cada uno con su color (tokens nuevos en `globals.css`, en tema claro y oscuro, distinguibles de "Cancelado" y "Sin registrar"; la palabra siempre se lee, no sólo el color).
2. `EstadoTurnoBadge({ estado, plazo? })`: con `SIN_REGISTRAR` y `plazo`, "Sin registrar · vence el 12/10" o "Sin registrar · cerrado por el sistema". La fecha y si venció vienen de la API (`plazoAsistencia`): el componente no calcula el vencimiento.
3. **Variante "sin asistencia"** (decisión de las PO: ninguna vista de calendario ni de lista muestra la asistencia, que se ve sólo en el detalle del turno): una prop de `EstadoTurnoBadge` que muestra "Agendado" y "Cancelado" como hoy y deja sin distintivo un turno pasado no cancelado (ni "Sin registrar", ni "Realizado", ni "Ausente"). La usan el calendario semanal y las vistas lista de las agendas, de los turnos de la ficha del alumno y de "Mi calendario" (T-85, T-87). Los estados de asistencia con su color se ven en el detalle del turno, la pantalla "Asistencia" y el historial.
4. Test de `indicadores-turno` (los cinco estados tienen etiqueta y variante) y documentación en `arquitectura-frontend.md` → Componentes compartidos del turno.

**Criterios de aceptación**

- Los cinco estados y los dos "Sin registrar" se leen bien en tema claro, oscuro y en el celular.
- Con la variante "sin asistencia", un turno "Realizado" se ve igual que un turno pasado del Sprint 2, sin estado de asistencia.

---

## T-78 · [Front] Reuso: campo de archivo con vista previa (`components/ui`)

- **HU:** HU-24 (comprobante adjunto) y HU-26 (foto del alumno)
- **Área:** Frontend
- **Rama:** `feat/ui-campo-archivo`
- **Estimación:** 2
- **Prioridad:** Día 1, sin dependencias

**Alcance**

1. `components/ui/campo-archivo.tsx` (`CampoArchivo`): se elige el archivo o se arrastra al campo; props `aceptar` (MIME → etiqueta), `maxBytes`, `valor: File | null`, `onCambiar`, `error` y `deshabilitado`.
2. Vista previa antes de confirmar: una imagen como miniatura (URL de objeto, liberada al cambiar o desmontar) y un PDF con ícono, nombre y tamaño; "Quitar" y "Elegir otro".
3. Si el archivo no es de un tipo aceptado o supera el tamaño, no queda elegido y se muestra el mensaje que pasa quien lo usa ("El archivo debe ser JPG, PNG o PDF", "El archivo supera los 5 MB"). Es ayuda: la validación de verdad es de la API (T-73).
4. Accesible por teclado y asociado a su `Label` (el patrón de `Field`). No migra `FotoProfesorCampo` (es de `profesores`): queda anotado como FIX posible.
5. Documentación: `arquitectura-frontend.md` → Estilos y UI.

**Criterios de aceptación**

- Se puede elegir con el mouse, con el teclado y arrastrando; un PDF de 6 MB marca el error y no queda elegido.

---

## T-79 · [Front] Andamiaje: pestañas, subpestañas, detalle del pago y slots

- **HU:** Transversal (habilita HU-22, HU-24, HU-27, HU-31, HU-36 y HU-42 en el frontend)
- **Área:** Frontend
- **Rama:** `feat/andamiaje-sprint3-ui`
- **Estimación:** 3
- **Prioridad:** Bloqueante para el frontend del personal, días 1 y 2

**Descripción**
Varias HU muestran algo en las mismas pantallas: la ficha del alumno suma "Historial académico" y la pestaña "Pagos" se divide en dos; el detalle del pago (nuevo) lo abren el detalle del turno y "Pagos realizados", y tiene la acción de anular; el formulario y la ficha del alumno suman el acceso al portal. Esta tarea deja la estructura con **un placeholder por HU y sus props definitivas**, compuesto desde `app/`.

**Alcance**

1. **Features nuevas del front**, cada una con `api/<f>.keys.ts`, `use-invalidar-<f>.ts` y sus placeholders:

   | Feature       | Placeholder (props definitivas)                                                      | Lo completa |
   | ------------- | ------------------------------------------------------------------------------------ | ----------- |
   | `asistencias` | `AsistenciaPantalla({ renderDetalle })`                                              | T-82        |
   | `historiales` | `HistorialAcademico({ alumnoId, rol, renderDetalle })`                               | T-109       |
   | `anulaciones` | `AccionAnularPago({ pago })`                                                         | T-105       |
   | `pagos`       | `PagoDetalle({ pagoId, onCerrar, renderAcciones })`, `EnlaceDetallePago({ pagoId })` | T-99        |
   | `pagos`       | `PagosRealizados({ alumnoId?, soloLectura?, onAbrirPago })`                          | T-100       |
   | `alumnos`     | `AccesoPortalAlta({ nombre, apellido, dni })`, `AccesoPortalFicha({ alumno })`       | T-90        |
   - El `pago` que reciben las acciones es `PagoParaAcciones` (`src/types/pago.ts`): `{ id, numeroComprobante, estado, alumno, total, cantidad, acciones: { anular, reemplazarAdjunto, quitarAdjunto } }`, del contrato de T-98. Como en el Sprint 2, **las acciones las decide la API**.

2. **Ficha del alumno:** `AlumnoDetalle` suma `renderHistorial` (pestaña "Historial académico", `?tab=historial`). Mesa: Datos, Turnos, Historial académico, Exámenes y Pagos. Profesor: Datos, Historial académico y Exámenes.
3. **Pestaña "Pagos" con subpestañas** en la URL (`?tab=pagos&vista=por-cobrar|realizados`): "Por cobrar" = `PagosDelAlumno` (como hoy) y "Pagos realizados" = `PagosRealizados({ alumnoId })`. Lo mismo en `/mesa/pagos` (`?vista=`), con `PagosGlobal` y `PagosRealizados({})`. Al cambiar de subpestaña, los filtros de la otra se van (como al cambiar de pestaña).
4. **Detalle del pago:** `useDetallePagoEnUrl` (`?pago=<pagoId>`, en `features/pagos/hooks`, con un único archivo que conoce el parámetro, como `detalle-url.ts`). Composición en `app/mesa/_componentes/detalle-pago.tsx` (`PagoDetalle` con `renderAcciones` = `AccionAnularPago`), montada una sola vez en la ficha del alumno y en `/mesa/pagos`; `app/gerente/_componentes/detalle-pago.tsx`, sin acciones. En el detalle del turno, el slot `renderComprobante` suma `EnlaceDetallePago`.
5. **Menús:** profesor "Asistencia" (`/profesor/asistencia`, página con `AsistenciaPantalla` y su `renderDetalle`); gerente "Pagos" (`/gerente/pagos`, con `PagosRealizados({ soloLectura: true })` y su detalle del pago).
6. **Alumnos:** el alta (`AlumnoForm`) muestra `AccesoPortalAlta` con los valores del formulario; la ficha (`AlumnoDetalle` / `DatosAlumno`) muestra `AccesoPortalFicha`.
7. Documentación: `arquitectura-frontend.md` (features nuevas, subpestañas, detalle del pago en la URL, slots nuevos).

**Criterios de aceptación**

- La app se ve y funciona igual que al cerrar el Sprint 2, con las pestañas, subpestañas y menús nuevos vacíos.
- Cada placeholder existe con las props de la tabla y compila. Ninguna feature importa componentes de otra: todo se compone en `app/`.

---

## T-80 · [Front] Andamiaje: segmento del portal del alumno (`/portal`) e ingreso con usuario

- **HU:** HU-28 Ingreso al portal (habilita HU-29, HU-30, HU-33, HU-35 y HU-37)
- **Área:** Frontend
- **Rama:** `feat/portal-segmento-ui`
- **Depende de:** T-75 para conectarse (puede empezar contra su contrato)
- **Estimación:** 5
- **Prioridad:** Bloqueante para el frontend del portal, días 1 y 2

**Descripción**
El alumno pasa a tener su sección, pensada para el celular. Esta tarea arma el segmento, el ingreso con usuario y las páginas vacías; no construye las pantallas de cada HU.

**Alcance**

1. **Ingreso:** la pantalla de inicio de sesión es la misma para todos y el campo pasa a ser "Email o usuario". Con `@` se ingresa por email (como hoy) y sin `@`, por usuario (`authClient.signIn.username`, con el plugin cliente `usernameClient`). Los dos caminos muestran "Usuario o contraseña incorrectos" sin decir qué falló, también ante el 422 de un usuario con formato inválido (T-75). Archivos: `LoginForm`, `auth-client`, `auth.schema`, `interpretar-error-login` (con su test).
2. `features/auth/roles.ts`: `ALUMNO` → `/portal` (deja de ser `null`); `/` y el login lo llevan a `/portal/calendario`.
3. `app/portal/layout.tsx` con `AppShell`, `PortalSidebar` (en `components/layout/`: "Mi calendario", "Sacar turno", "Mis materias", "Mis pagos" y "Configuración"), el `UserMenu` y `SegmentoDeRol rol="ALUMNO"`.
4. **Avisos del portal**, visibles en todas sus pantallas:
   - "Para cancelar o reprogramar un turno, comunicate con la mesa de entrada al [teléfono del centro]" (`AvisoMesaDeEntrada`), con el teléfono de `GET /api/v1/centro` (HU-11; T-91 lo abre al rol `ALUMNO`). Vuelve `src/features/centro/` (api, keys y `useCentro`), que la decisión T-127 había sacado del front: ahora lo usa la UI, no los documentos.
   - El slot del aviso de contraseña inicial: `AvisoContrasenaInicial`, placeholder en `features/usuarios` que completa T-92.
5. **Páginas placeholder** (cada una pasa a su tarea):

   | Página                                      | Compone                                                                                            | Lo completa             |
   | ------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------- |
   | `/portal`                                   | redirige a `/portal/calendario`                                                                    | —                       |
   | `/portal/calendario`                        | `MiCalendario({ renderDetalle })` (`agendas`) y `DetalleTurnoPortal` (`app/portal/_componentes`)   | T-87 (el detalle, T-85) |
   | `/portal/turnos/nuevo`                      | `SacarTurno()` (`turnos`)                                                                          | T-94                    |
   | `/portal/materias`                          | `MisMaterias({ rutaBase })` (`historiales`)                                                        | T-111                   |
   | `/portal/materias/[materiaId]/[profesorId]` | `MiMateria({ materiaId, profesorId, renderExamenes })` y `MisExamenes({ materiaId })` (`examenes`) | T-111                   |
   | `/portal/pagos`                             | `MisPendientes()` (`cuentas`) y `MisPagosRealizados()` (`pagos`)                                   | T-103                   |
   | `/portal/configuracion`                     | `CambiarContrasena()` (`usuarios`)                                                                 | T-92                    |

6. **Celular:** `AppShell` y `sidebar-nav` se adaptan a pantallas chicas para todos los roles: por debajo de `md`, una barra superior con el logo y un botón que abre el menú como panel (con el foco adentro y cierre con `Escape`), y el contenido a todo el ancho. En escritorio no cambia nada (modos `iconos` y `fijo`).
7. "No tiene permiso para acceder a esta sección" funciona en los dos sentidos: un alumno que escribe `/mesa/alumnos` y un usuario de mesa que escribe `/portal`, cada uno con el enlace a su inicio.
8. Documentación: `arquitectura-frontend.md` → Roles y URLs (`/portal` existe), Layout (celular) y la vuelta de `features/centro`.

**Criterios de aceptación**

- El alumno del seed ingresa con su usuario y su DNI, llega a "Mi calendario" y ve sólo su menú; el personal sigue ingresando con su email.
- A 360 px de ancho el menú se abre y se cierra con el botón y ninguna página del portal tiene scroll horizontal.
- El aviso con el teléfono del centro se ve en todas las páginas del portal.

---

## T-81 · [Back] HU-22 · API de asistencia (feature `asistencias`)

- **HU:** HU-22 Registrar la asistencia a un turno
- **Área:** Backend
- **Rama:** `feat/asistencias-api`
- **Depende de:** T-72, T-73, T-74
- **Estimación:** 5

**Descripción**
El profesor registra y corrige la asistencia de sus turnos de hoy y de los 7 días anteriores. La feature lee las ocurrencias con el motor (T-74): no recalcula estados, plazos ni horas seguidas.

**Alcance**

1. **`GET /asistencias?fecha`** (`PROFESOR`; por defecto, hoy):
   - `fecha` hoy o anterior (400 si es futura). Cualquier día pasado se puede pedir: lo vencido se ve en sólo lectura (HU-22).
   - Devuelve las **clases** del profesor de la sesión en esa fecha (una hora de un bloque con al menos un turno no cancelado), en orden horario, cada una con horario, aula y sus filas. Los turnos cancelados no aparecen.
   - Cada **fila** es un grupo de horas seguidas (`agruparHorasSeguidas`) y va en la clase de su primera hora: alumno (id, apellido, nombre y `fotoUrl` prefirmada o `null`, HU-26), materia, temas a trabajar del turno, horario del grupo y `horas`, y por cada hora `{ turnoId, fecha, horaInicio, horaFin, estado, asistencia }`.
   - `indicacionesAnteriores` por fila: las de la última clase "Realizado" anterior de ese alumno en esa materia, con su fecha, o `null`. Una sola consulta para toda la pantalla (punto 4).
   - `plazo: { vence, vencido }` de la fecha y `editable` (no vencido), para que la pantalla no lo calcule.
2. **`GET /asistencias/pendientes`** (`PROFESOR`): turnos de días **anteriores** a hoy sin asistencia y todavía dentro del plazo, `{ cantidad, masAntiguo: { fecha, vence } | null }`, para "Tenés 3 turnos sin registrar de días anteriores. El más antiguo se puede registrar hasta el 12/10".
3. **`PUT /asistencias`** (`PROFESOR`), registra o corrige, **todo o nada**. Body `{ registros: [{ ocurrencias: [{ turnoId, fecha }], estado: 'PRESENTE' | 'AUSENTE', trabajado?, indicaciones?, observacion? }] }`:
   - Cada registro es una fila: una o varias horas seguidas del mismo alumno, profesor, materia y fecha (si no, 400). Con "Ajustar por hora", el front manda un registro por hora.
   - Cada ocurrencia existe y es del profesor de la sesión (403 si no), no está cancelada (409 `TURNO_CANCELADO`), es de hoy o anterior (400) y está dentro del plazo (409 `FUERA_DE_PLAZO`: "El plazo para registrar esta asistencia venció el 12/10"), con `plazoDeAsistencia` del motor.
   - `PRESENTE`: `trabajado` e `indicaciones` opcionales, de hasta 1000 caracteres, que se guardan en **cada** hora presente del registro. `AUSENTE`: `observacion` opcional, de hasta 500; `trabajado` e `indicaciones` no se aceptan (400).
   - Registrar y corregir es la misma operación sobre la misma fila (el único de T-72): la corrección actualiza `updatedById` y `updatedAt` (HU-22: quién y cuándo la modificó).
   - Dos pedidos sobre la misma ocurrencia no duplican filas (único) y el último gana; se relee dentro de la transacción.
   - Responde las filas actualizadas con la forma del `GET`.
   - **"Marcar todos presentes"** es un `PUT` con un registro `PRESENTE` por cada fila de la clase **sin asistencia**: las ya registradas no cambian (propuesta, ver "Puntos a confirmar").
4. `asistencias.condiciones.ts`: `ultimasIndicaciones(client, items: { alumnoId, materiaId, antesDe }[])`, en una sola consulta: la última asistencia `PRESENTE` con indicaciones de cada alumno y materia antes de esa fecha. La usa también T-108 ("Indicaciones para la próxima clase", HU-33).
5. Mesa de entrada y gerente no registran ni corrigen: 403 en los tres endpoints. Ven la asistencia en el detalle del turno (T-84), el historial (T-108) y el tablero (T-112).
6. Tests del service con reloj fijo: profesor ajeno → 403; cancelada → 409; futura → 400; el día 7 se acepta y el 8 da 409; ausente con `trabajado` → 400; los textos de un grupo quedan en cada hora presente; corrección con auditoría; "marcar todos" no pisa lo registrado; pendientes con y sin turnos en plazo.
7. Documentación: `contrato-api.md` → Asistencias; `dominio.md` → Asistencia (quién, plazo, campos, horas seguidas, corrección y cierre).

**Fuera de alcance**
Mostrar la asistencia en el detalle (T-84), el historial (T-108) y el tablero (T-112); qué no se puede hacer con un turno con asistencia (T-83).

**Criterios de aceptación**

- El profesor registra una sola vez a un alumno de tres horas seguidas y las tres quedan "Realizado" con los mismos textos.
- Pasado el séptimo día, el turno no se puede registrar ni corregir, pero se sigue viendo.

---

## T-82 · [Front] HU-22 · Pantalla "Asistencia" del profesor

- **HU:** HU-22
- **Área:** Frontend
- **Rama:** `feat/asistencias-ui`
- **Depende de:** T-81 (puede empezar en paralelo), T-77, T-79
- **Estimación:** 8

**Alcance**

1. `AsistenciaPantalla` (`features/asistencias`): la fecha en la URL (`?fecha=`), por defecto hoy, con `CalendarioFecha`; no se ofrece una fecha futura (la API igual la rechaza).
2. Aviso de pendientes con la fecha límite que manda `GET /asistencias/pendientes`, con un acceso al día del más antiguo.
3. Una tarjeta por clase (horario, materia y aula) y una fila compacta por alumno, no la tarjeta del listado: foto en miniatura o avatar genérico, apellido y nombre, materia, temas a trabajar, horario del grupo ("8:00 a 11:00 (3 h)"), estado (`EstadoTurnoBadge` con plazo) e indicaciones de la clase anterior, si las hay.
4. Registro por fila: "Presente" / "Ausente"; con presente, "Qué se trabajó" e "Indicaciones para la próxima sesión" (contador de 1000); con ausente, "Observación" (contador de 500). Se guarda por fila y muestra "Asistencia registrada".
5. "Ajustar por hora" en una fila de varias horas: un estado por hora y la observación de cada hora ausente; los textos de las horas presentes siguen siendo uno por fila.
6. "Marcar todos presentes" por clase (las filas sin registrar), con el mismo mensaje.
7. Corrección con los mismos controles mientras `editable` sea `true`; si no, todo en sólo lectura, con "Sin registrar · cerrado por el sistema" y su observación.
8. Los 409 (`FUERA_DE_PLAZO`, `TURNO_CANCELADO`) se muestran en la fila. Después de guardar, invalida `asistencias`, `ocurrencias`, `agendas`, `historiales` y `cuentas`.
9. Carga, vacío ("No tenés turnos este día") y error. Usable en tablet y celular: el profesor puede tomar la asistencia en el aula.

**Criterios de aceptación**

- Recorrido completo: marcar todos presentes, completar los textos de dos alumnos, ajustar por hora a un alumno que se retiró después de la primera hora y corregir al día siguiente.
- Un día de hace más de 7 días se ve en sólo lectura.

---

## T-83 · [Back] FIX · HU-13 / HU-14 / HU-20 · Un turno con asistencia no se cancela, reprograma ni finaliza

- **HU:** HU-22 (relación con otras operaciones); HU-13, HU-14 y HU-20
- **Área:** Backend
- **Rama:** `fix/operaciones-con-asistencia`
- **Depende de:** T-74
- **Estimación:** 2

**Descripción**
HU-22 completa la condición que HU-13 dejó fuera de alcance: un turno con asistencia ya ocurrió. Hoy cancelar y reprogramar sólo aceptan `AGENDADO`, así que un turno de hoy con asistencia se rechazaría con el motivo equivocado ("pasado"), y finalizar desde hoy lo liberaría.

**Alcance**

1. `cancelaciones`: motivo nuevo `CON_ASISTENCIA` en `TURNOS_NO_CANCELABLES`, "El turno tiene asistencia registrada: no se puede cancelar", publicado en `cancelaciones.condiciones.ts` junto a los otros mensajes (lo usa `ocurrencias` para las acciones).
2. `reprogramaciones`: 409 `TURNO_CON_ASISTENCIA`, "El turno tiene asistencia registrada: no se puede reprogramar".
3. `finalizaciones`: si alguna ocurrencia desde `fechaDesde` tiene asistencia (sólo puede ser la de hoy), 409 `TURNOS_CON_ASISTENCIA`, con el mismo tratamiento que los pagados: la previa la informa y la primera fecha posible es la siguiente.
4. Al anular un pago (HU-42), sus turnos se vuelven a poder cancelar y finalizar: lo resuelve el motor (T-74). Sólo se agrega un test por feature que lo confirme.
5. Tests de cada service; `contrato-api.md` (códigos nuevos) y `dominio.md` → Cancelación, Finalización y Reprogramación.

**Criterios de aceptación**

- Un turno de hoy con asistencia no se cancela, no se reprograma y no queda liberado al finalizar desde hoy; cada rechazo dice por qué.

---

## T-84 · [Back] HU-22 / HU-30 · Ocurrencias v3: detalle con asistencia, estados nuevos y turnos del alumno en el portal

- **HU:** HU-22 (detalle y registro desde el detalle), HU-29 (trazabilidad), HU-30 (portal) y HU-31 (detalle desde el historial)
- **Área:** Backend
- **Rama:** `feat/ocurrencias-sprint3-api`
- **Depende de:** T-74 (dueña de `ESTADOS_OCURRENCIA` hasta mergearse), T-75; T-81 (el `PUT /asistencias` con el que se registra desde el detalle, ya mergeada)
- **Estimación:** 3

**Descripción**
Con el ajuste del 14/10 (ver "Vocabulario del sprint" → Horas seguidas), el detalle de una hora muestra también sus horas seguidas, con el estado de cada una y los textos una sola vez, y el profesor del turno registra la asistencia desde ahí. Qué textos van una vez y cuáles aparte se decide en una sola regla del motor, que también usa el historial (T-108).

**Alcance**

1. **Textos de las horas seguidas** (regla pura, con test): `textosDeHorasSeguidas(horas)` en `turnos.reglas.ts`, publicada en `ocurrencias.condiciones.ts` junto a `agruparHorasSeguidas`. Recibe las horas de un grupo, en orden, y devuelve:
   - `textos: { trabajado, indicaciones } | null`: los de la **primera hora presente** del grupo, que se muestran una sola vez; `null` si ninguna hora está presente.
   - Por hora, alineado con la entrada, `textosPropios: { trabajado, indicaciones } | null`: los de esa hora sólo si es presente y **difieren** de `textos` ("muestra la que cambió"); `null` si coinciden o si no está presente.
   - La observación de un ausente es siempre de su hora: no se agrupa.
   - La usan este detalle y el historial (T-108, para la ficha, su PDF y "Mis materias"): ninguna vista compara textos por su cuenta.
2. **`GET /ocurrencias/{turnoId}/{fecha}`:**
   - `estado` con los valores nuevos y `plazoAsistencia`.
   - `asistencia: { estado, trabajado, indicaciones, observacion, registradaPor, registradaEl, modificadaPor, modificadaEl, cerradaPorSistema } | null`, **de esa hora**, con su auditoría: el detalle sigue siendo el de una ocurrencia (una hora, con su horario). Un "Sin registrar" vencido trae `cerradaPorSistema: true`, la observación del cierre y ninguna persona; dentro del plazo, `asistencia: null` y su `plazoAsistencia`.
   - **`horasSeguidas`**: si la hora pertenece a un grupo de más de una hora (`agruparHorasSeguidas`), `{ horaInicio, horaFin, horas, textos, ocurrencias: [{ turnoId, fecha, horaInicio, horaFin, estado, plazoAsistencia, actual, textosPropios, observacion }] }`, con todas las horas del grupo en orden y `actual: true` en la del detalle; si no, `null`. Ejemplo: Lucas viene de 8 a 9, de 9 a 10 y de 20 a 21. Los detalles de 8 a 9 y de 9 a 10 traen el mismo grupo (8:00 a 10:00, 2 h); el de 20 a 21, `null`. Una hora cancelada en el medio, u otra materia u otro profesor, cortan el grupo. Lo ve todo el que puede ver el detalle (también el profesor ajeno, en sólo lectura).
   - Una sola lectura del motor (las ocurrencias del alumno en esa fecha) resuelve la ocurrencia pedida y su grupo: ninguna consulta por hora.
   - `acciones`: cancelar y reprogramar no se ofrecen en un turno con asistencia; registrar pago sí, si está impago (un "Realizado" o "Ausente" se cobra). Lo deciden las reglas que publican `cancelaciones.condiciones` y `pagos.condiciones`, sin copiarlas: el cobro de un turno con asistencia aparece cuando T-96 suma esos estados a la regla de cobro.
   - **`acciones.registrarAsistencia: { visible }`**: `true` si quien mira es el **profesor del turno** y la hora se puede registrar: `plazoAsistencia` no nulo (de hoy o anterior y no cancelada) y no vencido, del motor y sin copiar reglas de `asistencias`. Mesa de entrada, gerente, profesor ajeno y alumno: `false`. Registrar y corregir usan el `PUT /asistencias` de T-81, sin endpoint nuevo. "Aplicar también a…" ofrece las otras horas de `horasSeguidas` **sin registrar**: una ya registrada se corrige desde su propio detalle, como en la pantalla "Asistencia".
   - Auditoría: `createdBy` con su **rol**, para que el detalle diga que lo registró el propio alumno desde el portal (HU-29).
   - **Profesor:** además de sus turnos, ve en sólo lectura (acciones en `false`, `pago: null`) el detalle de un turno de **otro** profesor si el alumno tiene o tuvo turnos con él: desde el historial (HU-31) se abre el detalle de cualquier clase del alumno. Si no, 403 como hoy.
3. `GET /ocurrencias?alumnoId` (pestaña "Turnos" de la ficha): estados nuevos y `plazoAsistencia`. Es una lista: no trae asistencia ni horas seguidas.
4. **Portal (HU-30):**
   - `GET /ocurrencias/mis-turnos?desde&hasta` (`ALUMNO`): las ocurrencias del alumno de la sesión en el rango (hasta 31 días), **incluidas las canceladas**, con horario, materia, profesor, aula, estado y estado de pago. Sin prioridad, ocupación ni observaciones.
   - `GET /ocurrencias/mis-turnos/{turnoId}/{fecha}` (`ALUMNO`): datos del turno, temas a trabajar, estado con su asistencia, estado de pago ("Pagado" o "Pendiente") y, si ya se dio, qué se trabajó y las indicaciones de esa hora. Suma `horasSeguidas`, con la misma forma que el detalle del personal. Sin prioridad, observaciones del turno, acciones ni auditoría. Un turno de otro alumno → 403.
5. Tests:
   - `textosDeHorasSeguidas`: todas las horas con los mismos textos → `textos` una vez y ningún `textosPropios`; una hora corregida con otros textos → sólo esa trae `textosPropios`; la primera hora ausente → `textos` sale de la primera presente; sin horas presentes → `textos: null`.
   - Del service: cada forma de `asistencia` (registrada, corregida, sin registrar en plazo y cerrada); `horasSeguidas` con el ejemplo de 8 a 9, 9 a 10 y 20 a 21, con una cancelada en el medio y con otra materia u otro profesor; cada hora del grupo con su propio estado; `registrarAsistencia` visible sólo para el profesor del turno dentro del plazo; acciones con asistencia; profesor ajeno con y sin relación con el alumno; portal propio y ajeno, con `horasSeguidas`; y que la respuesta del portal no tenga `prioridad`, `observaciones` ni `acciones`.
6. Documentación:
   - `contrato-api.md` → Ocurrencias y su fila en Portal del alumno (`src/types/ocurrencia.ts` lo actualiza T-85).
   - `convenciones-backend.md` → Ocurrencias, en "Horas seguidas": `textosDeHorasSeguidas` y quién la usa.
   - `dominio.md` → Asistencia, en "Horas seguidas": cómo se ven y el registro desde el detalle.
   - `decisiones.md`: el ajuste del 14/10 (las horas seguidas juntas, con los textos una sola vez, en el detalle, el historial, su PDF y "Mis materias"; registrar desde el detalle). Reemplaza lo resuelto en el punto 7 de "Puntos a confirmar".

**Criterios de aceptación**

- Lucas viene de 8 a 9, de 9 a 10 y de 20 a 21. Los detalles de 8 a 9 y de 9 a 10 muestran las dos horas, cada una con su estado, y los textos una sola vez; el de 20 a 21 no muestra horas seguidas.
- Si la hora de 9 a 10 se corrigió con otros textos, los dos detalles muestran los del grupo y, aparte, los de 9 a 10.
- Cada detalle sigue siendo de su hora: trae su estado y su asistencia completa, con la auditoría de esa hora.
- El profesor del turno, dentro del plazo, recibe `registrarAsistencia.visible: true`; la mesa de entrada, el gerente, un profesor ajeno y el alumno, `false`.
- El alumno ve el detalle de sus turnos, con sus horas seguidas, y recibe 403 si pide el de otro.

---

## T-85 · [Front] HU-22 / HU-30 · Detalle del turno con asistencia, turnos del alumno y detalle en el portal

- **HU:** HU-22 (detalle y registro desde el detalle), HU-29 y HU-30
- **Área:** Frontend
- **Rama:** `feat/ocurrencias-sprint3-ui`
- **Depende de:** T-84, T-77, T-79, T-80; T-81 y T-82 (el `PUT /asistencias` y el formulario que se reusa, ya mergeadas)
- **Estimación:** 3

**Alcance**

1. `src/types/ocurrencia.ts` con el contrato de T-84 (pasa a ser de esta tarea), incluidos `horasSeguidas` y `acciones.registrarAsistencia`.
2. `OcurrenciaDetalle`, sección "Asistencia":
   - La de **esa hora**: estado, qué se trabajó, indicaciones u observación, registrada y modificada por, con fecha y hora. Si la cerró el sistema, "Cerrado por el sistema" con su observación en lugar de una persona. `EstadoTurnoBadge` con plazo.
   - Si `horasSeguidas` no es `null`, el grupo debajo ("8:00 a 10:00 · 2 h"): cada hora con su `EstadoTurnoBadge` (la del detalle, marcada; las otras abren su propio detalle), "Qué se trabajó" e "Indicaciones para la próxima sesión" **una sola vez** (`textos`) y, en la hora que los tenga, sus `textosPropios`, más la observación de cada hora ausente. La pantalla no compara textos: muestra lo que manda la API.
   - En la trazabilidad, "Registrado por el alumno desde el portal" cuando el creador tiene rol `ALUMNO`.
3. **Registrar la asistencia desde el detalle**, si `acciones.registrarAsistencia.visible`:
   - El mismo formulario de la pantalla "Asistencia": "Presente" / "Ausente", los textos con su contador y "Aplicar también a…", con una casilla por cada otra hora de `horasSeguidas` sin registrar. Abre con lo registrado de esa hora: corregir es volver a guardar.
   - No se copia: es un componente nuevo de `features/asistencias`, `RegistrarAsistenciaTurno({ ocurrencia, horasSeguidas })`, que reusa las piezas de `FilaAsistencia` (selector de estado, textos, schema y `registrosDeFila`). `app/` lo compone en el detalle con una prop de render (`renderRegistrarAsistencia`), como `AccionRegistrarPago`.
   - Guarda con `useRegistrarAsistencias` (`PUT /asistencias`): un registro por hora tildada, con el mismo estado y los mismos textos. Muestra "Asistencia registrada"; los 409 (`FUERA_DE_PLAZO`, `TURNO_CANCELADO`) y los 400, en el formulario. Invalida `asistencias`, `ocurrencias`, `agendas`, `historiales` y `cuentas`.
4. `TurnosDelAlumno`: sin cambios visuales, con la variante "sin asistencia" de T-77 (la asistencia se ve al abrir el detalle); la casilla de cancelar sigue saliendo de `cancelable`.
5. `DetalleTurnoPortal` (`app/portal/_componentes/detalle-turno.tsx`), con un componente nuevo de `features/ocurrencias` (`OcurrenciaDetallePortal`) y su hook: datos, temas, estado, pago, lo trabajado e indicaciones, y el grupo de horas seguidas con la misma presentación del punto 2; sin acciones; en el celular, a pantalla completa.
6. Carga, vacío y error (403 incluido).

**Criterios de aceptación**

- El detalle del mismo turno, abierto desde la agenda, la ficha o el historial, muestra su asistencia y sus horas seguidas; las listas no muestran la asistencia.
- Desde el detalle de 8 a 9, el profesor marca "Presente" esa hora y la de 9 a 10 con los mismos textos. Los dos detalles quedan "Realizado" y muestran los textos una sola vez.
- Si después corrige sólo la de 9 a 10 con otros textos, el detalle muestra los del grupo y, aparte, los de 9 a 10.
- La mesa de entrada, el gerente y el alumno no ven el formulario.
- El alumno ve su detalle, con sus horas seguidas, sin prioridad, observaciones ni acciones.

---

## T-86 · [Back] HU-22 · Agendas: sin estados de asistencia

- **HU:** HU-22 (las agendas no muestran la asistencia: HU-09, HU-10, HU-19 y HU-30)
- **Área:** Backend
- **Rama:** `feat/agendas-asistencia-api`
- **Depende de:** T-74 (dueña de `ESTADOS_OCURRENCIA` hasta mergearse)
- **Estimación:** 1

**Descripción**
Decisión de las PO: ninguna vista de calendario ni de lista cambia; la asistencia se ve sólo en el detalle del turno (T-84). Esta tarea asegura que las agendas sigan funcionando y viéndose como hoy ahora que el motor devuelve los estados nuevos.

**Alcance**

1. Los ítems de `/agendas/diaria`, `/agendas/propia`, `/agendas/profesor` y `/agendas/centro` siguen trayendo el `estado` del motor, para abrir el detalle, pero **no se suman filtros por estado de asistencia**; `incluirCancelados` no cambia.
2. El calendario semanal y la vista lista usan las mismas respuestas: lo que no se muestra lo resuelve la variante "sin asistencia" de la UI (T-77, T-87).
3. El PDF de la agenda diaria se ve como las vistas: "Agendado" y "Cancelado" como hoy y un turno pasado no cancelado sin estado de asistencia, con una función propia de `agendas` (no con `etiquetaEstado` del motor).
4. Tests del service (una agenda con un turno "Realizado" lo sigue trayendo) y de la plantilla (el PDF no muestra "Realizado" ni "Ausente"), y `contrato-api.md` → Agendas (la asistencia sólo se ve en el detalle).

**Criterios de aceptación**

- Un turno con asistencia sigue apareciendo en las agendas y en el PDF de la agenda diaria sin su estado de asistencia.

---

## T-87 · [Front] HU-22 / HU-30 · Agendas sin estados de asistencia y "Mi calendario"

- **HU:** HU-22 y HU-30 Ver mi calendario de turnos
- **Área:** Frontend
- **Rama:** `feat/agendas-sprint3-ui`
- **Depende de:** T-86, T-84 (`mis-turnos`), T-77, T-80
- **Estimación:** 3

**Alcance**

1. Vista lista de las tres agendas: **sin cambios visuales**; usa la variante "sin asistencia" de T-77 para que los estados nuevos de la API no se vean. No se suman filtros por estado de asistencia.
2. Calendario semanal: **sin cambios visuales** (variante "sin asistencia" de T-77). Decisión de las PO: toda vista de calendario queda como está; los estados de asistencia se ven sólo en el detalle del turno.
3. **`MiCalendario({ renderDetalle })`** (portal), con la grilla y la lista de HU-19 sobre `GET /ocurrencias/mis-turnos`: semana actual con hoy destacado, semana anterior y siguiente, "Hoy"; selector "Calendario / Lista", con **la lista por defecto en el celular**; en el calendario y en la lista, horario, materia, profesor y aula con "Agendado" y "Cancelado" (variante "sin asistencia" de T-77); la asistencia se ve sólo en el detalle (T-85); los cancelados siempre visibles, con su color. Sin ocupación, cupos ni prioridad.
4. Semana sin turnos: "No tenés turnos esta semana" con acceso a "Sacar turno".
5. Tocar un turno abre `renderDetalle` (el detalle del portal de T-85), con `?detalle&fecha` en la URL, como en las agendas.

**Criterios de aceptación**

- Desde el celular, el alumno recorre semanas, ve un turno cancelado con su color y abre el detalle de una clase ya dada con lo que se trabajó.

---

## T-88 · [Back] HU-26 / HU-27 · Alumnos: foto y acceso al portal

- **HU:** HU-26 Foto de perfil del alumno; HU-27 Credenciales de acceso (y el perfil del menú de HU-28)
- **Área:** Backend
- **Rama:** `feat/alumnos-sprint3-api`
- **Depende de:** T-72, T-73 (`shared/archivos`)
- **Estimación:** 5

**Alcance**

1. **Foto (HU-26)**, con el patrón de la del profesor (el repository sube y borra con `lib/storage`; el controller arma la URL prefirmada):
   - `…/alumnos/{id}/foto` para subir o reemplazar (multipart, campo `foto`, JPG o PNG de hasta 5 MB con `archivoSchema`, mismos mensajes que la del profesor) y para quitarla. Rol `MESA_ENTRADAS`. Actualiza la auditoría del alumno.
   - `fotoUrl` (o `null`) en el listado, el detalle y `GET /alumnos/mis-alumnos`. El listado suma el **DNI** (HU-26 reemplaza "sólo apellido y nombre" de HU-02).
2. **Usuario del portal (HU-27):** regla pura `usuario-portal.ts`, con tests: inicial del nombre + apellido + últimos 3 dígitos del DNI, en minúsculas, sin espacios ni tildes y "ñ" → "n" (Juan Pérez, DNI 45.123.456 → "jperez456"); si ya existe, "-2", "-3"…
   - `GET /alumnos/usuario-sugerido?nombre&apellido&dni` (`MESA_ENTRADAS`): `{ usuario }`, para mostrarlo en el formulario en cuanto están los tres datos. Es una sugerencia: el definitivo se calcula al guardar.
3. **Alta con acceso:** `POST /alumnos` crea, en la misma transacción, el `Usuario` (rol `ALUMNO`, usuario generado, email sintético, DNI, teléfono del alumno o del tutor, `alumnoId`, `contrasenaInicial: true`; T-72) y su `Account` credential con el DNI sin puntos hasheado con `hashPassword()`. Una colisión de usuario por concurrencia (P2002) se reintenta con el sufijo siguiente; un DNI que ya tiene `Usuario` (por ejemplo, el de un profesor) → 409 con un mensaje claro (ver "Puntos a confirmar"). La respuesta trae `acceso.usuario`.
4. **Después del alta:**
   - El detalle trae `acceso: { usuario, creadoPor, creadoEl, restablecidaPor, restablecidaEl } | null`. La contraseña nunca se devuelve.
   - `POST /alumnos/{id}/acceso` (`MESA_ENTRADAS`): crea el acceso de un alumno anterior a este incremento, con la misma regla; 409 si ya lo tiene.
   - `POST /alumnos/{id}/acceso/restablecimiento` (`MESA_ENTRADAS`): la contraseña vuelve a ser el DNI, `contrasenaInicial: true`, y registra quién y cuándo (`Account.contrasenaRestablecidaPorId` y `contrasenaRestablecidaFecha`, decisión T-135); 409 si no tiene acceso.
   - Editar nombre o apellido **no cambia el usuario** (HU-27), pero sí el nombre de la sesión (`Usuario.nombre` y `apellido`, en la misma transacción).
5. `GET /alumnos/mi-perfil` (`ALUMNO`): `{ nombre, apellido, usuario, fotoUrl }`, para el menú del portal (HU-28).
6. Tests del service: foto inválida → 400; quitar sin foto no es error; usuario con tilde, "ñ", apellido compuesto y colisión; el alta crea las tres filas o ninguna; DNI con usuario existente → 409; crear el acceso dos veces → 409; restablecer sin acceso → 409; cambiar el nombre no cambia el usuario; `mi-perfil` de otro rol → 403.
7. Documentación: `contrato-api.md` → Alumnos; `dominio.md` → Alumnos (foto) y Portal del alumno (acceso); `decisiones.md` (sufijo por colisión y sincronía del nombre).

**Criterios de aceptación**

- Dar de alta a Juan Pérez deja el acceso "jperez456" con su DNI como contraseña inicial.
- Un alumno anterior a este incremento obtiene su acceso desde la ficha, y la contraseña se puede restablecer al DNI.

---

## T-89 · [Front] HU-26 · Foto del alumno

- **HU:** HU-26
- **Área:** Frontend
- **Rama:** `feat/alumnos-foto-ui`
- **Depende de:** T-88 (puede empezar en paralelo), T-78, T-79
- **Estimación:** 3

**Alcance**

1. Alta y edición (`AlumnoForm`, `AlumnoEditar`): foto opcional con `CampoArchivo` (JPG o PNG, 5 MB). En el alta se sube después de crear al alumno, como con el profesor; en la edición, se reemplaza o se quita (con confirmación).
2. **Listado:** pasa a ser una grilla de tarjetas como la de profesores (foto o avatar genérico, apellido, nombre y DNI), con el buscador y la paginación de hoy.
3. Foto o avatar genérico en el encabezado del detalle y en "Mis alumnos" del profesor.
4. La trazabilidad del detalle refleja el cambio de foto (lo trae la API).

**Criterios de aceptación**

- Se sube, reemplaza y quita la foto; el listado se ve como el de profesores, también en el celular.

---

## T-90 · [Front] HU-27 · Acceso al portal en el alta y en la ficha

- **HU:** HU-27
- **Área:** Frontend
- **Rama:** `feat/alumnos-acceso-ui`
- **Depende de:** T-88, T-79
- **Estimación:** 2

**Alcance**

1. `AccesoPortalAlta`: sección "Acceso al portal" en el alta. El usuario aparece (de `GET /alumnos/usuario-sugerido`, con debounce) cuando están nombre, apellido y DNI, y no se escribe a mano. Texto: "La contraseña inicial es el DNI del alumno (sin puntos). El alumno puede cambiarla desde Configuración en el portal".
2. `AccesoPortalFicha`: "Usuario del portal: jperez456"; quién creó el acceso y quién restableció la contraseña por última vez, con fecha y hora; "Restablecer contraseña" con la confirmación "La contraseña de jperez456 volverá a ser su DNI". Sin acceso: "Sin acceso al portal" y "Crear acceso al portal", con el mismo aviso de la contraseña inicial.
3. Mensajes de éxito y los 409 en la ficha; invalida el detalle del alumno.

**Criterios de aceptación**

- El usuario se ve en el formulario antes de guardar el alta; restablecer y crear el acceso funcionan desde la ficha.

---

## T-91 · [Back] HU-28 · Usuarios: mi usuario y cambio de contraseña

- **HU:** HU-28 Ingreso al portal del alumno (Configuración y aviso)
- **Área:** Backend
- **Rama:** `feat/usuarios-api`
- **Depende de:** T-75
- **Estimación:** 2

**Alcance**

1. Feature `usuarios` (lo que vale para cualquier usuario sin importar su rol):
   - `GET /usuarios/mi-usuario` (todos los roles): `{ id, nombre, apellido, role, usuario | null, contrasenaInicial }` (`contrasenaInicial` sale de `Account`, decisión T-135). El portal lo usa para el aviso "Por seguridad, te recomendamos cambiar tu contraseña".
   - `PATCH /usuarios/mi-usuario/contrasena` (`ALUMNO` en este incremento), body `{ actual, nueva, repeticion }`. En este orden: los tres obligatorios (400); `nueva` y `repeticion` iguales (400 en `repeticion`); `nueva` de al menos 8 caracteres (`LARGO_MINIMO_PASSWORD`), distinta de la actual y del DNI del alumno (400 en `nueva`); `actual` correcta (400 "La contraseña actual no es correcta" en `actual`), verificada por Better Auth (`auth.api.changePassword`), sin reimplementar el hash. Después, `contrasenaInicial: false`; la sesión sigue abierta.
2. `GET /centro` suma el rol `ALUMNO` (el teléfono del aviso del portal). No cambia nada más de `centro`.
3. Tests del service: cada 400 y el éxito, que apaga `contrasenaInicial`.
4. `contrato-api.md` → Usuarios y su fila en Portal del alumno; `dominio.md` → Portal del alumno (contraseña).

**Criterios de aceptación**

- El alumno cambia su contraseña y deja de figurar con la contraseña inicial; con la actual incorrecta no cambia nada.

---

## T-92 · [Front] HU-28 · Menú del alumno, Configuración y aviso de contraseña inicial

- **HU:** HU-28
- **Área:** Frontend
- **Rama:** `feat/portal-acceso-ui`
- **Depende de:** T-91, T-88 (`mi-perfil`), T-80
- **Estimación:** 2

**Alcance**

1. `UserMenu`: para el alumno, su nombre, su foto o un avatar genérico (`GET /alumnos/mi-perfil`) y "Cerrar sesión"; para los demás roles, como hoy.
2. `CambiarContrasena` (`features/usuarios`, página Configuración): contraseña actual, nueva y repetición, enmascaradas con opción de mostrarlas; cada error de la API en su campo; éxito "Contraseña actualizada", con la sesión abierta.
3. `AvisoContrasenaInicial`: aviso que no bloquea, "Por seguridad, te recomendamos cambiar tu contraseña", con enlace a Configuración, mientras `contrasenaInicial` sea `true`; se va al cambiarla (invalida `mi-usuario`).

**Criterios de aceptación**

- El alumno del seed ve el aviso, cambia la contraseña y el aviso desaparece; si la mesa la restablece, vuelve a aparecer.

---

## T-93 · [Back] HU-29 · Sacar turno desde el portal y tope de deuda

- **HU:** HU-29 Sacar un turno desde el portal (y amplía HU-08)
- **Área:** Backend
- **Rama:** `feat/turnos-portal-api`
- **Depende de:** T-74 (dueña de `turnos.reglas.ts`), T-75, T-76 (`deudaVencida`)
- **Estimación:** 5

**Descripción**
El alumno saca turnos con el mismo motor y las mismas validaciones que la mesa (HU-08), por un recorrido más simple. Y la deuda vencida bloquea los turnos nuevos en los dos caminos.

**Alcance**

1. **Tope de deuda**, en `POST /turnos` (mesa) y `POST /turnos/mis-turnos` (alumno): 409 `DEUDA_VENCIDA` con `{ cantidad, total }` si el alumno tiene deuda vencida (`deudaVencida`, T-76), calculada en el momento, dentro de la transacción del alta y con el lock del alumno. Mensaje para la mesa: "El alumno tiene deuda de más de 30 días (3 turnos · $ 24.000). Debe regularizar el pago para agendar turnos nuevos"; para el alumno: "Tenés clases adeudadas de hace más de 30 días. Para sacar un turno nuevo, regularizá el pago en la mesa de entrada". No afecta cancelar, reprogramar ni los turnos que ya tiene. Importar `cuentas.condiciones` desde `turnos.repository` no forma un ciclo de archivos (`cuentas.condiciones` sólo importa el motor de `turnos`): verificarlo y dejarlo en `decisiones.md`.
2. `GET /turnos/mis-turnos/habilitacion` (`ALUMNO`): `{ habilitado, deuda: { cantidad, total } | null }`, para validar al entrar a "Sacar turno", antes del paso 1.
3. `GET /turnos/mis-turnos/materias` (`ALUMNO`): materias activas con al menos un profesor activo que la tenga asignada y tenga bloques activos.
4. `GET /turnos/mis-turnos/disponibilidad` (`ALUMNO`): la misma búsqueda que `GET /turnos/disponibilidad` (materia obligatoria; profesor y día opcionales; sólo profesores activos con la materia), **con la misma función del service**, pero cada hora como `disponible: boolean` (sin cupos, ocupación ni alumnos) y con aula, profesor y `valorPorClase` (el precio por hora vigente de la materia, HU-12).
5. `POST /turnos/mis-turnos` (`ALUMNO`): el body de `POST /turnos` sin `alumnoId` (es el de la sesión), con las reglas de HU-08 (capacidad por hora y fecha, materia asignada, día del bloque, temas obligatorios en sesión única) y además:
   - Fechas **desde mañana**: hoy o antes → 400 "Los turnos se sacan desde el día siguiente".
   - Superposición: 409 `ALUMNO_SUPERPUESTO` con "Ya tenés un turno ese día en ese horario".
   - Semanal con fechas llenas: el 409 `BLOQUE_LLENO` con las fechas, y `asignarDondeHayLugar` para "Reservar sólo las fechas con lugar", como hoy.
   - El turno queda `AGENDADO` sin aprobación, con `createdById` del usuario del alumno (T-84 lo muestra en la trazabilidad).
   - Responde el resumen para "Turno reservado".
6. Tests del service: deuda de 30 días bloquea a los dos caminos y la de 29 no; la fecha de hoy → 400 sólo en el portal; disponibilidad sin cupos; superposición con el mensaje del alumno; "reservar sólo las fechas con lugar"; el creador es el alumno.
7. `contrato-api.md` → Turnos y su fila en Portal del alumno; `dominio.md` → Turnos y Tope de deuda.

**Criterios de aceptación**

- Un alumno con deuda vencida no puede sacar turno ni por el portal ni por la mesa; sin deuda, reserva un turno semanal y aparece en las agendas.

---

## T-94 · [Front] HU-29 · "Sacar turno" en el portal y aviso de deuda al registrar un turno

- **HU:** HU-29
- **Área:** Frontend
- **Rama:** `feat/turnos-portal-ui`
- **Depende de:** T-93 (puede empezar en paralelo), T-80
- **Estimación:** 5

**Alcance**

1. `SacarTurno` (archivos nuevos de `features/turnos`, para no tocar los del alta de mesa): al entrar consulta la habilitación; con deuda vencida, sólo el aviso con acceso a "Mis pagos".
2. Pasos pensados para el celular, uno por pantalla y con "Volver": materia; profesor y día (opcionales); horario ("Disponible" / "Completo"; las completas no se eligen); tipo ("Una sola clase" / "Todas las semanas"); fechas (una sola clase: la fecha; semanal: inicio y fin opcional; desde mañana); "¿Qué querés trabajar en la clase?" (obligatorio en una sola clase).
3. Resumen antes de confirmar: materia, profesor, aula, día y horario, fechas y valor por clase (de la API), con "Las clases se abonan en la mesa de entrada".
4. Rechazos: superposición; fechas completas, con "Reservar sólo las fechas con lugar" o "Elegir otro horario"; deuda vencida, si cambió mientras tanto.
5. Éxito "Turno reservado", con el aviso de cancelar o reprogramar por la mesa de entrada y acceso a "Mi calendario". Invalida `ocurrencias` y `agendas`.
6. Mesa (`RechazoAlta`): el 409 `DEUDA_VENCIDA` muestra el mensaje de la API y "Cobrar", que lleva a la pestaña "Pagos" de la ficha del alumno.

**Criterios de aceptación**

- Desde el celular, recorrido completo de una sola clase y de un semanal con fechas llenas.
- La mesa ve el bloqueo por deuda con el acceso a cobrar.

---

## T-95 · [Back] HU-24 · API de comprobantes adjuntos (feature `adjuntos`)

- **HU:** HU-24 Adjuntar el comprobante de un pago
- **Área:** Backend
- **Rama:** `feat/adjuntos-api`
- **Depende de:** T-72, T-73
- **Estimación:** 3

**Descripción**
El comprobante adjunto es el archivo de la familia que respalda un pago por transferencia o con débito. Se sube **antes** de registrar el pago (así el formulario lo muestra en vista previa y el pago se registra todo junto) y queda vinculado al registrarlo. Después se puede ver y reemplazar, sin borrar el anterior; en un pago con débito, también quitar (baja lógica).

**Alcance**

1. `POST /adjuntos` (`MESA_ENTRADAS`), multipart con el campo `archivo`: JPG, PNG o PDF de hasta 5 MB (`archivoSchema` de T-73, con la firma), con los mensajes de HU-24 ("El archivo debe ser JPG, PNG o PDF", "El archivo supera los 5 MB"). Sube a `adjuntos/<uuid>.<ext>` y crea un `ComprobanteAdjunto` sin pago. 201 `{ id, nombre, tipo, bytes }`.
2. `adjuntos.condiciones.ts`:
   - `vincularAdjunto(tx, { adjuntoId, pagoId, actor })`: el adjunto existe, no está vinculado y lo subió el mismo usuario; si no, 400 `ADJUNTO_INVALIDO` en `comprobanteAdjuntoId`. La usa T-96 dentro de la transacción del pago, así un pago que falla no se queda con el adjunto.
   - `ultimoAdjunto(client, pagoId)`: el último **activo** de un pago (`estado: ACTIVO`, decisión T-136), para quien lo muestre (T-98).
3. `GET /adjuntos/pagos/{pagoId}` (`MESA_ENTRADAS`, `GERENTE`): el último adjunto activo `{ id, nombre, tipo, bytes, url, adjuntadoPor, adjuntadoEl }`, con una URL prefirmada que lo abre en otra pestaña (`Content-Disposition: inline`: `lib/storage.ts` suma esa opción, y es la única tarea que lo toca). 404 si el pago no existe o no tiene adjunto. `ALUMNO` → 403 (el alumno no lo ve, HU-24).
4. `PUT /adjuntos/pagos/{pagoId}` (`MESA_ENTRADAS`), multipart: reemplaza el comprobante. El anterior **no se borra**, ni la fila ni el archivo; se muestra sólo el último, con quién lo adjuntó y cuándo. Un pago anulado conserva todo como estaba (HU-42) → 409 `PAGO_ANULADO`; un pago en efectivo no lleva adjunto → 409. En un pago con débito sin adjunto (nunca tuvo o se quitó), el mismo `PUT` lo adjunta.
5. **`DELETE /adjuntos/pagos/{pagoId}`** (`MESA_ENTRADAS`): quita el comprobante adjunto de un pago **con débito**, donde es opcional (HU-24). Es una **baja lógica**: el adjunto activo pasa a `INACTIVO` con quién y cuándo (T-72), y no se borran ni la fila ni el archivo (los clientes no permiten borrar). Después, `GET` → 404 y el pago se ve sin adjunto. Con transferencia → 409 `ADJUNTO_OBLIGATORIO` ("Un pago por transferencia no puede quedar sin comprobante: reemplazalo"); efectivo o sin adjunto activo → 404; pago anulado → 409 `PAGO_ANULADO`. 204 si sale bien.
6. Un archivo que se subió y nunca se vinculó (el pago no se registró) queda sin pago, no se lista ni molesta. Limpiarlos queda como pendiente en `decisiones.md`.
7. Verificar la subida de un PDF de 5 MB con `pnpm build && pnpm start` contra MinIO, no sólo en `pnpm dev`.
8. Tests: tipo, firma o tamaño inválidos → 400; vincular dos veces → 400; ver el último; reemplazar conserva el anterior; quitar en débito deja el pago sin adjunto y conserva la fila y el archivo; quitar en transferencia → 409; adjuntar a un débito sin adjunto; anulado → 409; alumno → 403.
9. Documentación: `contrato-api.md` → Adjuntos; `dominio.md` → Comprobante adjunto; `arquitectura-backend.md` → Archivos.

**Criterios de aceptación**

- Se sube un PDF, se registra el pago con ese adjunto y se abre en otra pestaña.
- Reemplazarlo deja los dos guardados y muestra el último.
- En un pago con débito, quitarlo deja el pago sin comprobante adjunto y el archivo sigue guardado; en uno por transferencia no se puede quitar.

---

## T-96 · [Back] HU-23 · Pagos con transferencia y débito; comprobante de pago con medios, materias y anulación

- **HU:** HU-23 Cobrar con transferencia o tarjeta de débito (y HU-25: comprobante agrupado por materia; HU-42: leyenda de anulado)
- **Área:** Backend
- **Rama:** `feat/pagos-medios-api`
- **Depende de:** T-72, T-74, T-95 (`vincularAdjunto`; puede empezar contra su firma)
- **Estimación:** 5

**Alcance**

1. **`POST /pagos`** suma `formaPago` (`EFECTIVO`, `TRANSFERENCIA` o `DEBITO`), **obligatoria y sin valor por defecto** (400 si falta), y los datos de un solo medio:
   - `EFECTIVO`: `montoRecibido` obligatorio y >= total (como hoy, decisión T-112).
   - `TRANSFERENCIA`: `transferencia: { operacion, banco, titular? }` (hasta 50, 100 y 100 caracteres) y `comprobanteAdjuntoId` **obligatorio** (400 "El comprobante es obligatorio con transferencia"). Sin monto recibido ni vuelto. No se compara el importe transferido ni se impide repetir la operación: una transferencia puede cubrir a varios alumnos (HU-23).
   - `DEBITO`: `debito: { red, cupon, ultimos4? }` (red de la lista; cupón sólo números, hasta 20; últimos 4, exactamente 4 números) y `comprobanteAdjuntoId` opcional. Sin monto recibido. Nunca se pide ni se guarda el número completo de la tarjeta. Como el adjunto es opcional, después de registrado el pago se puede **dar de baja** (baja lógica, `DELETE /adjuntos/pagos/{pagoId}` de T-95) o agregar uno; el pago sigue siendo válido sin él. Con transferencia no: sólo se reemplaza.
   - Datos de otro medio → 400 en ese campo (un pago, un medio). El importe no cambia según el medio.
   - El adjunto se vincula con `vincularAdjunto` dentro de la transacción del pago.
   - **Cobrable**, además de `AGENDADO` y `SIN_REGISTRAR`: `REALIZADO` y `AUSENTE` (HU-22: un turno dado e impago se cobra igual). Una ocurrencia de un pago anulado se puede volver a cobrar (lo resuelve el motor, T-74); el único con `vigente` de T-72 sigue siendo la red contra el pago doble (la P2002 se traduce al mismo 409).
   - La respuesta suma `formaPago`, para "Pago registrado: 4 turnos por $ 32.000 por transferencia"; `montoRecibido` y `vuelto` vienen en `null` fuera del efectivo.
2. **`GET /pagos/{id}`:** `formaPago { codigo, nombre }` y los datos de su medio; `estado` y, si está anulado, `anulacion { motivo, detalle, anuladoPor, anuladoEl }` (se lee `AnulacionPago` junto con el pago: un dato de sólo lectura, el criterio de la decisión T-120).
3. **Comprobante de pago en PDF** (`pagos.pdf.tsx`):
   - La forma de pago con sus datos: efectivo con monto recibido y vuelto; transferencia con operación, banco y titular; débito con red, cupón y "**** 1234" si se cargaron los últimos dígitos.
   - **Agrupado por materia**, con el subtotal de cada una, cuando el pago tiene más de una (HU-25).
   - Si está anulado, "ANULADO" bien visible, con el motivo y la fecha de anulación (HU-42).
   - Tests de la plantilla (un medio por caso, agrupado y anulado), como los del Sprint 2.
4. **`pagos.condiciones.ts`** publica, para T-104 y T-112: `totalCobradoEntre` sólo con pagos **vigentes**; `totalCobradoPorForma(client, { desde, hasta })` → `{ EFECTIVO, TRANSFERENCIA, DEBITO }`; `leerPagoParaAnular(client, pagoId)` (estado, alumno, número, total, turnos con materia, fecha e importe cobrado, y los datos de la transferencia) y `pagosConMismaTransferencia(client, { operacion, banco, excluirPagoId })`.
5. Tests del service: cada medio con sus campos obligatorios y prohibidos; transferencia sin adjunto → 400; adjunto ajeno → 400; cobrar un "Realizado" y un "Ausente"; volver a cobrar una ocurrencia de un pago anulado; el total cobrado sin anulados y por forma.
6. Documentación: `contrato-api.md` → Pagos; `dominio.md` → Pagos (formas de pago).

**Fuera de alcance**
El listado de pagos realizados y el acceso del gerente y del alumno (T-98); anular (T-104).

**Criterios de aceptación**

- Se registran un pago por transferencia con su comprobante y uno con débito, y el PDF muestra el medio y sus datos.
- Un pago con Inglés y Matemática sale en el PDF agrupado por materia, con subtotales.

---

## T-97 · [Front] HU-23 / HU-24 · Registrar pago con forma de pago y comprobante adjunto

- **HU:** HU-23, HU-24 (al registrar) y HU-25 (subtotales por materia)
- **Área:** Frontend
- **Rama:** `feat/pagos-medios-ui`
- **Depende de:** T-96 y T-95 (puede empezar en paralelo), T-78
- **Estimación:** 5

**Alcance**

1. `RegistrarPagoDialog`: "Forma de pago" obligatoria y sin opción elegida al abrir; sólo los campos del medio elegido, y al cambiar de medio se limpian los del anterior.
   - Efectivo: como hoy (monto recibido y el vuelto de la API).
   - Transferencia: número de operación, banco o billetera, titular (opcional) y "Comprobante" (obligatorio).
   - Débito: red (lista), número de cupón, últimos 4 dígitos (opcional) y "Comprobante" (opcional).
2. "Comprobante" con `CampoArchivo` (JPG, PNG o PDF, 5 MB): se sube a `POST /adjuntos` al elegirlo, con vista previa, "Quitar" y "Elegir otro", y el pago se registra con su `comprobanteAdjuntoId`. Si la subida falla, se ve en el campo; con transferencia no se puede confirmar. `api/adjuntos.api.ts` trae también ver, reemplazar y quitar (los usa T-99).
3. Confirmación con el medio: "¿Registrar el pago de 4 turnos por $ 32.000 por transferencia?". El éxito dice el medio y, en efectivo, el vuelto de la API.
4. Resumen con el subtotal por materia cuando hay más de una (HU-25), sumando los importes que manda la API.
5. Los 400 en su campo (incluidos los del medio y del adjunto); el 409 como hoy.
6. Una transferencia que cubre a varios hijos: cada pago se registra aparte, con los mismos datos y el mismo comprobante. El formulario lo aclara con una ayuda.

**Criterios de aceptación**

- Se registran un pago en efectivo, uno por transferencia con comprobante y uno con débito sin comprobante.
- Con transferencia no se puede confirmar sin el comprobante.

---

## T-98 · [Back] HU-36 / HU-37 · Pagos realizados: listado, totales por forma de pago, detalle y portal

- **HU:** HU-36 Historial de pagos; HU-37 (pagos realizados del alumno)
- **Área:** Backend
- **Rama:** `feat/pagos-realizados-api`
- **Depende de:** T-96 (dueña de `pagos/*` hasta mergearse)
- **Estimación:** 3

**Alcance**

1. **`GET /pagos?alumnoId?&desde&hasta&materiaId?&profesorId?&formaPago?&page&pageSize`** (`MESA_ENTRADAS`, `GERENTE`): pagos con **fecha de pago** en el período (`desde` y `hasta` obligatorios: la UI manda el mes en curso por defecto); con materia o profesor, los pagos que incluyen algún turno de esa materia o profesor. Del más reciente al más antiguo y paginados. Cada pago: id, número de comprobante, fecha, alumno, materias incluidas, cantidad de turnos, total, forma de pago, quién lo registró, `estado` y, si está anulado, su motivo.
   - `totales: { cobrado, porForma: { EFECTIVO, TRANSFERENCIA, DEBITO } }` de **todo el filtro**, no sólo de la página, y **sin los anulados**: se listan, marcados, pero no suman.
2. `GET /pagos/{id}` y `GET /pagos/{id}/pdf` suman el rol `GERENTE`, en sólo lectura (HU-36 amplía HU-21: ve cada pago, no la agenda ni la ficha). El detalle suma `adjunto` (el último activo, con nombre, tipo, quién y cuándo, sin URL: la da T-95; `null` si no tiene) y `acciones: { anular, reemplazarAdjunto, quitarAdjunto }` según el rol, el estado y la forma de pago (`PagoParaAcciones`, T-79): `quitarAdjunto` sólo para la mesa de entrada, en un pago vigente **con débito** que tiene adjunto; `reemplazarAdjunto` también en un débito sin adjunto (para adjuntar uno).
3. **Portal (HU-37):** `GET /pagos/mis-pagos?page` (`ALUMNO`): sus pagos, del más reciente al más antiguo (número, fecha, materias, total, forma de pago y estado), sin quién lo registró ni el adjunto. `GET /pagos/{id}/pdf` acepta al `ALUMNO` **sólo si el pago es suyo** (403 si no).
4. Tests: filtros combinados; totales por forma sin anulados; el gerente ve y no registra (`POST /pagos` → 403); el alumno ve los suyos y no los de otro; acciones según rol, estado y forma de pago (`quitarAdjunto` sólo con débito).
5. Documentación: `contrato-api.md` → Pagos y su fila en Portal del alumno; `dominio.md` → Pagos (historial).

**Criterios de aceptación**

- El total cobrado coincide con la suma de los pagos vigentes del filtro y se separa por forma de pago.
- Un pago anulado se lista marcado y no suma.

---

## T-99 · [Front] HU-24 / HU-36 · Detalle del pago y reemplazo del comprobante adjunto

- **HU:** HU-24 (consulta y reemplazo) y HU-36 (detalle)
- **Área:** Frontend
- **Rama:** `feat/pago-detalle-ui`
- **Depende de:** T-98, T-95, T-79
- **Estimación:** 3

**Alcance**

1. `PagoDetalle` (modal con `?pago=<id>`): número de comprobante, estado ("Anulado" con motivo, quién y cuándo), alumno, fecha de pago, forma de pago con sus datos, los turnos (fecha, horario, materia, profesor e importe) y el total; "Ver comprobante" (el PDF, `hrefComprobante`) y, si tiene, "Ver comprobante adjunto", que abre en otra pestaña la URL de `GET /adjuntos/pagos/{id}`.
2. "Reemplazar comprobante adjunto" (si `acciones.reemplazarAdjunto`): `CampoArchivo` y confirmación; después se ve el nuevo, con quién lo adjuntó y cuándo. En un pago con débito sin adjunto, el mismo diálogo se ofrece como "Adjuntar comprobante".
3. "Quitar comprobante adjunto" (si `acciones.quitarAdjunto`: sólo pagos con débito), con confirmación ("¿Quitar el comprobante adjunto de este pago? El archivo queda guardado en el sistema"), con `DELETE /adjuntos/pagos/{id}`; después el detalle muestra que no tiene comprobante adjunto. En un pago por transferencia nunca se ofrece.
4. Siempre "Comprobante de pago" para el PDF del centro y "Comprobante adjunto" para el archivo de la familia.
5. `renderAcciones(pago)` al pie (lo completa `AccionAnularPago`, T-105). `EnlaceDetallePago` en la sección "Pago" del detalle del turno.
6. Para el gerente, el mismo detalle sin acciones.

**Criterios de aceptación**

- Desde el detalle de un turno pagado y desde "Pagos realizados" se abre el mismo detalle del pago.
- Reemplazar el comprobante adjunto muestra el nuevo.
- En un pago con débito se quita el comprobante adjunto y el detalle lo muestra sin adjunto; en uno por transferencia no aparece "Quitar".

---

## T-100 · [Front] HU-36 · "Pagos realizados" en la ficha, en la vista global y para el gerente

- **HU:** HU-36
- **Área:** Frontend
- **Rama:** `feat/pagos-realizados-ui`
- **Depende de:** T-98, T-79
- **Estimación:** 3

**Alcance**

1. `PagosRealizados({ alumnoId?, soloLectura?, onAbrirPago })`, con los filtros en la URL: período por fecha de pago (por defecto, el mes en curso), materia, profesor, forma de pago y, en la vista global, alumno (con el buscador de alumnos, como `PagosGlobal`); `LimpiarFiltros` como en el resto.
2. Arriba, el total cobrado del filtro y su detalle por forma de pago, de la API.
3. Tabla paginada: número de comprobante, fecha, alumno (vista global), materias, cantidad de turnos, total, forma de pago y quién lo registró; los anulados marcados "Anulado", con el motivo. "Ver detalle" abre el detalle del pago.
4. Vacío: "No hay pagos en este período".
5. `/gerente/pagos`: la misma lista en sólo lectura, sin enlace a la ficha del alumno.

**Criterios de aceptación**

- Filtrar por forma de pago cambia el total y su detalle.
- El gerente ve los pagos y su detalle, sin poder registrar ni anular.

---

## T-101 · [Back] HU-25 / HU-37 · Cuentas: filtro por varias materias y pendientes del portal

- **HU:** HU-25 Cobrar una materia completa; HU-37 (pendientes)
- **Área:** Backend
- **Rama:** `feat/cuentas-sprint3-api`
- **Depende de:** T-76 (dueña de `cuentas.reglas.ts` y `cuentas.condiciones.ts`)
- **Estimación:** 2

**Descripción**
Para cobrar una o varias materias completas no hace falta un filtro por meses ni por tipo de turno: alcanza con que el filtro de materia acepte **más de una**. Con eso la cuenta ya trae, de esas materias, los turnos adeudados y los próximos (hasta el tope de cobro), y el front sólo suma "Seleccionar todo" (T-102).

**Alcance**

1. **Varias materias (HU-25):** `materiaId` de `GET /cuentas/alumnos/{alumnoId}`, `/cuentas/adeudados` y `/cuentas/proximos` acepta **una o más** materias (el parámetro repetido: `?materiaId=2&materiaId=5`). Con una sola funciona como hoy; sin `materiaId`, todas. Los demás filtros (profesor y período `desde`/`hasta`) no cambian. La respuesta trae los adeudados y los próximos de esas materias (los próximos sin pasar del tope de cobro) y el total adeudado es su suma.
2. **"Seleccionar todo":** la cuenta del alumno no está paginada, así que el front selecciona lo que trae. En la vista global, el mecanismo que ya selecciona todas las páginas de los adeudados (decisión T-102) acepta el mismo filtro de varias materias y se extiende a los próximos. Si una selección supera el máximo de un pago (200 ocurrencias, `POST /pagos`), la API lo informa.
3. **Portal (HU-37):** `GET /cuentas/mi-cuenta` (`ALUMNO`): `{ totalAdeudado, adeudados, proximos, limiteCobro }` del alumno de la sesión, con fecha, horario, materia, profesor e importe, **agrupados por materia con su subtotal**. Los mismos importes y reglas que ve la mesa (HU-37).
4. Tests: dos materias traen los adeudados y los próximos de las dos y ninguno de una tercera; una sola materia, igual que hoy; un id repetido no duplica; el agrupado por materia del portal.
5. Documentación: `contrato-api.md` → Cuentas (`materiaId` múltiple) y su fila en Portal del alumno; `decisiones.md`: HU-25 se resuelve con el filtro de varias materias, sin filtro por meses ni por tipo de turno.

**Fuera de alcance**
Filtro por meses y por tipo de turno (descartados por las PO).

**Criterios de aceptación**

- Inglés y Matemática filtradas juntas traen todos sus turnos adeudados y próximos, y ninguno de otra materia.
- El alumno ve el mismo total adeudado que la mesa de entrada.

---

## T-102 · [Front] HU-25 · Filtro de varias materias y "Seleccionar todo"

- **HU:** HU-25
- **Área:** Frontend
- **Rama:** `feat/cuentas-materia-ui`
- **Depende de:** T-101 (puede empezar en paralelo)
- **Estimación:** 2

**Alcance**

1. En "Por cobrar" (ficha del alumno, y vista global con un alumno filtrado), el filtro de **materia pasa a ser de selección múltiple**, en la URL y con "Limpiar filtros". Profesor y período quedan como hoy. No se agregan filtros por meses ni por tipo de turno.
2. Checkbox **"Seleccionar todo"** sobre la lista: marca todos los turnos que deja el filtro, adeudados y próximos (en la vista global, de todas las páginas, con el mecanismo de la decisión T-102), y lo aclara: "Se seleccionaron los 12 turnos del filtro". Queda intermedio si se destilda uno, y con todo marcado pasa a "Deseleccionar todo".
3. Al cambiar los filtros, la selección se comporta como hoy (decisiones T-97 a T-101): para cobrar varias materias juntas se eligen todas en el filtro de materia.
4. Barra de selección: cantidad y total ("8 turnos · $ 64.000") y el subtotal por materia cuando hay más de una; se puede destildar cualquiera antes de continuar.
5. Después sigue el registro de pago de T-97.

**Criterios de aceptación**

- Con Inglés y Matemática en el filtro y "Seleccionar todo", se cobran en un solo pago sus turnos adeudados y próximos, y el comprobante sale agrupado por materia.

---

## T-103 · [Front] HU-37 · "Mis pagos"

- **HU:** HU-37 Mis pagos
- **Área:** Frontend
- **Rama:** `feat/portal-pagos-ui`
- **Depende de:** T-101, T-98, T-80
- **Estimación:** 2
- **Prioridad:** Estirable (propuesta, a confirmar con las PO)

**Alcance**

1. `MisPendientes` (`GET /cuentas/mi-cuenta`): total adeudado; turnos adeudados y próximos (hasta el tope de cobro) con fecha, horario, materia, profesor e importe, agrupados por materia con su subtotal. Sin nada pendiente: "No tenés pagos pendientes".
2. `MisPagosRealizados` (`GET /pagos/mis-pagos`): número de comprobante, fecha, materias, total y forma de pago, del más reciente al más antiguo, con "Ver comprobante" (el PDF en otra pestaña); un anulado se ve "Anulado".
3. Aviso: "Los pagos se realizan en la mesa de entrada, en efectivo, por transferencia o con tarjeta de débito". Todo de sólo lectura.
4. Pensado para el celular: tarjetas en lugar de tablas anchas.

**Criterios de aceptación**

- El alumno ve los mismos importes que la mesa para su cuenta y abre sus comprobantes.

---

## T-104 · [Back] HU-42 · API de anulación de pagos (feature `anulaciones`)

- **HU:** HU-42 Anular un pago
- **Área:** Backend
- **Rama:** `feat/anulaciones-api`
- **Depende de:** T-72, T-74, T-76 (`deudaVencida`), T-96 (`pagos.condiciones`)
- **Estimación:** 3

**Alcance**

1. `GET /anulaciones/previa?pagoId` (`MESA_ENTRADAS`): el resumen para la confirmación ("¿Anular el comprobante N.º 123 de Juan Pérez por $ 32.000 (4 turnos)?") y los **avisos, que informan sin bloquear**:
   - deuda: si al anular, el alumno quedaría con deuda vencida (su deuda vencida de hoy más los turnos del pago con fecha de 30 días o más, a precio vigente);
   - precio: por materia, si el precio vigente es distinto del cobrado ("Los turnos se volverán a cobrar a $ 9.000 por hora; en este pago se cobraron a $ 8.000");
   - transferencia compartida: los otros pagos vigentes con la misma operación y banco (número y alumno), que no se anulan con este.
2. `POST /anulaciones` (`MESA_ENTRADAS`), `{ pagoId, motivo, detalle? }`: motivo del enum; detalle de hasta 500, **obligatorio con `OTRO`** (400). Pago inexistente → 404; ya anulado → 409 `PAGO_ANULADO` ("Un pago anulado no se puede volver a activar"). En una transacción con `bloquearAlumno` (el mismo lock que pagar, cancelar y reprogramar): `Pago.estado = ANULADO` con su auditoría, una `AnulacionPago` y `vigente = null` en sus `PagoTurno`. Responde `{ pagoId, cantidad }`, para "Pago anulado. Sus turnos volvieron a quedar pendientes de pago".
3. Se anula el pago completo, nunca un turno suelto. El pago conserva todos sus datos, su forma de pago y su comprobante adjunto; el número no se reutiliza.
4. Tests del service: `OTRO` sin detalle → 400; doble anulación → 409; los turnos quedan pendientes en la siguiente lectura del motor y se pueden volver a cobrar; los tres avisos, con y sin datos; carrera con un pago nuevo de las mismas ocurrencias (el lock serializa).
5. Documentación: `contrato-api.md` → Anulaciones; `dominio.md` → Anulación de pagos.

**Criterios de aceptación**

- Anular un pago de 4 turnos los deja pendientes, y se vuelven a cobrar al precio vigente.
- El comprobante del pago anulado sigue disponible, con la leyenda "ANULADO".

---

## T-105 · [Front] HU-42 · Anular un pago

- **HU:** HU-42
- **Área:** Frontend
- **Rama:** `feat/anulaciones-ui`
- **Depende de:** T-104, T-99 (puede empezar en paralelo)
- **Estimación:** 2

**Alcance**

1. `AccionAnularPago({ pago })`: "Anular pago" en el detalle del pago, si `pago.acciones.anular`.
2. Diálogo: motivo ("Error de carga", "Forma de pago equivocada" u "Otro"), detalle (obligatorio con "Otro", contador de 500) y la confirmación con el resumen y los avisos de la previa, tal como los manda la API.
3. Éxito: "Pago anulado. Sus turnos volvieron a quedar pendientes de pago"; el detalle pasa a "Anulado" con motivo, quién y cuándo. Invalida `pagos`, `cuentas`, `ocurrencias` y `agendas` con sus `use-invalidar-*`.
4. El 409 (otra persona ya lo anuló) se muestra en el diálogo.

**Criterios de aceptación**

- Se anula desde el detalle abierto en "Pagos realizados" y desde el de un turno pagado, y los turnos vuelven a "Por cobrar".

---

## T-106 · [Back] HU-34 / HU-35 · Nota del examen y exámenes del portal

- **HU:** HU-34 Cargar la nota de un examen; HU-35 Mis exámenes y notas
- **Área:** Backend
- **Rama:** `feat/examenes-nota-api`
- **Depende de:** T-72, T-75 (portal)
- **Estimación:** 2
- **Prioridad:** la parte del portal (punto 3, HU-35) es estirable (propuesta) y va al final

**Alcance**

1. `PATCH /examenes/{id}/nota` (`MESA_ENTRADAS`; `PROFESOR` con las restricciones de HU-17: sólo de las materias que le dicta a ese alumno, 403 si no), body `{ resultado: 'CON_NOTA' | 'AUSENTE', nota? }`:
   - Sólo un examen ya rendido (fecha hoy o anterior): uno futuro → 409 `EXAMEN_FUTURO` ("Un examen futuro no admite nota").
   - `CON_NOTA`: `nota` de 1 a 10 con hasta dos decimales (400). `AUSENTE`: sin nota (400 si viene) y no cuenta para los promedios.
   - Cargar y corregir con las mismas reglas, con la trazabilidad propia de la nota **con el rol** (quién la cargó y quién la modificó por última vez, con fecha y hora, como HU-17).
   - Las observaciones del examen se siguen editando con `PATCH /examenes/{id}`.
2. `GET /examenes?alumnoId`: los pasados suman `resultado`, `nota`, su trazabilidad y `cargarNota` (si quien consulta puede cargarla: rendido y `administrable`), y la respuesta suma `rendidosSinNota`, para "2 exámenes rendidos sin nota". El profesor sigue viendo todos los exámenes del alumno y sólo edita los suyos (HU-31).
3. **Portal (HU-35):** `GET /examenes/mis-examenes?materiaId` (`ALUMNO`): el próximo examen de la materia (a lo sumo uno) con fecha, tipo y días que faltan; los rendidos (fecha, tipo y resultado: la nota, "Ausente" o "Sin nota"), del más reciente al más antiguo; y el promedio de las notas, sin los ausentes, o `null`. Sin observaciones ni auditoría.
4. `examenes.condiciones.ts` publica `leerExamenesDelPeriodo(client, { alumnoId, desde, hasta, materiaIds? })`, con su resultado, para el PDF del historial (T-110). La prioridad (`leerPrioridades`) no cambia.
5. Tests del service; `contrato-api.md` → Exámenes y su fila en Portal del alumno; `dominio.md` → Notas de exámenes.

**Criterios de aceptación**

- El profesor carga la nota de un examen rendido de su materia y no puede cargar la de otra.
- Un examen futuro no admite nota.

---

## T-107 · [Front] HU-34 · Cargar la nota de un examen

- **HU:** HU-34
- **Área:** Frontend
- **Rama:** `feat/examenes-nota-ui`
- **Depende de:** T-106 (puede empezar en paralelo)
- **Estimación:** 2

**Alcance**

1. `ExamenesDelAlumno` (pestaña "Exámenes" de mesa y del profesor): los pasados muestran la nota, "Ausente" o "Sin nota"; "Cargar nota" o "Editar nota" según `cargarNota` de la API; el aviso "2 exámenes rendidos sin nota".
2. Diálogo: resultado ("Con nota" / "Ausente al examen") y, con nota, el número de 1 a 10 con hasta dos decimales (con coma decimal; el rango lo valida la API y su 400 se ve en el campo). Una ayuda recuerda que el comentario va en las observaciones del examen.
3. Trazabilidad de la nota con el rol ("Nota cargada por … (Profesor) el …").
4. Invalida `examenes` e `historiales`.

**Criterios de aceptación**

- Mesa de entrada carga y corrige cualquier nota; el profesor, sólo las de sus materias, y ve las demás en sólo lectura.

---

## T-108 · [Back] HU-31 / HU-33 · API del historial académico (feature `historiales`)

- **HU:** HU-31 Historial académico del alumno; HU-33 Mis materias e historial de asistencia
- **Área:** Backend
- **Rama:** `feat/historiales-api`
- **Depende de:** T-74, T-75, T-81 (`ultimasIndicaciones`), T-84 (`textosDeHorasSeguidas`; puede empezar contra su firma)
- **Estimación:** 5

**Descripción**
El historial es una lectura, sin tablas propias: toma las ocurrencias pasadas del alumno con el motor (estado, asistencia y cancelación), **una por hora**, y las ordena por materia y profesor, para la ficha (mesa y profesor), para "Mis materias" del portal y para el PDF (T-110). Con el ajuste del 14/10 (ver "Vocabulario del sprint" → Horas seguidas), las horas seguidas van **juntas**, con el estado de cada hora y los textos una sola vez; cada hora se sigue contando por separado.

**Alcance**

1. **`GET /historiales/alumnos/{alumnoId}?desde&hasta&materiaId?&profesorId?`** (`MESA_ENTRADAS`; `PROFESOR` sólo si el alumno tiene o tuvo turnos con él, el criterio de "Mis alumnos", 403 si no):
   - Período por defecto: el mes en curso; `hasta` anterior a `desde` → 400; un tope de días (por ejemplo, 366, como el tablero) que se deja en `decisiones.md`.
   - Sólo ocurrencias de hoy o anteriores: los turnos futuros están en los turnos del alumno.
   - Grupos por **materia y profesor** ("Matemática — Prof. Gómez"), cada uno con `resumen: { realizadas, ausencias, porcentaje }` (presentes sobre presentes más ausentes, cada hora como un turno; cancelados y sin registrar no cuentan; un decimal, 0 sin base) y sus `bloques`, de la más reciente a la más antigua.
   - Cada **bloque** son las **horas seguidas** de un día (`agruparHorasSeguidas` de T-74; una hora suelta o cancelada es un bloque de una): `{ fecha, horaInicio, horaFin, horas, textos, clases }`. `textos` son "Qué se trabajó" e indicaciones, que se muestran **una sola vez**, y salen de `textosDeHorasSeguidas` (T-84), sin recalcularse.
   - Cada clase sigue siendo **una hora**: horario, estado ("Realizado", "Ausente", "Cancelado" o "Sin registrar", con su plazo o el cierre del sistema y su observación), `textosPropios` (sólo si sus textos difieren de los del bloque), la observación de la ausencia, el motivo de un cancelado (HU-13), y su `turnoId` y `fecha` para abrir el detalle.
   - `opciones: { materias, profesores }` del historial completo del alumno, para los filtros.
2. **Portal (HU-33):**
   - `GET /historiales/mis-materias` (`ALUMNO`): cada materia y profesor en los que el alumno tiene o tuvo turnos, con su próximo turno (fecha y horario) y su porcentaje de asistencia.
   - `GET /historiales/mis-materias/{materiaId}/{profesorId}?mes` (`ALUMNO`; por defecto, el mes en curso): `indicacionesProximaClase` (las de la última clase realizada, de cualquier fecha, con `ultimasIndicaciones` de T-81) y las clases del mes en **bloques de horas seguidas**, con la misma forma: estado de cada hora ("Realizado", "Ausente" o "Cancelado": HU-33 no lista los "Sin registrar", que se omiten del bloque), qué se trabajó e indicaciones una sola vez y, en la hora que los tenga distintos, los suyos. Sin observaciones internas ni datos de otros alumnos. Una materia y profesor en los que no cursa → 404.
3. Una sola función del service arma el historial para la ficha, el portal y el PDF; `historiales.reglas.ts` (puro, con test) agrupa en bloques y resume.
4. Tests del service con reloj fijo:
   - grupos por materia y profesor; porcentaje sin cancelados ni sin registrar;
   - tres horas seguidas salen como **un bloque** con tres clases, cada una con su estado, y los textos una sola vez, y el porcentaje cuenta las tres;
   - una hora del bloque con otros textos trae sus `textosPropios`;
   - una hora cancelada en el medio corta el bloque;
   - cerrado por el sistema con su observación; profesor sin relación con el alumno → 403;
   - el portal sin "Sin registrar"; indicaciones de una clase anterior al mes.
5. Documentación: `contrato-api.md` → Historiales y su fila en Portal del alumno; `dominio.md` → Historial académico.

**Criterios de aceptación**

- Un alumno que cursa Matemática con dos profesores ve dos grupos, cada uno con su porcentaje.
- Un alumno que vino de 8 a 10 con los mismos textos ve un solo bloque con las dos horas y los textos una vez, y el porcentaje cuenta dos clases.
- El profesor ve el historial completo de su alumno (también las clases con otros profesores) y recibe 403 con un alumno que no tiene.

---

## T-109 · [Front] HU-31 / HU-32 · Pestaña "Historial académico" y botón "Generar PDF"

- **HU:** HU-31 y HU-32 (el botón)
- **Área:** Frontend
- **Rama:** `feat/historiales-ui`
- **Depende de:** T-108, T-77, T-79
- **Estimación:** 3

**Alcance**

1. `HistorialAcademico({ alumnoId, rol, renderDetalle })`: filtros en la URL (un mes, por defecto el actual, o un rango desde-hasta; materia y profesor con las `opciones` de la API) y "Limpiar filtros".
2. Una sección por materia y profesor con su resumen (clases realizadas, ausencias y porcentaje) y, debajo, sus clases en **bloques de horas seguidas** (los `bloques` de la API):
   - fecha y horario del bloque ("8:00 a 10:00 · 2 h");
   - el `EstadoTurnoBadge` de **cada** hora, con plazo o cierre;
   - "Qué se trabajó" e indicaciones **una sola vez** y, en la hora que los tenga distintos, sus `textosPropios`;
   - la observación de cada hora ausente y el motivo de un cancelado;
   - clic en una hora abre su detalle del turno (`renderDetalle`, `?detalle&fecha`).

   La pantalla no compara textos: muestra lo que manda la API.

3. Vacío: "No hay clases registradas en este período". Sólo lectura en los dos roles.
4. Mesa de entrada: "Generar PDF" (`hrefPdfHistorial` en `features/historiales/rutas-historiales.ts`, con test), con el mes que se ve y los filtros de materia y profesor; si el filtro es un rango de más de un mes, primero se elige el mes. Se enlaza y abre en otra pestaña (decisión T-123). Es estirable junto con T-110.

**Criterios de aceptación**

- Mesa de entrada y profesor ven el mismo historial, y desde una clase se abre su detalle.
- Un alumno que vino de 8 a 10 se ve en un solo bloque, con el estado de cada hora y los textos una vez.
- El PDF sale con el mes y los filtros que se ven.

---

## T-110 · [Back] HU-32 · PDF del historial académico

- **HU:** HU-32 PDF del historial académico
- **Área:** Backend
- **Rama:** `feat/historiales-pdf-api`
- **Depende de:** T-108 (dueña de `historiales.routes.ts` y del controller hasta mergearse; la plantilla puede empezar en paralelo), T-106 (`leerExamenesDelPeriodo`)
- **Estimación:** 3
- **Prioridad:** Estirable (propuesta, a confirmar con las PO)

**Alcance**

1. `GET /historiales/alumnos/{alumnoId}/pdf?mes&materiaId?&profesorId?` (`MESA_ENTRADAS`), con el contrato común de los PDF (decisiones T-122 y T-123) y el mismo cálculo del historial, sin duplicar reglas.
2. Contenido: encabezado oficial (`encabezadoDeDocumento`); alumno (apellido, nombre, DNI y nivel de escolaridad), mes y filtros; por materia y profesor, el resumen y la lista de clases **en bloques de horas seguidas**, con los mismos `bloques` del historial (fecha y horario del bloque, el estado de cada hora y qué se trabajó e indicaciones una sola vez; los de la hora que los tenga distintos, aparte); los turnos cancelados del mes con fecha, horario y motivo; los exámenes del mes con su nota, si la tienen. **Sin** las observaciones internas de la ficha. Un mes sin clases lo dice.
3. Nombre del archivo: "historial-academico", el alumno y el mes, con la convención de la decisión T-123 (ver "Puntos a confirmar": HU-32 pide `_` entre las partes).
4. Archivos: `historiales.pdf.tsx`, `historiales.documentos.ts`, `historiales.formato.ts`, la ruta y su handler. Tests como los del Sprint 2 (`%PDF-`, páginas y metadatos; la ruta con el service mockeado).
5. `contrato-api.md` → Documentos PDF e Historiales.

**Criterios de aceptación**

- El PDF de octubre de un alumno con dos materias trae los dos resúmenes con sus clases, los cancelados y los exámenes con nota, y no trae observaciones internas.
- Las horas seguidas salen en un solo bloque, con los textos una vez, igual que en la pantalla.

---

## T-111 · [Front] HU-33 / HU-35 · "Mis materias": historial y exámenes del alumno

- **HU:** HU-33 y HU-35
- **Área:** Frontend
- **Rama:** `feat/portal-materias-ui`
- **Depende de:** T-108, T-106, T-80
- **Estimación:** 3
- **Prioridad:** la sección "Exámenes" (HU-35) es estirable (propuesta)

**Alcance**

1. `MisMaterias`: cada materia y profesor ("Inglés — Prof. Ruiz") con su próximo turno y su porcentaje de asistencia; tocarla entra a la materia.
2. `MiMateria`: primero y destacadas, las "Indicaciones para la próxima clase"; debajo, el historial del mes (filtro de mes, por defecto el actual), de la más reciente a la más antigua, en **bloques de horas seguidas** (los de la API): fecha y horario del bloque, el estado de cada hora, y qué se trabajó e indicaciones **una sola vez** (si una hora los tiene distintos, también los suyos). Sin clases realizadas: "Todavía no tenés clases registradas en esta materia".
3. `MisExamenes({ materiaId })`, la sección "Exámenes" de la misma pantalla: el próximo con "en 5 días" u "hoy" (de la API), los rendidos con su resultado y el promedio de la materia. Sin exámenes: "No hay exámenes cargados en esta materia".
4. Sólo lectura y pensado para el celular.

**Criterios de aceptación**

- Desde el celular, el alumno ve qué tiene que preparar para la próxima clase y su historial del mes.
- Si vino de 8 a 10, ve un solo bloque con las dos horas y los textos una vez.

---

## T-112 · [Back] HU-39 · Tablero por secciones: General y Asistencia

- **HU:** HU-39 Tablero del gerente por secciones
- **Área:** Backend
- **Rama:** `feat/tablero-secciones-api`
- **Depende de:** T-74, T-76, T-96 (`totalCobradoPorForma`)
- **Estimación:** 5
- **Prioridad:** la sección "Asistencia" y su PDF son estirables (propuesta); lo de "General" no

**Alcance**

1. **`GET /tablero` ("General"):** los indicadores de asistencia que eran `{ disponible: false }` (decisión T-116) pasan a tener valor: `asistio` y `noAsistio` con cantidad y porcentaje **sobre los turnos con asistencia registrada**, y `alumnos.atendidos` (alumnos distintos con al menos un turno "Realizado"). `pagos.totalCobrado` sin anulados y `pagos.cobradoPorForma: { EFECTIVO, TRANSFERENCIA, DEBITO }`. Lo demás de HU-21 no cambia.
2. **`GET /tablero/asistencia?desde&hasta&…`** (`GERENTE`), con el mismo período y las mismas validaciones:
   - `resumen`: porcentaje de asistencia del centro; turnos cerrados "Sin registrar" por el sistema en el período; profesores con al menos un turno cerrado sin registrar; alumnos con menos de 75 % de asistencia (entre los que tienen algún registro; sólo la cantidad).
   - `profesores`, paginado de a 10: por profesor, clases realizadas, ausencias, porcentaje de asistencia de sus alumnos, turnos cerrados sin registrar, turnos dentro del plazo, porcentaje de sin registrar sobre los turnos del período y `noRegistraAsistencia` (al menos uno cerrado sin registrar). Orden por defecto: cerrados sin registrar, de mayor a menor; `orden` y `direccion` por cualquier columna; filtro `soloSinRegistrar`.
   - `materias`, paginado de a 10: los mismos datos por materia.
   - Sólo agregados: nunca un alumno con nombre. Una sola lectura de ocurrencias del período y reglas puras en `tablero.reglas.ts` (el criterio de la decisión T-114).
3. **PDF por sección:** `GET /tablero/pdf?seccion=general|asistencia&desde&hasta` (por defecto `general`, así el enlace actual sigue funcionando). El de "General" reemplaza al de HU-21 e incluye la asistencia y lo cobrado por forma de pago; el de "Asistencia" trae los números principales y **las tablas completas**, no sólo la página que se ve.
4. Tests: cada indicador nuevo con datos falsos; porcentajes con base 0; orden y filtro de la tabla de profesores; anulados fuera de lo cobrado; las dos plantillas PDF.
5. Documentación: `contrato-api.md` → Tablero; `dominio.md` → Tablero; `decisiones.md` (reemplaza la decisión T-116).

**Criterios de aceptación**

- La pestaña "Asistencia" muestra qué profesores no registran la asistencia.
- Lo cobrado por forma de pago suma el total cobrado, sin los pagos anulados.
- El PDF de cada sección trae sus tablas completas.

---

## T-113 · [Front] HU-39 · Tablero por secciones

- **HU:** HU-39
- **Área:** Frontend
- **Rama:** `feat/tablero-secciones-ui`
- **Depende de:** T-112 (puede empezar en paralelo), T-77
- **Estimación:** 5
- **Prioridad:** la pestaña "Asistencia" es estirable (propuesta)

**Alcance**

1. `app/gerente/tablero` y `features/tablero`: pestañas "General" y "Asistencia" en la URL (`?seccion=`), con el selector de período arriba, común a las dos: al cambiar de pestaña se conserva.
2. "General": la disposición actual de HU-21, con "Asistió", "No asistió" y "Alumnos atendidos" con su valor (deja de verse "Disponible cuando se registre la asistencia") y el total cobrado separado por forma de pago.
3. "Asistencia": una fila de hasta 4 números principales y, debajo, como mucho dos tablas (profesores y materias), paginadas de a 10; la de profesores se reordena por cualquier columna, lleva el distintivo "No registra asistencia" y el filtro "Sólo con turnos sin registrar". Sin nombres de alumnos.
4. "Generar PDF" en cada pestaña, con su sección y el período que se ve (`hrefPdfTablero` suma `seccion`).
5. Usable en tablet; en pantallas chicas, las tablas se desplazan dentro de su contenedor.

**Criterios de aceptación**

- Cambiar de pestaña conserva el período; la tabla de profesores se ordena y se filtra; cada PDF corresponde a su pestaña.

---

## T-114 · [QA] Verificación integrada por rol y guion de la review

- **HU:** Todas las del sprint
- **Área:** QA (todo el equipo; coordina el SM)
- **Rama:** — (no lleva código: lo que se encuentre se corrige con tareas FIX, de T-115 en adelante)
- **Depende de:** lo mergeado a `testing` al día 5
- **Estimación:** 2

**Alcance**

1. `testing` actualizado, migración y seed desde una base vacía, para confirmar que el seed alcanza para la demo.
2. Recorridos por rol, contra los criterios de aceptación de cada HU:
   - **Profesor:** asistencia de hoy desde la pantalla "Asistencia" (horas seguidas con "Aplicar también a…"); registrar desde el detalle de una hora y su hora seguida; el detalle de cada hora con sus horas seguidas y los textos una vez; corregir sólo una hora con otros textos (el detalle y el historial muestran los del grupo y, aparte, los de esa hora); corrección al día siguiente; un día vencido; historial de un alumno y nota de un examen.
   - **Mesa de entrada:** alta de un alumno con foto y acceso; cobro de dos materias con el filtro de varias materias y "Seleccionar todo", por transferencia con comprobante; detalle del pago y reemplazo del adjunto; quitar el adjunto de un pago con débito; anulación y nuevo cobro; historial y su PDF; bloqueo por deuda al registrar un turno.
   - **Gerente:** tablero por secciones y sus PDF; pagos realizados en sólo lectura.
   - **Alumno, desde un celular real:** ingreso con usuario y DNI, aviso y cambio de contraseña, "Mi calendario", el detalle de un turno con horas seguidas, "Sacar turno" (una clase y semanal), "Mis materias" (con un bloque de horas seguidas), "Mis pagos" y su comprobante.
3. **Permisos:** cada rol en el segmento de otro ve "No tiene permiso para acceder a esta sección"; el alumno que pide por la API un turno, un pago o un PDF de otro alumno recibe 403.
4. **Regresión del Sprint 2:** registrar, cancelar, reprogramar y finalizar turnos; cobrar en efectivo; PDF del turno, de la agenda y del comprobante; tablero.
5. Guion de la review (qué se muestra, en qué orden y con qué datos del seed) y la lista de lo que queda pendiente, para informar a las PO.

**Criterios de aceptación**

- Cada HU del sprint tiene su recorrido verificado o un FIX abierto con lo que falla.
- El guion de la review está escrito y probado con el seed.

---

## T-115 · [Back] FIX · Refactor · Horario `HH:mm` de una ocurrencia centralizado en `shared/zod.ts`

- **HU:** ninguna (refactor técnico, sin cambio de comportamiento)
- **Área:** Backend
- **Rama:** `fix/horario-hhmm-shared`
- **Depende de:** nada. Conviene tomarla cuando no haya PR abiertos sobre los archivos de la lista (ver "Coordinación").
- **Estimación:** 2

**Descripción**
Pasar la hora de inicio y de fin de minutos desde medianoche a `HH:mm` (`horaInicio: minutosAHora(x.horaInicio), horaFin: minutosAHora(x.horaFin)`) se repite **26 veces en 13 archivos de 9 features**. No tiene significado de negocio (es formato, como `minutosAHora`), así que va en `shared/` y se escribe una sola vez (`convenciones-backend.md` → `src/server/shared/`: se extrae a la tercera repetición). Lo detectó la revisión de cierre de T-83, que sólo lo ordenó dentro de `finalizaciones.reglas.ts` (helper local `fechaYHorario`) porque el resto no era de esa tarea.

**Alcance**

1. `src/server/shared/zod.ts`: `horarioHHmm({ horaInicio, horaFin })` → `{ horaInicio: 'HH:mm', horaFin: 'HH:mm' }`, al lado de `minutosAHora` y con su test en `shared/__tests__/zod.test.ts` (horas límite 00:00 y 23:59, y que lance `RangeError` como `minutosAHora` ante un valor inválido).
2. Reemplazar el armado a mano por `...horarioHHmm(x)` en (cantidad de repeticiones entre paréntesis):
   - `bloques/bloques.repository.ts` (6) y `bloques/bloques.service.ts` (2)
   - `turnos/turnos.reglas.ts` (3), `turnos/turnos.condiciones.ts` (2), `turnos/turnos.service.ts` (1) y `turnos/turnos.repository.ts` (1)
   - `asistencias/asistencias.service.ts` (3)
   - `ocurrencias/ocurrencias.service.ts` (2)
   - `agendas/agendas.service.ts` (2)
   - `reprogramaciones/reprogramaciones.reglas.ts` (1)
   - `pagos/pagos.repository.ts` (1)
   - `cuentas/cuentas.service.ts` (1)
   - `finalizaciones/finalizaciones.reglas.ts` (1): `fechaYHorario` pasa a ser `{ fecha, ...horarioHHmm(o) }`.
3. Sin cambios en las respuestas de la API: los tests existentes de cada feature (que comparan los DTO completos) tienen que pasar sin tocarlos. Si alguno hay que cambiarlo, es que cambió el comportamiento y no corresponde a esta tarea.
4. Documentación: `convenciones-backend.md` → Especificación de `src/server/shared/`, fila de `zod.ts` (suma `horarioHHmm`).

**Coordinación**

Toca archivos de otras tareas (el motor de T-74, `asistencias` de T-81, `pagos` de T-96, `cuentas` de T-76/T-101, `agendas` de T-86, `ocurrencias` de T-84): avisar en el issue de cada una antes de empezar y, si alguna tiene un PR abierto sobre esos archivos, esperar a que se mergee para no generar conflictos. El cambio es mecánico, así que conviene hacerlo en un PR chico y revisarlo en el día.

**Criterios de aceptación**

- `horaInicio: minutosAHora(` no aparece en ningún archivo de `src/server/features/` fuera de los tests.
- `pnpm check` pasa sin modificar ningún test existente de las features.

---

## T-116 · [Back] FIX · Refactor · `respuestaError` del OpenAPI centralizado en `server/errors`

- **HU:** ninguna (refactor técnico, sin cambio de comportamiento)
- **Área:** Backend
- **Rama:** `fix/respuesta-error-openapi`
- **Depende de:** nada. Conviene tomarla cuando no haya PR abiertos sobre los archivos de la lista (ver "Coordinación").
- **Estimación:** 2

**Descripción**
Cada `<feature>.routes.ts` declara su propio `respuestaError(description, example?)`, el helper que arma una respuesta de error del OpenAPI con `ErrorResponseSchema`. Está copiado en **18 archivos**, con 4 variantes que dicen lo mismo de distinta forma: sin ejemplo, con un ejemplo opcional (la mayoría), con el ejemplo obligatorio y con varios ejemplos con nombre. Va una sola vez al lado de `ErrorResponseSchema`. Lo detectó la revisión de cierre de T-95.

**Alcance**

1. `src/server/errors/error-response.ts`: `respuestaError(description, { example?, examples? })`, exportado desde `@/server/errors`. `example` es un ejemplo; `examples`, varios con nombre (`{ nombre: valor }` → `{ nombre: { value } }`, como hoy en finalizaciones). Sin ninguno de los dos, sólo el schema. Test en `src/server/errors/__tests__/` con los tres casos.
2. Reemplazar la copia local por el helper en los `routes.ts` de: `adjuntos`, `agendas`, `alumnos`, `asistencias`, `aulas`, `bloques`, `cancelaciones`, `centro`, `cuentas`, `examenes`, `finalizaciones`, `materias`, `ocurrencias`, `pagos`, `profesores`, `reprogramaciones`, `tablero` y `turnos`.
   - Las 12 con `respuestaError(description, example?)` pasan a `respuestaError(description, { example })`.
   - `finalizaciones` (varios ejemplos) pasa a `{ examples }`; `tablero` (ejemplo obligatorio), a `{ example }`.
3. Sin cambios en el OpenAPI: `GET /api/v1/openapi.json` tiene que quedar igual (compararlo antes y después) y los tests de rutas que revisan los status codes pasan sin tocarlos.
4. Documentación: `arquitectura-backend.md` → Errores (el helper, junto a `ErrorResponseSchema`) y `.claude/commands/nueva-feature-api.md`, si el esqueleto lo menciona.

**Coordinación**

Toca el `routes.ts` de 18 features que tienen dueña en este sprint: avisar en sus issues antes de empezar y, si alguna tiene un PR abierto sobre su `routes.ts`, esperar a que se mergee. El cambio es mecánico: un PR chico y revisado en el día.

**Criterios de aceptación**

- `function respuestaError` no aparece en ningún archivo de `src/server/features/`.
- `openapi.json` no cambia y `pnpm check` pasa sin modificar ningún test existente.

---

## T-117 · [Back] FIX · Refactor · Id entero positivo (path y query) centralizado en `shared/zod.ts`

- **HU:** ninguna (refactor técnico, sin cambio de comportamiento)
- **Área:** Backend
- **Rama:** `fix/id-positivo-shared`
- **Depende de:** nada. Conviene tomarla junto con T-116 o después, por los mismos archivos de rutas y validation (ver "Coordinación").
- **Estimación:** 2

**Descripción**
Un id que llega como texto (en el path o en el query) se valida igual en todas las features: `z.coerce.number({ error: 'Debe ser un número' }).int({ error: 'Debe ser un número entero' }).positive({ error: 'Debe ser mayor a 0' })`, más su `.openapi({ param, description, example })`. Está repetido **35 veces en 16 archivos** `*.validation.ts`. Es formato, no negocio: va en `shared/zod.ts`, con las otras primitivas (`dni`, `fechaISO`), y se escribe una sola vez. Lo detectó la revisión de cierre de T-95: `adjuntos` tuvo que escribir su propio `pagoId` porque no puede importar el de `pagos` (ESLint) y además el parámetro se llama distinto.

**Alcance**

1. `src/server/shared/zod.ts`: `idPositivo()` con los tres mensajes de hoy, al que cada feature le agrega su `.openapi({ param: { name, in }, description, example })` (o un helper `idDelPath(nombre, descripcion)` si hace falta, sin repetir los mensajes). Test en `shared/__tests__/zod.test.ts`: `"abc"`, `"0"`, `"-1"` y `"1.5"` → los mensajes de hoy; `"12"` → `12`. Si se suma una función nueva, actualizar la especificación de `shared/` en `convenciones-backend.md`.
2. Reemplazar las 35 repeticiones en: `adjuntos`, `agendas`, `alumnos`, `asistencias`, `aulas`, `bloques`, `cancelaciones`, `cuentas`, `examenes`, `finalizaciones`, `materias`, `ocurrencias`, `pagos`, `profesores`, `reprogramaciones` y `turnos` (`*.validation.ts`). Incluye los ids de los filtros del query (`materiaId`, `profesorId`, `aulaId`…), no sólo los del path.
3. Sin cambios en el comportamiento: los mensajes de error, el 400 y el OpenAPI quedan iguales (`openapi.json` comparado antes y después) y los tests de rutas que prueban ids inválidos pasan sin tocarlos.
4. Documentación: `convenciones-backend.md` → Especificación de `src/server/shared/`, fila de `zod.ts`.

**Coordinación**

Toca la validation de 16 features que tienen dueña en este sprint: avisar en sus issues y esperar los PR abiertos sobre esos archivos. Hacerla junto con T-116 (o una detrás de la otra) evita tocar dos veces las mismas features.

**Criterios de aceptación**

- `.number({ error: 'Debe ser un número' })` no aparece en ningún `*.validation.ts` de `src/server/features/`.
- `openapi.json` no cambia y `pnpm check` pasa sin modificar ningún test existente.

---

## Ampliación del 15/10: HU-43 a HU-47 (reparto, liquidaciones, caja y finanzas)

Pedido de los clientes durante el sprint (decisiones de PO del 15/10, `backlog-sprint3.md`): el profesor cobra un **porcentaje** de lo que pagan sus alumnos, el gerente le liquida **por mes** y ve la **caja diaria** y el **margen del centro**. Son **19 tareas, de T-118 a T-136**, con las mismas reglas del resto del sprint (tareas aisladas, reuso primero, Definición de Hecho). La base de datos se resetea con la migración de T-118: no hay datos anteriores que completar.

### Lectura de la ampliación

- **Todo sale de lo que ya se registra.** Nadie carga un importe a mano: el reparto sale del porcentaje que guarda cada cobro (HU-43), lo que se le debe al profesor sale de los pagos y las asistencias (HU-44), y la caja y el tablero leen lo mismo. Lo único nuevo que se escribe es el porcentaje del centro y el pago de una liquidación.
- **Una sola regla, un solo lugar.** El reparto de un turno (`repartoDeTurno`, T-120) y qué se le debe a un profesor y en qué mes (el motor de liquidaciones, T-121) se calculan una vez y lo leen liquidaciones, "Mis ingresos", la caja y el tablero. Es lo que garantiza el criterio de HU-45: "lo que ve el profesor coincide con lo que ve el gerente". T-136 lo verifica cruzando los números.
- **Cadena crítica:** T-118 → T-121 (el motor), del que cuelgan HU-44, HU-45 y HU-47. Se toma el día 1 y las tareas que lo consumen arrancan contra las firmas de su alcance, con el motor mockeado.
- **Dependencias con tareas del sprint que todavía no se mergearon:** T-122 espera a T-98 (dueña de `pagos/**`), T-128 a T-112 y T-135 a T-113 (dueñas de `tablero/**`), y el reparto en el detalle del pago (T-130) a T-99. El resto no depende de nada pendiente.

### Vocabulario de la ampliación

- **Porcentaje del centro:** lo que el centro retiene de cada turno cobrado. Uno solo para todo el centro; el vigente es el último registrado en `PorcentajeCentro` (historial: cada cambio es una fila, nada se pisa). Valor inicial: 15 %.
- **Reparto de un turno cobrado:** cada `PagoTurno` guarda el `porcentajeCentro` vigente al registrarse el pago. **Parte del centro** = importe × porcentaje, redondeada a centavos (mitad hacia arriba, **en centavos enteros**, nunca con `number` flotante: `convenciones-backend.md` → Importes). **Parte del profesor** = importe − parte del centro. Las partes no se guardan: las calcula `repartoDeTurno` y dan siempre lo mismo.
- **Turno que se le debe al profesor (devengado):** un `PagoTurno` **vigente** de una ocurrencia que tiene asistencia `PRESENTE` o `AUSENTE`. Le corresponde la parte del profesor de ese cobro.
  - **Fecha de devengo:** la más tardía entre el **registro** del pago (`Pago.createdAt`) y el **registro** de la asistencia (`AsistenciaTurno.createdAt`), llevada a la fecha de Salta. Se usa el registro y no `Pago.fechaPago` porque la fecha de pago se puede cargar hacia atrás: así un turno nunca cae en un mes que ya se liquidó. Corregir la asistencia (de "Presente" a "Ausente") no cambia la fecha.
  - **Profesor:** el del bloque del turno al leerlo. Como un turno con asistencia ya no se reprograma (T-83), el profesor no cambia después del devengo; si se reprogramó antes con otro profesor, le corresponde al nuevo (HU-43).
  - **Cerrado sin registrar:** un turno cobrado cuyo plazo de asistencia venció sin registro (`SIN_REGISTRAR` vencido, T-74) **no se devenga**: el importe completo queda para el centro. No genera ninguna fila: se calcula al leer.
- **Liquidación de un profesor en un mes:**
  - **Turnos:** los devengados con fecha de devengo dentro del mes que no están en una liquidación cerrada.
  - **Ajuste por anulación:** un turno de una liquidación **cerrada** cuyo pago se anuló después (su `PagoTurno` ya no está vigente) descuenta su parte del profesor, **la que quedó guardada en la liquidación**. Va a la **primera liquidación sin cerrar del profesor posterior a la que incluyó el turno** (decisión de PO del 15/10); si no hay ninguna con movimientos, a la del mes en curso. Se agrupa por comprobante: "Ajuste por anulación del comprobante N.º 123 (2 turnos)".
  - **Saldo anterior:** si la liquidación de un mes terminado da 0 o menos, no se paga ("Saldo a descontar el mes próximo") y entra entera, como un ajuste, en la del mes siguiente: "Saldo de la liquidación de octubre de 2026". Puede encadenarse.
  - **Total a pagar** = parte del profesor de los turnos + ajustes.
  - **Estados:** `EN_CURSO` (el mes actual; se ve, no se paga), `PENDIENTE_DE_PAGO` (mes terminado, total mayor a 0), `SALDO_A_DESCONTAR` (mes terminado, total de 0 o menos), `PAGADA` y `DESCONTADA` (cerrada sin pago porque su saldo se descontó en la de otro mes). La UI: "En curso", "Pendiente de pago", "Saldo a descontar el mes próximo", "Pagada el 05/11" y "Descontada en la liquidación de noviembre".
- **Liquidación abierta / cerrada:** mientras no se paga, una liquidación **no existe en la base**: se calcula al consultarla (si se anula un pago, su turno deja de figurar). Al registrar el pago se **cierra**: se guarda con sus turnos, ajustes e importes congelados (`Liquidacion`, `LiquidacionTurno`, `AjusteLiquidacion`), y en la misma transacción se cierran como `DESCONTADA` las de saldo negativo que absorbió.
- **Mes:** `YYYY-MM` en la API (`mesISO`, T-119). "Último mes terminado" es el anterior al de `hoy()`.
- **Movimiento de caja:** cobro (+, en su **fecha de pago**, con su hora de registro), anulación (−, en la **fecha en que se anuló**) y pago a un profesor (−, en la **fecha de la transferencia**). La caja no se guarda: se arma al consultar.

### Orden y dependencias

```
Día 1 (en paralelo):
  T-118 Modelo de datos + migración + seed ──┬──> T-120 Porcentaje del centro y repartoDeTurno (+ T-119) ──┬──> T-122 Cobros con porcentaje (+ T-98)
                                             │                                                           ├──> T-127 Caja diaria API ──> T-134 Caja diaria UI (+ T-129)
                                             │                                                           └──> T-130 Porcentaje UI (+ T-129; reparto del detalle: + T-122, T-99)
                                             ├──> T-121 Motor de liquidaciones (+ T-119, firma de T-120)   [cadena crítica]
                                             └──> T-123 Adjunto de la transferencia
  T-119 Andamiaje back (routers vacíos, mesISO, fechaEnZona, secciones de docs)
  T-129 Andamiaje front (menús, páginas, placeholders)

Con T-121 mergeada:  T-124 Liquidaciones API (+ T-123) ──┬──> T-125 PDF de la liquidación (la plantilla puede empezar antes)
                                                          ├──> T-126 Mis ingresos API ──> T-133 Mis ingresos UI (+ T-131)
                                                          └──> T-131 Liquidaciones UI (+ T-129) ──> T-132 Registrar pago UI (+ T-78)
                     T-128 Tablero "Finanzas" (+ T-112) ──> T-135 Pestaña "Finanzas" UI (+ T-113)
Al final:            T-136 Verificación integrada del reparto (antes o junto con T-114)
```

- **T-118 y T-119 se mergean el día 1; T-120 y T-121, lo antes posible** (T-121 es la más grande de la ampliación: conviene que la tome alguien que conozca el motor de ocurrencias de T-74).
- Las pantallas arrancan en paralelo con su API, contra el contrato escrito en cada tarea, como en el resto del sprint.
- **Estimación de la ampliación:** 67 puntos (back 41, front 24, QA 2). El equipo reparte los carriles.

### Mapa de archivos de la ampliación

| Zona                                                                                                                                                                                                                                             | Tarea dueña                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed*.ts`                                                                                                                                                                                  | T-118                                             |
| `src/server/app.ts`, routers vacíos de `reparto`, `liquidaciones` y `caja`; `mesISO` en `shared/zod.ts` y `fechaEnZona` en `shared/fechas.ts` (+ tests)                                                                                          | T-119                                             |
| `src/server/features/reparto/**`                                                                                                                                                                                                                 | T-120                                             |
| `src/server/features/liquidaciones/liquidaciones.reglas.ts`, `liquidaciones.condiciones.ts` (+ tests)                                                                                                                                            | T-121                                             |
| `src/server/features/liquidaciones/**` (salvo reglas, condiciones y PDF)                                                                                                                                                                         | T-124; después, T-126                             |
| `liquidaciones.pdf.tsx`, `liquidaciones.documentos.ts`, `liquidaciones.formato.ts` y su ruta                                                                                                                                                     | T-125                                             |
| `src/server/features/pagos/**`                                                                                                                                                                                                                   | T-122 (después de T-98)                           |
| `src/server/features/adjuntos/**`                                                                                                                                                                                                                | T-123                                             |
| `src/server/features/caja/**`                                                                                                                                                                                                                    | T-127                                             |
| `src/server/features/tablero/**`                                                                                                                                                                                                                 | T-128 (después de T-112)                          |
| `gerente-sidebar.tsx`, `profesor-sidebar.tsx`, `app/gerente/configuracion/**`, `app/gerente/liquidaciones/**`, `app/gerente/caja/**`, `app/profesor/ingresos/**`, placeholders de `features/reparto`, `features/liquidaciones` y `features/caja` | T-129 (después, cada placeholder pasa a su tarea) |
| `src/features/reparto/**`                                                                                                                                                                                                                        | T-130                                             |
| `src/features/liquidaciones/**` (salvo `RegistrarPagoLiquidacion*` y `MisIngresos*`)                                                                                                                                                             | T-131                                             |
| `features/liquidaciones`: `RegistrarPagoLiquidacionDialog`, su schema, su api y su hook                                                                                                                                                          | T-132                                             |
| `features/liquidaciones`: `MisIngresos*`, `api/mis-ingresos.api.ts` y sus hooks                                                                                                                                                                  | T-133                                             |
| `src/features/caja/**`                                                                                                                                                                                                                           | T-134                                             |
| `src/features/tablero/**`, `app/gerente/tablero/**`                                                                                                                                                                                              | T-135 (después de T-113)                          |

---

## T-118 · [Back] Modelo de datos del reparto y las liquidaciones: esquema, migración y seed

- **HU:** Transversal (habilita HU-43, HU-44, HU-45, HU-46 y HU-47)
- **Área:** Backend
- **Rama:** `feat/modelo-datos-liquidaciones`
- **Estimación:** 5
- **Prioridad:** Bloqueante de la ampliación, se mergea el día 1

**Descripción**
Todo lo que la ampliación guarda, en **una sola migración generada por Prisma** (decisión T-50), para que ninguna otra tarea toque el modelo. Como la base se resetea, las columnas nuevas pueden ser obligatorias.

**Alcance**

1. **Porcentaje del centro (HU-43):** modelo `PorcentajeCentro` con `porcentaje` (`Decimal(5,2)`), `createdById` y `createdAt` (desde cuándo rige y quién lo cambió). Sin `updated*` ni estado: un cambio es una fila nueva y el vigente es el último (`createdAt`, `id` como desempate). Índice por `createdAt`. Que sea >= 0 y < 100 lo valida la API (el CHECK queda pendiente, como en la decisión T-50).
2. **Snapshot en cada cobro (HU-43):** `PagoTurno.porcentajeCentro` (`Decimal(5,2)`, obligatorio), al lado de `importeAplicado`. Las partes **no** se guardan (ver Vocabulario de la ampliación).
3. **Liquidación cerrada (HU-44):** modelo `Liquidacion`:
   - `profesorId`, `mes` (`@db.Date`, el día 1 del mes) y `estado` (enum `EstadoLiquidacion`: `PAGADA`, `DESCONTADA`). `@@unique([profesorId, mes])`: un mes se cierra una sola vez.
   - Importes congelados (`Decimal(10,2)`): `totalCobrado`, `parteCentro`, `parteProfesor`, `totalAjustes` y `total`.
   - Datos de la transferencia, opcionales en la base (los exige la API sólo en `PAGADA`): `fechaTransferencia` (`@db.Date`), `numeroOperacion` (`VarChar(50)`) y `observaciones` (`VarChar(500)`).
   - `descontadaEnId` (FK a `Liquidacion`, opcional): en una `DESCONTADA`, la liquidación que absorbió su saldo.
   - `createdById` y `createdAt` (quién registró el pago y cuándo). Índices por `fechaTransferencia` (caja y tablero) y por `profesorId`.
4. **`LiquidacionTurno`:** `liquidacionId`, `pagoTurnoId` (**único**: un cobro de un turno se liquida una sola vez; es la red contra la liquidación doble), y congelados `fechaDevengo` (`@db.Date`), `importe`, `porcentajeCentro` y `parteProfesor`.
5. **`AjusteLiquidacion`:** `liquidacionId` (donde se aplicó), `tipo` (enum `TipoAjusteLiquidacion`: `ANULACION`, `SALDO_ANTERIOR`), `importe` (`Decimal(10,2)`, negativo o 0) y una de dos referencias, las dos **únicas** (la API valida que haya exactamente una): `liquidacionTurnoId` (el turno liquidado cuyo pago se anuló: se descuenta una sola vez) o `liquidacionOrigenId` (la liquidación de saldo negativo que se absorbió).
6. **Comprobante de la transferencia (HU-44):** `ComprobanteAdjunto.liquidacionId` (`Int?`, FK a `Liquidacion`, índice). Un adjunto es de un pago **o** de una liquidación (lo valida la API, T-123). Reusa la tabla, el almacenamiento y las reglas de HU-24.
7. Relaciones inversas de auditoría en `Usuario`. Comentarios del schema: el porcentaje como historial, el snapshot del cobro y por qué no se guardan las partes, que una liquidación abierta no tiene fila, la unicidad de `pagoTurnoId` y las dos referencias únicas del ajuste.
8. **Seeds** (idempotentes). Todo pago que crean los seeds guarda su `porcentajeCentro`. Para la demo (con fechas relativas a hoy, como el resto del seed de demo):
   - `PorcentajeCentro`: 12 % hace dos meses y 15 % desde el mes pasado, para que se vea el historial y cobros con porcentajes distintos.
   - Para dos profesores: una liquidación del antepenúltimo mes `PAGADA` (con un comprobante adjunto de ejemplo, clave de prueba), la del mes pasado sin cerrar (queda "Pendiente de pago") y movimientos en el mes en curso.
   - Un pago **anulado** que incluye un turno de la liquidación pagada (genera el ajuste) y un profesor cuyo ajuste deja una liquidación en "Saldo a descontar".
   - Clases dadas sin cobrar, turnos cobrados sin asistencia dentro del plazo y uno cobrado y cerrado sin registrar (para "Mis ingresos" y el margen del centro).
   - Cobros, una anulación y un pago a un profesor **en el día de hoy**, para la caja diaria.
9. Documentación: `dominio.md` → Reparto y liquidaciones (modelo); `decisiones.md` (próximo ID libre, T-151 en adelante): el snapshot del porcentaje sin partes guardadas, la liquidación abierta calculada y la cerrada congelada, la unicidad de `pagoTurnoId` y el adjunto compartido entre pago y liquidación.
10. La migración la genera y la aplica la persona con `pnpm db:migrate` sobre una base reseteada (`AGENTS.md`, regla 10), sin editar el SQL.

**Criterios de aceptación**

- Con la base vacía, migración y seed dejan las tablas nuevas y los datos de demo.
- Un segundo `LiquidacionTurno` con el mismo `pagoTurnoId` falla en la base; un segundo `Liquidacion` para el mismo profesor y mes, también.
- El seed sigue siendo idempotente. `pnpm db:generate` y `pnpm check` pasan.

---

## T-119 · [Back] Andamiaje de la ampliación: features nuevas, primitivas de mes y de fecha local, secciones de docs

- **HU:** Transversal
- **Área:** Backend
- **Rama:** `feat/andamiaje-liquidaciones-api`
- **Estimación:** 2
- **Prioridad:** Bloqueante, se mergea el día 1 (es chica)

**Alcance**

1. `reparto.routes.ts`, `liquidaciones.routes.ts` y `caja.routes.ts` con `createRouter()` sin endpoints, registrados en `app.ts` (una línea cada uno).
2. `shared/zod.ts`: `mesISO` (`YYYY-MM`, con mes de 01 a 12; mensaje "El mes debe tener el formato AAAA-MM") y sus helpers `primerDiaDelMes(mes)`, `ultimoDiaDelMes(mes)`, `mesDe(fecha)` y `mesAnterior(mes)`. Test con febrero bisiesto y el cambio de año.
3. `shared/fechas.ts`: `fechaEnZona(instante: Date)` → la fecha `YYYY-MM-DD` de ese instante en `America/Argentina/Salta` (un pago registrado el 31/10 a las 22:00 de Salta es del 31/10, aunque en UTC sea 1/11). Test con ese caso.
4. Verificar que `liquidaciones.condiciones.ts` y `reparto.condiciones.ts` quedan cubiertos por las reglas de ESLint de condiciones.
5. Documentación, para que cada tarea escriba sólo en lo suyo: `contrato-api.md` (secciones vacías Reparto, Liquidaciones y Caja, "A completar por T-xx", y la fila de "Mis ingresos" en una sección de endpoints `mis-…` del profesor, si no existe); `dominio.md` (secciones Reparto, Liquidaciones y Caja diaria); `arquitectura-backend.md` (una línea por feature nueva); `convenciones-backend.md` → `shared/` (`mesISO`, `fechaEnZona`); `AGENTS.md` → Alcance del Sprint 3 (HU-43 a HU-47).

**Coordinación**
T-115 y T-117 (pendientes) también suman funciones a `shared/zod.ts`: si chocan, es un conflicto de líneas que se resuelve en el merge.

**Criterios de aceptación**

- `pnpm check` pasa y `/api/v1/docs` sigue funcionando.
- Ninguna otra tarea de la ampliación necesita modificar `app.ts` ni `eslint.config.mjs`.

---

## T-120 · [Back] HU-43 · Porcentaje del centro y regla del reparto (feature `reparto`)

- **HU:** HU-43 Porcentaje del centro sobre cada cobro
- **Área:** Backend
- **Rama:** `feat/reparto-api`
- **Depende de:** T-118, T-119
- **Estimación:** 3
- **Prioridad:** Alta (la regla del reparto la usan T-121, T-122, T-127 y T-128)

**Alcance**

1. **Regla pura** en `reparto.reglas.ts` (con tests): `repartoDeTurno(importe, porcentaje)` → `{ importe, porcentaje, parteCentro, parteProfesor }`, en centavos enteros, con redondeo mitad hacia arriba. Tests: el ejemplo de la HU ($ 8.000 al 15 % → $ 1.200 y $ 6.800), 0 %, 99,99 %, un importe con centavos que redondea (por ejemplo $ 3.333,33 al 15 %) y que las dos partes **siempre suman el importe**. `sumarReparto(repartos)` para totales.
2. **`reparto.condiciones.ts`** publica, para las otras features: `repartoDeTurno`, `sumarReparto` y `porcentajeVigente(client)` (el último `PorcentajeCentro`; si no hay ninguno es un error de configuración: 500 con log, no un 15 % inventado).
3. **`GET /reparto/porcentaje`** (`GERENTE`): `{ vigente: { porcentaje, desde, cambiadoPor }, historial }`, el historial del más reciente al más antiguo, paginado (page/pageSize).
4. **`PUT /reparto/porcentaje`** (`GERENTE`), `{ porcentaje }`:
   - Número >= 0 y < 100 con hasta dos decimales; si no, 400 en `porcentaje` ("El porcentaje debe ser mayor o igual a 0 y menor que 100, con hasta dos decimales").
   - Igual al vigente → 400 "El porcentaje ya es 15 %" (no genera una fila sin cambio).
   - Crea una fila nueva de `PorcentajeCentro`; no modifica nada más. Responde el nuevo vigente.
   - La confirmación ("Desde ahora, el centro retendrá…") la muestra la UI; la API no la necesita.
5. Permisos: los demás roles reciben 403 en los dos endpoints (HU-43: "el sistema rechaza el cambio aunque se intente por fuera de las pantallas"). Tests de cada rol.
6. Documentación: `contrato-api.md` → Reparto; `dominio.md` → Reparto (la fórmula y el redondeo); `decisiones.md` (el redondeo y el error sin porcentaje configurado).

**Criterios de aceptación**

- El gerente cambia el porcentaje de 15 a 18 y el historial muestra los dos, con quién y desde cuándo.
- Mesa de entrada, profesor y alumno reciben 403 al leerlo y al cambiarlo.
- La parte del centro y la del profesor suman siempre el importe del turno.

---

## T-121 · [Back] Reuso: motor de liquidaciones — devengo, ajustes por anulación y saldo a descontar

- **HU:** HU-44 (la usan HU-45, HU-46 y HU-47)
- **Área:** Backend
- **Rama:** `feat/liquidaciones-motor`
- **Depende de:** T-118, T-119, T-120 (`repartoDeTurno`; puede empezar contra su firma)
- **Estimación:** 8
- **Prioridad:** Bloqueante (cadena crítica de la ampliación)

**Descripción**
Liquidaciones, "Mis ingresos" y el tablero tienen que decir exactamente lo mismo: qué turnos se le deben a cada profesor, desde cuándo, en qué liquidación entran y qué ajustes arrastran. Como el motor de ocurrencias (T-30, T-74), se calcula **una sola vez** acá y las features lo leen de `liquidaciones.condiciones.ts`. Es la regla más delicada de la ampliación: los tests son la mitad de la tarea.

**Alcance**

1. **Reglas puras** en `liquidaciones.reglas.ts` (sin Prisma, con tests):
   - `fechaDevengo({ pagoRegistradoEl, asistenciaRegistradaEl })`: la más tardía de las dos, como fecha de Salta (`fechaEnZona`).
   - `estaDevengado({ pagoVigente, asistencia })`: pago vigente y asistencia `PRESENTE` o `AUSENTE`.
   - `armarLiquidaciones({ devengados, liquidacionesCerradas, anulacionesPendientes, hoy })` → por profesor y mes: turnos, ajustes, totales (`totalCobrado`, `parteCentro`, `parteProfesor`, `totalAjustes`, `total`) y estado, con las reglas del Vocabulario de la ampliación:
     - cada devengado no cerrado va al mes de su fecha de devengo;
     - cada ajuste por anulación va a la primera liquidación sin cerrar del profesor posterior a la que incluyó el turno (o al mes en curso si no hay otra);
     - una liquidación de un mes terminado con total de 0 o menos queda `SALDO_A_DESCONTAR` y entra como ajuste `SALDO_ANTERIOR` en la del mes siguiente, en cadena;
     - el mes en curso es `EN_CURSO` aunque su total sea negativo; un mes terminado con total > 0 es `PENDIENTE_DE_PAGO`.
   - `ESTADOS_LIQUIDACION` y los textos de los ajustes ("Ajuste por anulación del comprobante N.º 123 (2 turnos)", "Saldo de la liquidación de octubre de 2026").
2. **`liquidaciones.condiciones.ts`**, con el cliente que le pasa el repository, sin N+1 (una consulta por tipo de dato, como `leerOcurrencias`):
   - `leerDevengados(client, { profesorId?, hasta })`: los `PagoTurno` vigentes con asistencia `PRESENTE` o `AUSENTE` que no están en un `LiquidacionTurno`, con turno, fecha y horario de la ocurrencia, alumno, materia, profesor (del bloque), número de comprobante, importe, porcentaje y fecha de devengo.
   - `leerAnulacionesPendientes(client, { profesorId? })`: los `LiquidacionTurno` cuyo `PagoTurno` ya no está vigente y que no tienen un `AjusteLiquidacion`, con su liquidación de origen, el comprobante y la parte del profesor congelada.
   - `leerLiquidacionesCerradas(client, { profesorId?, desde?, hasta? })`.
   - `liquidacionesDelMes(client, { mes, profesorId?, hoy })` y `liquidacionDe(client, { profesorId, mes, hoy })`: abiertas (calculadas) y cerradas (leídas, con sus importes congelados), con el mismo formato de salida. Una cerrada **no se recalcula**.
   - `saldoAPagarPorProfesor(client, { hoy })`: lo que se le debe hoy a cada profesor (todas sus liquidaciones sin cerrar, incluida la del mes en curso), para el tablero (T-128).
   - `cobrosConReparto(client, { desde, hasta, hoy })`: los `PagoTurno` vigentes con fecha de pago en el rango, con su reparto, el profesor y si la ocurrencia quedó **cerrada sin registrar** (con `plazoDeAsistencia` de `turnos.condiciones`, nunca recalculado): para el margen del centro (T-128).
   - `cierreDeLiquidacion(client, { profesorId, mes, hoy })`: lo que hay que escribir para cerrar una liquidación (la `Liquidacion`, sus `LiquidacionTurno`, sus `AjusteLiquidacion` y las `DESCONTADA` que absorbe). La escritura la hace el repository de T-124 en su transacción; el cálculo es uno solo.
3. Tests (reglas puras y motor a nivel repository, con reloj fijo), como mínimo:
   - Clase dada en octubre y pagada en noviembre → noviembre. Pagada por adelantado en octubre y dada en noviembre → noviembre. "Ausente" pagado → se debe.
   - Pago registrado el 3/11 con fecha de pago 28/10 y asistencia de octubre → noviembre (cuenta el registro).
   - Asistencia registrada el 31/10 a las 22:00 de Salta → octubre.
   - Cobrado y cerrado sin registrar → no se debe. Cancelado → no se cobra ni se debe. Cobrado sin asistencia dentro del plazo → no se debe todavía.
   - Pago anulado de un turno de una liquidación abierta → el turno deja de figurar. De una liquidación cerrada → ajuste en la primera sin cerrar posterior; con un mes intermedio pendiente, va a ese mes; sin ninguna, al mes en curso.
   - Saldo negativo en octubre → "Saldo a descontar" y ajuste en noviembre; dos meses negativos seguidos se encadenan.
   - Una cerrada no cambia aunque después se anule un pago de sus turnos (sólo genera el ajuste).
   - Reparto con dos porcentajes distintos en la misma liquidación.
   - Turno reprogramado a otro profesor antes de la asistencia → se le debe al nuevo.
4. Documentación: `convenciones-backend.md` → Liquidaciones (qué publica el motor y que nadie recalcula); `dominio.md` → Liquidaciones (devengo, ajustes, saldo y estados); `decisiones.md`: fecha de devengo por registro, ajuste a la primera liquidación sin cerrar, saldo de 0 o menos que se arrastra y el estado `DESCONTADA`.

**Fuera de alcance**
Endpoints (T-124, T-126, T-128) y la escritura del cierre (T-124).

**Criterios de aceptación**

- Cada caso de la lista de tests tiene su test y pasa.
- Ninguna otra feature calcula devengo, ajustes o saldos: todas leen de `liquidaciones.condiciones.ts`.

---

## T-122 · [Back] HU-43 · Cobros con porcentaje y reparto en el detalle del pago

- **HU:** HU-43 (al registrar el pago y en el detalle de HU-36)
- **Área:** Backend
- **Rama:** `feat/pagos-reparto-api`
- **Depende de:** T-98 (dueña de `pagos/**` hasta mergearse), T-118, T-120
- **Estimación:** 2

**Alcance**

1. **`POST /pagos`:** cada `PagoTurno` guarda `porcentajeCentro = porcentajeVigente(client)`, leído **dentro de la misma transacción** del pago (si el gerente cambia el porcentaje en ese momento, todo el pago queda con un mismo valor). Vale para los cobros de HU-15, HU-23 y HU-25 (es el mismo endpoint). Un turno que se vuelve a cobrar después de una anulación toma el porcentaje vigente en ese momento, sin código extra.
2. **`GET /pagos/{id}`:** para el **`GERENTE`**, `reparto` por turno (`importe`, `porcentaje`, `parteCentro`, `parteProfesor` y el profesor) y sus totales, con `repartoDeTurno`. Para la mesa de entrada y el alumno el campo no viene (`undefined`, no `null`): un test de la respuesta lo fija. Un pago anulado muestra su reparto igual (lo que se cobró).
3. **El comprobante de pago en PDF no cambia** (HU-43): un test verifica que no aparece el porcentaje.
4. Tests: el porcentaje guardado es el vigente; cambiar el porcentaje no modifica pagos anteriores; reparto sólo para el gerente.
5. Documentación: `contrato-api.md` → Pagos (`reparto` sólo para el gerente).

**Criterios de aceptación**

- Se cobra un turno de $ 8.000 al 15 %, el gerente cambia a 18 % y se cobra otro: el detalle del primero muestra 15 % y el del segundo, 18 %.
- La mesa de entrada no recibe el reparto.

---

## T-123 · [Back] Reuso: comprobante adjunto de la transferencia a un profesor (`adjuntos`)

- **HU:** HU-44 (comprobante de la transferencia, "con las mismas reglas de HU-24")
- **Área:** Backend
- **Rama:** `feat/adjuntos-liquidaciones`
- **Depende de:** T-118
- **Estimación:** 2

**Alcance**

1. `POST /adjuntos` suma el rol `GERENTE`, con las mismas validaciones (JPG, PNG o PDF de hasta 5 MB, firma del archivo; `shared/archivos.ts`).
2. `adjuntos.condiciones.ts`: `vincularAdjuntoALiquidacion(client, { adjuntoId, liquidacionId, actor })`, con las mismas comprobaciones que `vincularAdjunto` (existe, no está vinculado, lo subió el mismo usuario; si no, `ADJUNTO_INVALIDO`). Un adjunto se vincula a un pago **o** a una liquidación: `vincularAdjunto` rechaza uno subido por el gerente y viceversa.
3. `GET /adjuntos/liquidaciones/{liquidacionId}` (`GERENTE`): el adjunto activo con su URL prefirmada, como el de un pago. Un profesor no lo ve (HU-45: no ve comprobantes).
4. `ultimoAdjuntoDeLiquidacion(client, liquidacionId)` en condiciones, para el detalle de T-124.
5. Tests: subir como gerente; vincular a una liquidación; un adjunto de liquidación no se vincula a un pago ni al revés; profesor → 403.
6. Documentación: `contrato-api.md` → Adjuntos; `dominio.md` → Comprobante adjunto.

**Criterios de aceptación**

- El gerente sube un PDF, lo vincula a una liquidación y lo vuelve a ver desde su detalle.

---

## T-124 · [Back] HU-44 · API de liquidaciones: listado del mes, detalle y registrar el pago

- **HU:** HU-44 Liquidación mensual y pago a los profesores
- **Área:** Backend
- **Rama:** `feat/liquidaciones-api`
- **Depende de:** T-121, T-123 (`vincularAdjuntoALiquidacion`; puede empezar contra su firma)
- **Estimación:** 5

**Alcance**

1. **`GET /liquidaciones?mes&page&pageSize`** (`GERENTE`): `mes` opcional (por defecto el último mes terminado); un mes futuro → 400. Una fila por profesor **con turnos o ajustes en ese mes, aunque esté inactivo**: profesor, cantidad de turnos, total cobrado, parte del centro, parte del profesor, ajustes, total a pagar, estado y, si está pagada, la fecha de la transferencia. Más los `totales` del mes (de todo el listado, no de la página). Orden por apellido y nombre.
2. **`GET /liquidaciones/profesores/{profesorId}/{mes}`** (`GERENTE`): el detalle con el mismo cálculo del listado: cada turno (fecha, horario, alumno, materia, número de comprobante del cobro, importe, porcentaje y parte del profesor), los ajustes con su texto y, si está cerrada, `liquidacionId`, los datos de la transferencia, el adjunto (`ultimoAdjuntoDeLiquidacion`, sin URL), quién registró el pago y cuándo. `acciones.registrarPago` lo decide la API (mes terminado, `PENDIENTE_DE_PAGO`, total > 0). Profesor inexistente → 404; profesor sin movimientos en el mes → 200 con la liquidación vacía.
3. **`POST /liquidaciones/profesores/{profesorId}/{mes}/pago`** (`GERENTE`), `{ fechaTransferencia, numeroOperacion, comprobanteAdjuntoId?, observaciones?, totalConfirmado }`:
   - `fechaTransferencia` obligatoria, no futura y no anterior al último día del mes liquidado; `numeroOperacion` obligatorio, hasta 50; `observaciones` hasta 500. Cada error en su campo.
   - Mes en curso o futuro → 409 "La liquidación de noviembre todavía no se puede pagar: el mes no terminó". Ya pagada → 409. Total de 0 o menos → 409 "No hay importe a pagar".
   - **Sin pagos parciales:** el monto es el total que calcula la API. El cliente manda el `totalConfirmado` que mostró; si el total cambió entre la consulta y la confirmación (por ejemplo, se anuló un pago), 409 `LIQUIDACION_MODIFICADA` "La liquidación cambió desde que la abriste. Revisala antes de pagar", sin registrar nada.
   - En **una transacción**: recalcula con `cierreDeLiquidacion`, escribe la `Liquidacion` `PAGADA` con sus `LiquidacionTurno` y `AjusteLiquidacion`, cierra como `DESCONTADA` las de saldo negativo que absorbió y vincula el adjunto. Los únicos de T-118 traducen una carrera (dos pagos simultáneos) a 409.
   - Responde lo necesario para el mensaje: "Pago registrado. La liquidación de octubre de Gómez, Ana quedó pagada".
4. Tests del service: el listado sólo con profesores con movimientos (uno inactivo incluido); el mes por defecto; cada error del pago; el 409 por total modificado; pagar congela y una anulación posterior no cambia la cerrada; pagar un mes que absorbe un saldo negativo cierra los dos.
5. Documentación: `contrato-api.md` → Liquidaciones; `dominio.md` → Liquidaciones (pagar).

**Criterios de aceptación**

- El gerente ve la liquidación de octubre de cada profesor y registra la transferencia de una: queda "Pagada" y sus turnos no aparecen en otra.
- Si entre que la abre y confirma se anula un pago de uno de sus turnos, el pago se rechaza con 409 y no se guarda nada.

---

## T-125 · [Back] HU-44 / HU-45 · PDF de la liquidación

- **HU:** HU-44 (PDF) y HU-45 (el mismo documento para el profesor)
- **Área:** Backend
- **Rama:** `feat/liquidaciones-pdf-api`
- **Depende de:** T-124 (dueña de `liquidaciones.routes.ts` y del controller hasta mergearse; la plantilla puede empezar en paralelo)
- **Estimación:** 3

**Alcance**

1. `GET /liquidaciones/profesores/{profesorId}/{mes}/pdf` (`GERENTE`; `PROFESOR` **sólo la suya**, 403 si no), con el contrato común de los PDF (decisiones T-122 y T-123) y el mismo cálculo del detalle, sin duplicar reglas.
2. Contenido: encabezado oficial (`encabezadoDeDocumento`), profesor, mes y estado; detalle de turnos (fecha, horario, alumno, materia, comprobante, importe, porcentaje y parte del profesor); ajustes; totales; si está pagada, fecha y número de operación de la transferencia. **Sin** datos de la forma de pago de las familias ni el comprobante adjunto.
3. Nombre del archivo: "liquidacion", el profesor y el mes, con la convención de la decisión T-123 (ver "Puntos a confirmar", punto 11).
4. Archivos: `liquidaciones.pdf.tsx`, `liquidaciones.documentos.ts`, `liquidaciones.formato.ts`, la ruta y su handler. Tests como los del Sprint 2 (`%PDF-`, páginas y metadatos; la ruta con el service mockeado; profesor pidiendo la de otro → 403).
5. `contrato-api.md` → Documentos PDF y Liquidaciones.

**Criterios de aceptación**

- El PDF de una liquidación pagada trae los turnos, los ajustes, los totales y la transferencia.
- Un profesor descarga la suya y recibe 403 con la de otro.

---

## T-126 · [Back] HU-45 · Mis ingresos: endpoints del profesor

- **HU:** HU-45 Mis ingresos
- **Área:** Backend
- **Rama:** `feat/mis-ingresos-api`
- **Depende de:** T-121, T-124 (dueña de `liquidaciones/**` hasta mergearse; puede empezar en paralelo contra el motor)
- **Estimación:** 3

**Alcance**

Todos con rol `PROFESOR`, con el profesor **de la sesión** (como `GET /alumnos/mis-alumnos`): ningún endpoint recibe un `profesorId`.

1. **`GET /liquidaciones/mis-ingresos`:**
   - `esteMes`: la liquidación del mes en curso del motor (turnos con fecha, horario, alumno, materia, importe, porcentaje y su parte; ajustes si los hay; total acumulado). Es el mismo cálculo que ve el gerente.
   - `clasesSinCobrar`: ocurrencias del profesor con asistencia `PRESENTE` o `AUSENTE` y sin pago vigente, con fecha, horario, alumno y materia, de los últimos 366 días (el tope de los otros listados), de la más reciente a la más antigua.
   - `clasesCobradasSinAsistencia`: ocurrencias del profesor de hoy o anteriores con pago vigente, sin asistencia y **dentro del plazo** (`plazoDeAsistencia`), con su `vence`.
   - Leído del motor de ocurrencias y del de liquidaciones; nada se recalcula.
2. **`GET /liquidaciones/mis-liquidaciones?page`:** una fila por mes con movimientos (sin el mes en curso, que está en `esteMes`): mes, total, estado y fecha de la transferencia si está pagada.
3. **`GET /liquidaciones/mis-liquidaciones/{mes}`:** el detalle de una, con el mismo formato que el del gerente **sin** el adjunto, quién registró el pago ni las observaciones.
4. **Nada de otros profesores ni del centro:** sin totales del centro, sin forma de pago ni comprobantes de las familias. Un test de la respuesta lo fija. Un usuario `PROFESOR` sin profesor vinculado → 403.
5. Tests: cada sección con datos y vacía; lo que devuelve `esteMes` coincide con `GET /liquidaciones/profesores/{id}/{mes}` para el mismo profesor; otro rol → 403.
6. Documentación: `contrato-api.md` → Liquidaciones (endpoints `mis-…` del profesor).

**Criterios de aceptación**

- El profesor ve su mes en curso, sus clases sin cobrar, las cobradas sin asistencia con su vencimiento y sus liquidaciones, y nada de otros profesores.

---

## T-127 · [Back] HU-46 · API de caja diaria y su PDF (feature `caja`)

- **HU:** HU-46 Caja diaria
- **Área:** Backend
- **Rama:** `feat/caja-api`
- **Depende de:** T-118, T-119, T-120 (`repartoDeTurno`)
- **Estimación:** 5

**Alcance**

1. **`GET /caja?fecha&tipo?&formaPago?`** (`GERENTE`): `fecha` opcional (por defecto hoy); una fecha futura → 400.
   - `movimientos`, ordenados por hora de registro:
     - `COBRO` (+): los pagos con **fecha de pago** igual a `fecha` (también los que después se anularon: ese día fueron un cobro), con hora de registro, número de comprobante, alumno, forma de pago, importe y, si ya está anulado, la marca. Si el pago se registró otro día (fecha de pago cargada hacia atrás), la hora va con su fecha: "registrado el 16/10 09:12".
     - `ANULACION` (−): las anulaciones registradas ese día, con comprobante, alumno, forma de pago, importe y motivo.
     - `PAGO_PROFESOR` (−): las liquidaciones `PAGADA` con fecha de transferencia igual a `fecha`, con profesor, mes liquidado, número de operación e importe, y `liquidacion: { profesorId, mes }` para abrirla.
     - Cobros y anulaciones llevan `pagoId` para abrir el detalle (HU-36).
   - Filtros: `tipo` (`COBRO`, `ANULACION`, `PAGO_PROFESOR`) y `formaPago` (los pagos a profesores son transferencias: entran con `TRANSFERENCIA`).
   - `resumen` **del día completo**, sin filtros: ingresos por forma de pago y total, ya descontadas las anulaciones del día; de esos ingresos, la parte del centro y la de los profesores con el porcentaje **guardado en cada cobro** (una anulación resta las partes del cobro que anula); egresos (pagado a profesores); saldo del día.
   - Un día sin movimientos devuelve las listas vacías y el resumen en 0 (el texto "No hubo movimientos de caja el 15/10" es de la UI).
2. **`GET /caja/pdf?fecha`** (`GERENTE`), con el contrato común de los PDF: encabezado oficial, fecha, resumen y **la lista completa** de movimientos (sin filtros). Nombre "caja" y la fecha (ver "Puntos a confirmar", punto 11). `caja.pdf.tsx`, `caja.formato.ts`.
3. Reglas puras en `caja.reglas.ts` (armado del resumen y orden de los movimientos), sobre una lectura por tipo de movimiento en el repository. Importes en centavos.
4. Tests: un cobro y su anulación el mismo día (se ven los dos y el neto es 0); una anulación de un cobro de otro día; un cobro con fecha de pago hacia atrás; las partes con dos porcentajes distintos; filtros; día vacío; fecha futura → 400; otros roles → 403; la plantilla PDF.
5. Documentación: `contrato-api.md` → Caja; `dominio.md` → Caja diaria.

**Criterios de aceptación**

- La caja de hoy del seed muestra los cobros, la anulación y el pago al profesor, y el saldo es ingresos menos egresos.
- La parte del centro más la de los profesores es igual a los ingresos del día.

---

## T-128 · [Back] HU-47 · Tablero: sección "Finanzas" y su PDF

- **HU:** HU-47 Pestaña "Finanzas" del tablero
- **Área:** Backend
- **Rama:** `feat/tablero-finanzas-api`
- **Depende de:** T-112 (dueña de `tablero/**` hasta mergearse), T-121
- **Estimación:** 3

**Alcance**

1. **`GET /tablero/finanzas?desde&hasta&orden?&direccion?&page`** (`GERENTE`), con el período y las validaciones comunes del tablero:
   - `resumen`: total cobrado (el mismo número que "General": `totalCobradoEntre`); margen del centro (parte del centro de esos cobros **más** el importe completo de los cerrados sin registrar, con `cobrosConReparto`) y su porcentaje sobre el total cobrado; `incluyeSinRegistrar` (el importe de los cerrados sin registrar, para el aviso); pagado a profesores (liquidaciones pagadas con fecha de transferencia en el período); saldo a pagar a profesores **a hoy** (`saldoAPagarPorProfesor`, no depende del período): la suma de los saldos positivos; un profesor con saldo negativo no lo resta (propuesta, punto 12).
   - `profesores`, paginado de a 10: turnos cobrados en el período, total cobrado de sus turnos, parte del centro, parte del profesor, pagado en el período y saldo pendiente a hoy. `orden` y `direccion` por cualquier columna.
   - `evolucion`: los últimos 6 meses hasta el fin del período, con total cobrado, margen del centro y pagado a profesores de cada mes.
   - Pagos anulados fuera de todos los números. Reglas puras en `tablero.reglas.ts`.
2. **PDF:** `GET /tablero/pdf?seccion=finanzas&desde&hasta`, con los números principales y **las dos tablas completas**.
3. Tests: cada número con datos falsos; margen con cerrados sin registrar; porcentaje con base 0; orden de la tabla; anulados fuera; la plantilla.
4. Documentación: `contrato-api.md` → Tablero; `dominio.md` → Tablero (Finanzas).

**Criterios de aceptación**

- El total cobrado de "Finanzas" es igual al de "General" para el mismo período.
- "Saldo a pagar a profesores" es la suma de los saldos pendientes **positivos** de la tabla (ver "Puntos a confirmar", punto 12).

---

## T-129 · [Front] Andamiaje de la ampliación: menús, páginas y placeholders

- **HU:** Transversal (HU-43 a HU-46)
- **Área:** Frontend
- **Rama:** `feat/andamiaje-liquidaciones-ui`
- **Estimación:** 2
- **Prioridad:** Bloqueante del front de la ampliación, se mergea el día 1

**Alcance**

1. Menú del gerente: "Liquidaciones", "Caja diaria" y "Configuración" (en ese orden, después de "Pagos"). Menú del profesor: "Mis ingresos".
2. Páginas que componen los placeholders: `app/gerente/liquidaciones/page.tsx` (con `?mes=` en la URL) y `app/gerente/liquidaciones/[profesorId]/[mes]/page.tsx`; `app/gerente/caja/page.tsx` (con `?fecha=`); `app/gerente/configuracion/page.tsx`; `app/profesor/ingresos/page.tsx`. El permiso por rol, como el resto de los segmentos.
3. Placeholders **con sus props definitivas** en la carpeta de cada feature (`PorcentajeCentro`, `LiquidacionesDelMes`, `LiquidacionDetalle`, `CajaDiaria`, `MisIngresos`), que muestran "Próximamente". Cada tarea después sólo completa su archivo.
4. `src/types/` o `utils/`: el formato de porcentaje ("15 %", "15,5 %") si no existe uno, junto al de importes.

**Criterios de aceptación**

- Gerente y profesor ven sus opciones nuevas; cada página abre su placeholder y otro rol ve "No tiene permiso para acceder a esta sección".

---

## T-130 · [Front] HU-43 · Configuración → Porcentaje del centro, y reparto en el detalle del pago

- **HU:** HU-43
- **Área:** Frontend
- **Rama:** `feat/reparto-ui`
- **Depende de:** T-120, T-129; la parte del detalle del pago, T-122 y T-99
- **Estimación:** 3

**Alcance**

1. `PorcentajeCentro`: el vigente, un campo para cambiarlo (número de 0 a 99,99, con hasta dos decimales) y el historial (porcentaje, desde qué fecha y hora rige, quién lo cambió), paginado.
2. Al guardar, confirmación con el valor nuevo: "Desde ahora, el centro retendrá el 18 % de cada turno cobrado. Los cobros ya registrados conservan su porcentaje". Los 400 en el campo.
3. `RepartoDelPago` (en `features/reparto`): una tabla por turno con importe, porcentaje, parte del centro y parte del profesor, y los totales, con los datos de `GET /pagos/{id}`. Se muestra sólo si la respuesta trae `reparto` (lo decide la API, no el rol en el cliente).
4. Se monta en el detalle del pago del gerente con una prop de render de `PagoDetalle` (`arquitectura-frontend.md` → componente de otra feature), compuesta desde `app/gerente/pagos`. Si T-99 no se mergeó, se acuerda con su dueña agregar la prop.

**Criterios de aceptación**

- El gerente cambia el porcentaje con confirmación y lo ve en el historial.
- El detalle de un pago muestra el reparto al gerente y no a la mesa de entrada.

---

## T-131 · [Front] HU-44 · Liquidaciones: listado del mes y detalle

- **HU:** HU-44
- **Área:** Frontend
- **Rama:** `feat/liquidaciones-ui`
- **Depende de:** T-124 (puede empezar en paralelo), T-129
- **Estimación:** 5

**Alcance**

1. `LiquidacionesDelMes`: selector de mes en la URL (por defecto el que manda la API, el último terminado; el mes en curso se puede elegir y se ve "En curso"), totales del mes y la tabla por profesor (turnos, total cobrado, parte del centro, parte del profesor, ajustes, total a pagar y estado). Estados con su texto, incluido "Saldo a descontar el mes próximo" y "Descontada en la liquidación de…". Sin movimientos: "No hay liquidaciones en octubre de 2026".
2. `LiquidacionDetalle({ profesorId, mes, vista })`: turnos, ajustes con su texto, totales y, si está pagada, la transferencia (fecha, operación, comprobante adjunto con "Ver" por la URL de T-123, observaciones, quién y cuándo). `vista: 'gerente' | 'profesor'` oculta lo que el profesor no ve (la reusa T-133). Botón "Generar PDF" (enlace, decisión T-123). El botón "Registrar pago" se muestra si `acciones.registrarPago`, y abre el diálogo de T-132 (slot).
3. Tablas usables en tablet; en pantallas chicas se desplazan dentro de su contenedor.

**Criterios de aceptación**

- El gerente recorre los meses, abre la liquidación de un profesor y ve sus turnos y ajustes, igual que en el PDF.

---

## T-132 · [Front] HU-44 · Registrar el pago de una liquidación

- **HU:** HU-44 (registrar el pago al profesor)
- **Área:** Frontend
- **Rama:** `feat/liquidaciones-pago-ui`
- **Depende de:** T-124, T-123, T-131 (el slot del diálogo), T-78 (`CampoArchivo`)
- **Estimación:** 3

**Alcance**

1. `RegistrarPagoLiquidacionDialog`: forma de pago fija "Transferencia" (informativa); fecha de la transferencia, número de operación, comprobante (opcional, `CampoArchivo`, subido a `POST /adjuntos` al elegirlo, como en T-97) y observaciones. El monto es el total de la liquidación y no se edita.
2. Confirmación: "¿Registrar el pago de $ 245.000 a Gómez, Ana por la liquidación de octubre de 2026?". Se envía con `totalConfirmado`.
3. Éxito: "Pago registrado. La liquidación de octubre de Gómez, Ana quedó pagada"; se invalidan el listado y el detalle.
4. Errores: los 400 en su campo; el 409 `LIQUIDACION_MODIFICADA` cierra el diálogo, recarga el detalle y avisa "La liquidación cambió desde que la abriste. Revisala antes de pagar"; los otros 409, con su mensaje.

**Criterios de aceptación**

- Se registra el pago con y sin comprobante, y la liquidación pasa a "Pagada".
- No se puede escribir el monto.

---

## T-133 · [Front] HU-45 · "Mis ingresos"

- **HU:** HU-45
- **Área:** Frontend
- **Rama:** `feat/mis-ingresos-ui`
- **Depende de:** T-126, T-129, T-131 (`LiquidacionDetalle` con `vista="profesor"`)
- **Estimación:** 3

**Alcance**

1. `MisIngresos`, cuatro secciones: "Este mes" (turnos, su parte y el total acumulado, con "Se te paga a mes vencido, por transferencia"); "Clases dadas sin cobrar" ("Se suman a tu liquidación cuando el alumno las pague"); "Clases cobradas sin asistencia", con la fecha límite y un acceso a "Asistencia" ("Registrá la asistencia para que se sumen a tu liquidación. Si vence el plazo, no se te pagan"); "Mis liquidaciones" (mes, total, estado y "Generar PDF"), que abre el detalle con `LiquidacionDetalle` en vista de profesor.
2. Cada sección vacía lo dice ("No tenés clases dadas sin cobrar", etc.). Sólo lectura.
3. Usable desde el celular (el profesor lo consulta fuera del centro): verificado a 360 px.

**Criterios de aceptación**

- El total de "Este mes" coincide con el que ve el gerente para ese profesor en el mes en curso.

---

## T-134 · [Front] HU-46 · "Caja diaria"

- **HU:** HU-46
- **Área:** Frontend
- **Rama:** `feat/caja-ui`
- **Depende de:** T-127 (puede empezar en paralelo), T-129
- **Estimación:** 5

**Alcance**

1. `CajaDiaria`: la fecha en la URL, con selector y "Día anterior" / "Día siguiente" (el siguiente, deshabilitado en hoy; no se eligen fechas futuras).
2. Resumen: ingresos por forma de pago y total, parte del centro y de los profesores, egresos y saldo del día, como los manda la API.
3. Movimientos, con signo y color por tipo, y filtros por tipo y por forma de pago. Cada cobro o anulación abre el detalle del pago (`EnlaceDetallePago`, hook de `features/pagos`); cada pago a profesor, su liquidación. Un cobro ya anulado lleva la marca.
4. Sin movimientos: "No hubo movimientos de caja el 15/10". Botón "Generar PDF" (enlace) con la fecha que se ve.

**Criterios de aceptación**

- El gerente recorre los días con las flechas, filtra por tipo y forma de pago, y abre un cobro y un pago a profesor desde la lista.

---

## T-135 · [Front] HU-47 · Pestaña "Finanzas" del tablero

- **HU:** HU-47
- **Área:** Frontend
- **Rama:** `feat/tablero-finanzas-ui`
- **Depende de:** T-128, T-113 (dueña de `features/tablero/**` hasta mergearse)
- **Estimación:** 3

**Alcance**

1. Pestaña "Finanzas" después de "Asistencia" (`?seccion=finanzas`), con el selector de período común.
2. Hasta 4 números principales: total cobrado, margen del centro (con su porcentaje y el aviso "Incluye $ 13.600 de turnos sin asistencia registrada" si la API manda importe), pagado a profesores y saldo a pagar a profesores (con la aclaración "a hoy").
3. Tablas: por profesor (ordenable por cualquier columna, paginada de a 10) y evolución de los últimos 6 meses.
4. "Generar PDF" con `seccion=finanzas` y el período que se ve.

**Criterios de aceptación**

- Cambiar de pestaña conserva el período; la tabla se ordena; el PDF corresponde a la pestaña.

---

## T-136 · [QA] Verificación integrada del reparto: los mismos números en todas las vistas

- **HU:** HU-43 a HU-47
- **Área:** QA (coordina el SM)
- **Rama:** — (no lleva código: lo que se encuentre se corrige con tareas FIX)
- **Depende de:** lo mergeado a `testing` de la ampliación; se hace antes o junto con T-114
- **Estimación:** 2

**Alcance**

1. Base reseteada, migración y seed.
2. Recorrido con números a mano (una planilla con los turnos del seed):
   - **Gerente:** cambia el porcentaje y cobra un turno nuevo (el reparto del detalle usa el nuevo; uno anterior conserva el suyo); abre la liquidación del mes pasado, la paga con comprobante y descarga el PDF; anula un pago de un turno de esa liquidación y ve el ajuste en la próxima sin cerrar; recorre la caja de hoy y la de ayer; revisa "Finanzas".
   - **Profesor:** "Mis ingresos", con cada sección; registra la asistencia de una clase cobrada y la ve pasar a "Este mes"; descarga el PDF de una liquidación.
   - **Mesa de entrada y alumno:** no ven el reparto en el detalle del pago ni en el comprobante.
3. **Cruces que tienen que dar igual:** el total de "Este mes" del profesor y su fila en la liquidación en curso del gerente; la suma de las liquidaciones pagadas en un período y "Pagado a profesores" de "Finanzas"; los ingresos de la caja de los días de un período y el total cobrado del tablero menos las anulaciones; la parte del centro más la de los profesores y los ingresos de cada caja.
4. **Permisos:** cada endpoint nuevo pedido con los otros roles → 403; un profesor pidiendo la liquidación o el PDF de otro → 403.
5. Suma los recorridos de la ampliación al guion de la review de T-114.

**Criterios de aceptación**

- Cada cruce está verificado o tiene un FIX abierto.

---

## Puntos a confirmar con las PO (no bloquean el inicio)

Cada punto tiene una propuesta con la que las tareas pueden avanzar; si la respuesta es otra, se corrige la tarea abierta o se agrega un FIX, como en el Sprint 2. Conviene cerrarlos en la planning o, a más tardar, el día 2.

1. **Alcance y línea de corte.** El sprint tiene 18 HU y 73 puntos de función, y es el último. Propuesta de lo que se recorta primero si falta capacidad, en este orden: (a) la pestaña "Asistencia" del tablero y su PDF (HU-39 parcial: "General" con asistencia y formas de pago se mantiene); (b) el PDF del historial (HU-32); (c) los exámenes del portal (HU-35); (d) "Mis pagos" (HU-37). Las tareas ya están ordenadas para que recortar no rompa nada.
2. **Cierre automático a los 7 días** (HU-22). Se calcula al consultar, sin un proceso programado ni una fila que lo guarde: el resultado es siempre el mismo y es definitivo, porque pasado el plazo la API no deja registrar. La "fecha y hora del cierre" que se muestra es el vencimiento (las 23:59 del séptimo día), no el momento en que corrió un proceso. ¿Alcanza con eso? (T-74, T-81, T-84)
3. **Asistencia de un turno de hoy antes de su hora.** La HU sólo prohíbe fechas futuras. Propuesta: se puede registrar cualquier turno de hoy. (T-81)
4. **"Marcar todos presentes" con filas ya registradas.** Propuesta: marca sólo las que no tienen asistencia; un ausente ya registrado no cambia. (T-81, T-82)
5. ~~**Calendario semanal con asistencia.**~~ **Resuelto por las PO:** ninguna vista de calendario ni de lista cambia; los estados de asistencia se ven sólo en el detalle del turno (además de la pantalla "Asistencia" y el historial). Un turno pasado no cancelado se ve sin distintivo. (T-77, T-85, T-86, T-87)
6. **Un turno de hoy ya dado e impago: ¿adeudado o próximo?** Propuesta: próximo hasta mañana, porque la fecha sigue separando las dos secciones de HU-16. (T-76)
7. ~~**Horas seguidas en el historial.**~~ **Resuelto por las PO (ajustado el 14/10, reemplaza la respuesta anterior: "todo se muestra por hora"):** cada hora sigue siendo una ocurrencia con su estado y su asistencia. En el detalle del turno (también el del portal), el historial, su PDF y "Mis materias", las horas seguidas se muestran juntas, con el estado de cada hora y los textos una sola vez; si una hora tiene otros textos, se muestran también los suyos. Desde el detalle, el profesor del turno registra la asistencia de esa hora y de sus horas seguidas sin registrar. (T-84, T-85, T-108, T-109, T-110, T-111)
8. **"Sin registrar" en "Mis materias".** HU-33 sólo nombra "Realizado", "Ausente" y "Cancelado": un turno dado y todavía sin registrar no se le muestra al alumno hasta que el profesor lo registre. Confirmar. (T-108, T-111)
9. **Nombre del PDF del historial.** HU-32 pide `historial-academico_perez-juan_2026-10.pdf`, pero la decisión T-123 reserva el `_` para separar las dos fechas de un rango. Propuesta: `historial-academico-perez-juan-2026-10.pdf`. (T-110)
10. **Un alumno cuyo DNI ya tiene usuario** (por ejemplo, un profesor del centro que también toma clases). Cada persona tiene un solo usuario por DNI. Propuesta: el alta se rechaza con "Ya existe un usuario con ese DNI" hasta que las PO definan el caso. (T-88)
11. **Nombre de los PDF de la ampliación.** HU-44 y HU-46 piden `liquidacion_gomez-ana_2026-10.pdf` y `caja_2026-10-15.pdf`, pero la decisión T-123 reserva el `_` para separar las dos fechas de un rango (igual que el punto 9). Propuesta: `liquidacion-gomez-ana-2026-10.pdf` y `caja-2026-10-15.pdf`. (T-125, T-127)
12. **"Saldo a pagar a profesores" con un profesor en saldo negativo** (HU-47). Propuesta: el número principal suma sólo los saldos positivos (lo que de verdad hay que transferir); la tabla muestra el saldo de cada profesor, negativo incluido. (T-128, T-135)
13. **El ajuste por anulación puede caer en un mes anterior a la anulación.** Con la regla elegida ("primera liquidación sin cerrar posterior a la que incluyó el turno"), si el profesor tiene septiembre sin pagar y se anula en noviembre un pago de un turno de agosto (ya pagado), el ajuste baja la liquidación de septiembre. Es lo esperado; queda anotado para explicarlo en la review. (T-121)
14. **Aviso al anular un pago con turnos ya liquidados** (HU-42). La previa de la anulación podría avisar "Se descontarán $ 6.800 de la próxima liquidación de Gómez, Ana". La HU no lo pide: propuesta, no se agrega en este incremento. (T-104, T-121)
15. **"Clases dadas sin cobrar" de "Mis ingresos"** (HU-45) no tiene un límite en la HU. Propuesta: los últimos 366 días, el tope de los otros listados. (T-126)
