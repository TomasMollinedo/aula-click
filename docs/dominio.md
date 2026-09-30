# Reglas de dominio — Aula Click (Sprint 1)

Reglas de negocio acordadas. No se modifican sin acuerdo del equipo; lo pendiente está en [`decisiones.md`](./decisiones.md) → Abiertas. Estas reglas las **decide y hace cumplir la API**; el frontend las muestra y puede anticipar errores de formato, pero no las recalcula (única excepción: el formulario de alumno calcula si es menor solo como ayuda visual, para mostrar el aviso y los datos del tutor; no bloquea el envío y la validación sigue siendo de la API; T-28).

## Roles

| Rol              | Valor técnico de `role` | Estado            |
| ---------------- | ----------------------- | ----------------- |
| Mesa de entradas | `MESA_ENTRADAS`         | Sprint 1          |
| Profesor         | `PROFESOR`              | Sprint 1          |
| Gerente          | `GERENTE`               | Planificado       |
| Alumno           | `ALUMNO`                | Sprint 3 (portal) |

- Cada usuario tiene un solo rol. Los valores técnicos son los de la tabla catálogo `rol`; la base rechaza cualquier otro (T-23).
- No hay registro público. Las cuentas se crean desde el sistema: el primer gerente (y un usuario por rol, en desarrollo) lo crea el seed (T-21), y mesa de entradas crea la cuenta de cada profesor (T-22).
- Un usuario inactivo no puede iniciar sesión: recibe "Su usuario no está habilitado".
- Cada profesor tiene su cuenta de usuario: mesa de entradas la crea con una contraseña inicial al dar de alta al profesor (T-22). La cuenta del alumno llega con el portal (Sprint 3).

## Alumnos

- El DNI es único entre alumnos. **No se puede modificar después del alta**: un `dni` en la edición se rechaza (T-45).
- Datos obligatorios del alta: nombre, apellido, DNI y fecha de nacimiento. Si es mayor de edad (18 años o más a la fecha de hoy), además su email y su teléfono. Si es menor, en cambio, nombre, apellido, teléfono y email del tutor (el DNI del tutor es opcional); el email y el teléfono propios del alumno son opcionales. El resto (datos escolares, colegio, observaciones) se completa después (T-45, corrige T-25).
- Cumple 18 el día de su cumpleaños: ese día ya es mayor. Quien nació un 29 de febrero cumple 18 el 1 de marzo.
- La fecha de nacimiento no puede ser posterior a hoy.
- La regla de contacto vale también al editar, sobre el alumno resultante: no se puede borrar un dato obligatorio del tutor de un menor, ni el email o el teléfono propios de un mayor. Si una edición hace que un menor pase a ser mayor y no tiene email o teléfono cargados, se rechaza. Los datos del tutor de un mayor se conservan.
- Los alumnos tienen baja lógica (estado activo / inactivo, `ACTIVO` por defecto), pero la baja no se implementa en este release.

## Profesores y materias

- DNI y matrícula son únicos entre profesores (activos e inactivos). El DNI **no se puede modificar** después del alta: un `dni` en la edición se rechaza (T-45).
- Profesores y materias tienen baja lógica (estado activo / inactivo); nada se borra.
- La baja del profesor es la de su usuario: un profesor inactivo es un `Usuario` inactivo, que además no puede iniciar sesión.
- Un profesor inactivo no recibe materias, bloques ni turnos nuevos.
- No se puede dar de baja un profesor, quitarle una materia, dar de baja una materia que tiene profesores, ni editar o eliminar un bloque, si hay **turnos vigentes**.
- Un profesor dado de baja se puede reactivar: vuelve a `ACTIVO`, puede iniciar sesión de nuevo, vuelve a aparecer en el listado por defecto y queda disponible para agendar turnos, con sus materias y bloques intactos. La reactivación no revalida nada.
- **Capacidad del profesor** (T-27, HU-02): entero obligatorio, mínimo 1. Es la cantidad máxima de alumnos que atiende a la vez en una franja de una hora; es un dato del profesor, no del bloque. No se puede bajar a un valor menor que la **ocupación simultánea máxima** del profesor en alguna hora de sus bloques desde hoy: la mayor cantidad de turnos que ocupan lugar en esa hora en una misma fecha (la misma cuenta que controla `BLOQUE_LLENO`; dos tramos de un mismo recurrente no suman, porque nunca coinciden en una fecha). Igualarla sí se puede. Si no se cumple, se rechaza con `CAPACIDAD_INSUFICIENTE`, indicando la hora, la fecha y la cantidad (T-15, T-40).

## Materias

HU-12 (T-39). Reemplaza a HU-04 en cuanto a quién administra el catálogo.

- **Quién:** alta, edición, baja y reactivación son **solo del gerente**. Mesa de entradas lista, busca y ve el detalle (con el precio y los profesores asignados), pero no escribe, cualquiera sea el precio. Asignar y quitar materias a un profesor (HU-05) sigue siendo de mesa de entradas: HU-12 cambia quién administra el catálogo, no quién arma el plantel.
- **Datos:** nombre y precio por hora de clase son obligatorios; la descripción es opcional. El nombre es único sin distinguir mayúsculas ni tildes.
- **Precio por hora:** importe en pesos, mayor a 0, con hasta dos decimales. Se exige en el alta y no se puede borrar al editar: toda materia creada o editada desde el sistema tiene precio.
- **Materias sin precio:** solo las anteriores a HU-12. Al migrar quedaron inactivas y el listado las marca "Sin precio". No se ofrecen para asignar a profesores ni para registrar turnos hasta que el gerente les carga el precio (se pueden editar estando inactivas) y las reactiva. Por eso **toda materia activa tiene precio**, y siempre hay un importe para cobrar sus turnos.
- **Edición:** nombre, descripción y precio, con las mismas validaciones del alta. Cambiar el precio no modifica los pagos ya registrados ni el importe de los turnos ya cobrados: rige para los cobros que se registren desde ese momento (ver Pagos).
- **Baja:** lógica. Solo si la materia no tiene profesores con una asignación activa; si los tiene, se rechaza con `MATERIA_CON_PROFESORES` indicando cuántos y cuáles.
- **Reactivación:** vuelve la materia a activa y disponible para asignar a profesores y registrar turnos. Una materia sin precio no se reactiva (`MATERIA_SIN_PRECIO`): primero hay que cargarle el precio.
- El detalle muestra quién creó la materia y quién la modificó por última vez, con fecha y hora (ver Auditoría).

## Aulas

- Catálogo cargado por el seed; sin alta, edición ni baja en este release (HU-05): sólo lectura.
- El nombre es único. La capacidad es un entero obligatorio, mínimo 1.
- Tienen baja lógica (estado activo / inactivo, `ACTIVO` por defecto), aunque en este release nada la cambia salvo el seed.

## Bloques de clase

- Un bloque es una hora exacta de atención de un profesor en un aula, un día de la semana. Se pide como un rango múltiplo de una hora (por ejemplo 14:00 a 18:00) y el sistema lo guarda como varias filas de una hora cada una (T-17, T-29): no hay una fila que abarque varias horas.
- Las horas son siempre en punto; la de fin es posterior a la de inicio.
- No se puede cargar un bloque a un profesor inactivo, ni a un profesor sin ninguna materia asignada activa.
- Un profesor no puede tener dos bloques activos a la misma hora el mismo día.
- Un aula no puede tener dos bloques activos a la misma hora el mismo día, sin importar de qué profesor sean.
- Un pedido de varias horas se crea todo junto o nada: si alguna hora del rango ya está tomada (por el profesor o por el aula), no se crea ninguna.
- **Capacidad efectiva** de cada hora: `min(profesor.capacidad, aula.capacidad)` (T-27/T-28), calculada al leer, nunca guardada.
- **Ocupación** de cada hora (T-33): la cantidad de turnos que **ocupan lugar** en esa hora (ver Turnos) en su **próxima ocurrencia**, es decir, la próxima fecha de ese día de la semana a partir de hoy, hoy incluido (aunque la hora de hoy ya haya pasado: es un horario semanal, no una agenda). Cuentan las sesiones únicas de esa fecha y los recurrentes cuyo rango la incluye. La capacidad se controla fecha por fecha, así que sumar todos los turnos futuros de una hora no se puede comparar con su capacidad efectiva. Es la misma cuenta que controla `BLOQUE_LLENO` al registrar un turno.
- Un aula está **disponible** para un horario si está activa y ninguna de las horas pedidas ese día está ocupada por un bloque activo (de cualquier profesor). Al editar una hora, la propia fila no ocupa su aula.
- Tienen baja lógica (estado activo / inactivo); no se puede editar ni eliminar un bloque con turnos vigentes (ver Profesores y materias).
- **Editar un bloque** cambia el día, el horario y/o el aula de esa hora puntual; el profesor no se edita (para moverlo a otro profesor hay que dar de baja esa hora y cargar una nueva). El resultado tiene que seguir siendo una hora exacta, y las mismas reglas de superposición y aula libre valen para la edición, sin contar la propia fila como un conflicto consigo misma.
- **Dar de baja un bloque completo** (varias horas juntas, T-33): se piden las horas por sus ids explícitos (las que el usuario ve agrupadas), nunca por rango, así no se da de baja nada que el usuario no haya visto. Todas tienen que existir, estar activas y ser del **mismo profesor**, y ninguna puede tener turnos vigentes. Se dan de baja todas o ninguna. Igual que la baja de una hora, no se valida el estado del profesor.

## Turnos

- Un turno une a un alumno con **una hora** de un bloque de un profesor (una fila del horario) e indica la materia. La materia tiene que estar activa y asignada (con asignación activa) a ese profesor, y el profesor tiene que estar activo. Elegir varias horas del mismo profesor y el mismo día crea un turno por hora, todos o ninguno.
- **Tipos** (T-37):
  - `SESION_UNICA`: una fecha (`fechaFin = fechaInicio`).
  - `RECURRENTE`: una fecha de inicio y una de fin opcional (sin fin = sigue indefinidamente). Sus **ocurrencias** son todas las fechas de ese día de la semana dentro del rango.
  - La fecha de inicio y la de fin (si hay) tienen que caer en el día de la semana del bloque.
- **La fecha de inicio es hoy o posterior**: no se registran turnos con fecha pasada (hoy se permite aunque la hora ya haya pasado).
- **Turno vigente:** está `ACTIVO` y tiene al menos una ocurrencia **no cancelada** entre hoy y su fin efectivo (T-52). Un recurrente sin fin siempre es vigente; uno finalizado (su **fin efectivo** ya pasó, aunque su `fechaFin` no cambie) o con todas sus fechas restantes canceladas deja de serlo, y ya no impide ninguna baja. Con los datos del Sprint 1 (sin cancelaciones ni finalizaciones) es lo mismo que "no tiene fecha de fin, o su fecha de fin es >= hoy".
- **Turno que ocupa lugar** en una hora en una fecha `d`: está `ACTIVO`, su fecha de inicio es <= `d` y no tiene fin o su fin es >= `d`. Es una sola condición para los dos tipos (una sesión única es el caso inicio = fin). Desde el Sprint 2 el fin es el **fin efectivo**: finalizar la serie (HU-14) no modifica `fechaFin`, así que es el menor entre `fechaFin` y el día anterior a `FinalizacionRecurrencia.fechaDesde` (T-48). Además, una ocurrencia **cancelada** no ocupa lugar: esa fecha queda libre para otro turno (T-30). Una pagada o pasada ocupa lugar igual.
- **Capacidad:** se controla por hora y por fecha contra la capacidad efectiva de esa hora (T-27: `min(profesor.capacidad, aula.capacidad)`, calculada al leer). Una fecha está llena si los turnos que ocupan lugar en ella son >= la capacidad efectiva.
- **Fechas sin lugar en un recurrente:** si algunas fechas del pedido están llenas, se rechaza con `BLOQUE_LLENO` informando, por hora, qué fechas están llenas (o desde qué fecha lo están todas). El usuario decide:
  - crearlo **solo en las fechas con lugar**: se guarda como varios turnos `RECURRENTE` ("tramos"), uno por cada racha de fechas consecutivas con lugar, que saltean las llenas. Ejemplo: lunes 9:00 del 05/10 al 30/11 con el 26/10 lleno → del 05/10 al 19/10 y del 02/11 al 30/11. El alta informa las fechas que quedaron sin turno;
  - o no crearlo.
- **Al confirmar se recalcula todo:** si alguien ocupó un lugar mientras tanto, entra en la cuenta.
- **Sin lugar en ninguna fecha** (incluida una sesión única en una hora llena): se rechaza con `BLOQUE_LLENO`, sin opción de crearlo.
- **Superposición del alumno:** un alumno no puede tener dos turnos que se pisen (mismo día y hora, con rangos de fechas que se cruzan), aunque sean de profesores distintos. Es un **rechazo total** (`ALUMNO_SUPERPUESTO`): no hay opción de crearlo en las fechas libres.
- **Prioridad** (no se ingresa a mano): Alta si el examen cae dentro de los 10 días desde la fecha del turno, Media entre 11 y 20 días, Baja en otro caso o si no hay fecha de examen. No se guarda: se calcula al leer.
- Un turno está `ACTIVO` o `CANCELADO`; la UI muestra `ACTIVO` como **"Agendado"** (no es otro valor). Que sea vigente se decide por sus fechas, no por su estado. Un turno `CANCELADO` no es vigente ni ocupa lugar: no impide ninguna baja.
- **Observaciones y temas a trabajar (HU-08):** las observaciones son siempre opcionales. Los **temas a trabajar** son opcionales en un `RECURRENTE` y **obligatorios** en una `SESION_UNICA`. Con "Asignar igual" (fechas sin lugar en un recurrente, tramos), todos los tramos creados de esa hora llevan las mismas observaciones y los mismos temas del pedido.
- **Ocurrencia (Sprint 2, T-46):** un turno en una fecha concreta es lo que se cancela, se paga, se reprograma y tiene prioridad. Se identifica por el par **`(turnoId, fecha)`**: no tiene una "fecha original" distinta de su fecha.
- **Cancelación de una ocurrencia (HU-13):** a partir del Sprint 2, cancelar registra siempre una fila en `CancelacionTurno` (`turnoId` + fecha de la ocurrencia), también para una sesión única; el resto de la serie sigue agendado. El valor `CANCELADO` de `Turno.estado` queda sólo para los turnos cancelados antes de este sprint (no se deshace una cancelación). El detalle de las reglas de HU-13 lo fija su propia tarea.
- **Finalización de una recurrencia (HU-14):** pone fin a una serie `RECURRENTE` desde una fecha (`FinalizacionRecurrencia`, a lo sumo una por turno); los turnos anteriores a esa fecha no cambian. El detalle de las reglas de HU-14 lo fija su propia tarea.
- **Reprogramación de una ocurrencia (HU-20, T-47):** edita el turno, sin tabla propia: una sesión única cambia su bloque y su fecha; en un recurrente la serie se parte en tramos (el original termina en la ocurrencia anterior, un tramo nuevo sigue desde la siguiente y la fecha movida pasa a ser una `SESION_UNICA` en el destino), y sus cancelaciones y pagos pasan al turno nuevo. El detalle lo fija T-49.

## Pagos

Modelo de datos (T-29); las reglas completas de cobro las fija HU-15 (registrar un pago) y HU-16 (deuda del alumno), cada una en su propia tarea.

- Un pago (`Pago`) es de **un solo alumno** y puede incluir una o varias de sus ocurrencias (`PagoTurno`), cada una identificada igual que una cancelación: `(turnoId, fecha de la ocurrencia)`. Genera un único comprobante, con `numeroComprobante` correlativo y único.
- El monto recibido (`Pago.montoRecibido`) es opcional; si se informa, tiene que ser >= el importe total. El vuelto lo calcula y lo devuelve la API: no se guarda (T-49).
- La forma de pago (`FormaPago`) es un catálogo con baja lógica; el seed carga **"Efectivo"**, único medio disponible en este sprint (el ABM completo es HU-23, fuera de alcance).
- El importe de cada ocurrencia pagada (`PagoTurno.importeAplicado`) es el precio por hora **vigente** de la materia del turno (`Materia.precioHora`) al momento de registrar el pago: cambiar el precio de la materia después no modifica los pagos ya registrados.
- Una ocurrencia se paga **una sola vez** (lo garantiza la base, T-49). La anulación de pagos queda para el próximo sprint: en este, todo pago nace `VIGENTE` y un turno pagado no se puede cancelar.

## Exámenes

Modelo de datos (T-29); las reglas completas de alta, edición y baja las fija HU-17, en su propia tarea.

- Un examen (`Examen`) es de un alumno en una materia, con `tipo` (`PARCIAL`, `FINAL`, `RECUPERATORIO`, `TRABAJO_PRACTICO` u `OTRO`) y baja lógica (`estado`): "eliminar" un examen (HU-17) es darlo de baja, nunca borrarlo.
- De él depende la prioridad del turno (HU-18): Alta de 0 a 10 días hasta el examen, Media de 11 a 20, Baja en otro caso o si no hay examen próximo en esa materia.

## Cancelación

HU-13 (T-45). Cancelar registra una `CancelacionTurno` por ocurrencia (`turnoId` + fecha de la ocurrencia), también para una sesión única; el modelo está en [Turnos](#turnos) más arriba.

- **Qué se puede cancelar:** una ocurrencia del alumno que existe (el turno genera esa fecha, dentro de su fin efectivo), en estado `AGENDADO` (no cancelada y de **hoy en adelante**) y con pago `PENDIENTE`.
- **Un turno pagado no se cancela** (definición D): en este sprint no se anulan pagos, así que no hay forma de deshacer el cobro. Una pasada tampoco: es historia.
- **Una cancelación sólo afecta a esa fecha:** el resto de la serie sigue agendado y la hora vuelve a tener lugar ese día. No se deshace una cancelación.
- **Varias a la vez:** de un mismo alumno (aunque sean de distintos turnos o profesores). **Todo o nada:** si alguna no se puede cancelar, no se cancela ninguna y la API informa cuáles y por qué (no existe, ya cancelada, pagada o pasada).
- **Motivo y detalle:** el motivo es obligatorio (`CANCELACION_ALUMNO`, `CANCELACION_PROFESOR`, `PROBLEMA_ADMINISTRATIVO` u `OTRO`); el detalle es libre, de hasta 500 caracteres, y **obligatorio con `OTRO`**. El mismo motivo y detalle valen para todas las ocurrencias del pedido.
- **Concurrencia:** la cancelación y un pago simultáneos de la misma ocurrencia se serializan con `alumno` `FOR UPDATE` (`bloquearAlumno`, decisión T-59): si el pago entra primero, la cancelación ve el turno pagado y responde 409.

## Finalización

A completar por T-47.

## Reprogramación

HU-20 (T-49). Reprogramar **edita el turno**: no hay tabla de reprogramaciones (definición A, decisión T-47) ni se guarda desde qué fecha y hora se reprogramó. Quién lo modificó y cuándo sale de la auditoría del turno.

- **Qué se puede reprogramar:** una ocurrencia `AGENDADO` (de hoy o posterior). Una cancelada o pasada, no. **Pagada se puede**: el pago acompaña a la ocurrencia y pasa a la fecha nueva.
- **Qué se valida en el destino** (las de HU-08, sobre la hora y la fecha nuevas): `fechaDestino` hoy o posterior y en el día de la hora; profesor activo; materia activa y asignada al profesor de destino (`MATERIA_NO_ASIGNADA`); lugar en la hora (`BLOQUE_LLENO`) y sin superposición del alumno (`ALUMNO_SUPERPUESTO`). En los dos últimos chequeos **la propia ocurrencia no cuenta**. Mover a la misma hora y la misma fecha es un error.
- **Sesión única:** se actualizan la hora, `fechaInicio` y `fechaFin` (= `fechaDestino`) del mismo turno.
- **Recurrente:** sólo se mueve esa fecha, así que la serie se parte en hasta tres turnos: el original termina en la ocurrencia anterior; un tramo `RECURRENTE` nuevo, en la misma hora, sigue desde la siguiente hasta el fin original (o sin fin); y la fecha movida es una `SESION_UNICA` nueva en el destino. Alumno, materia, observaciones y temas se copian.
- **Sin turnos vacíos:** si es la **primera** fecha, el original arranca en la siguiente (no hay tramo nuevo y nada se re-apunta); si es la **última** (o la última antes del fin efectivo), no hay tramo nuevo; si es su **única** fecha, el original se edita como una sesión única en el destino.
- **Cancelaciones y pagos:** los de las fechas posteriores pasan al tramo nuevo y el de la fecha movida, a la sesión única con la fecha nueva.
- **Finalización de la serie:** si el turno tiene una y se crea el tramo nuevo, pasa al tramo nuevo (es el que termina en `fechaDesde`); si no se crea, queda en el original. Si la ocurrencia era la única fecha del turno, se borra: una sesión única no se finaliza y la finalización podría cortar la fecha movida.

## Pagos

HU-15 (T-51). El modelo (un pago de un alumno con una o varias ocurrencias, comprobante correlativo, forma de pago "Efectivo", precio vigente) está en [Pagos](#pagos) más arriba; acá van las reglas del cobro.

- **Qué se puede cobrar:** una ocurrencia del alumno que existe (el turno genera esa fecha, dentro de su fin efectivo), con estado `AGENDADO` o `SIN_REGISTRAR` (las canceladas no) y pago `PENDIENTE`. Pasadas o futuras.
- **Tope de 8 semanas:** una ocurrencia futura, de una serie o una sesión única, se cobra sólo hasta hoy + 56 días. Las pasadas no tienen tope (T-60).
- **Precio vigente:** el importe de cada ocurrencia es el precio por hora de su materia al registrar el pago (no lo manda el cliente). Una materia sin precio no se cobra; una dada de baja con precio, sí (T-61).
- **Todo o nada:** si alguna ocurrencia no se puede cobrar, no se registra ninguna y la API informa cuáles y por qué (no existe, cancelada, ya pagada, fuera de las 8 semanas o sin precio). Dos pagos simultáneos de la misma ocurrencia: sólo uno se registra.
- **Fecha de pago:** obligatoria, hoy o anterior.
- **Monto recibido y vuelto:** el monto recibido es opcional; si se informa, tiene que ser >= el total. El vuelto (`monto recibido − total`) lo calcula la API al responder y al mostrar el comprobante: **no se guarda**.
- **Comprobante:** muestra los datos **actuales** de cada turno (si una ocurrencia pagada se reprograma, reimprimirlo muestra la fecha, la hora y el profesor nuevos) y el importe que se cobró, que no cambia (T-63). La numeración es correlativa pero puede tener huecos (T-62).
- Los importes, el total y el vuelto los calcula siempre la API; la UI sólo los muestra.

## Deuda

A completar por T-53.

## Exámenes

A completar por T-55.

## Prioridad

HU-18. La prioridad de un turno es de cada **ocurrencia** (un turno en una fecha) y la calcula la API; no se carga a mano.

- Se toma el **próximo examen `ACTIVO` del mismo alumno y la misma materia** del turno, con fecha igual o posterior a la de la ocurrencia. Los exámenes anteriores a la ocurrencia y los dados de baja no cuentan.
- Días hasta el examen = fecha del examen − fecha de la ocurrencia, en días de calendario.
- **Alta** de 0 a 10 días (un examen el mismo día de la ocurrencia es Alta), **Media** de 11 a 20 y **Baja** con más de 20 días o si no hay examen próximo en esa materia.
- En una serie recurrente cada ocurrencia tiene su propia prioridad: el mismo examen puede dar Baja a una ocurrencia lejana y Alta a una cercana.
- Junto con la prioridad se informa el examen que la determina (fecha, tipo, materia y días que faltan). Una Baja por lejanía también lo trae; sin examen próximo, no.
- Las ocurrencias canceladas no tienen prioridad.
- La prioridad **no se guarda**: se calcula en cada consulta, así que cargar, modificar o dar de baja un examen la cambia en la próxima consulta.

## Auditoría

Todas las entidades registran quién las creó y quién las modificó por última vez, y cuándo (`createdById`, `updatedById`, `createdAt`, `updatedAt`).
