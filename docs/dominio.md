# Reglas de dominio — Aula Click (Sprints 1 a 3)

Reglas de negocio acordadas. No se modifican sin acuerdo del equipo; lo pendiente está en [`decisiones.md`](./decisiones.md) → Abiertas. Estas reglas las **decide y hace cumplir la API**; el frontend las muestra y puede anticipar errores de formato, pero no las recalcula (única excepción: el formulario de alumno calcula si es menor solo como ayuda visual, para mostrar el aviso y los datos del tutor; no bloquea el envío y la validación sigue siendo de la API; T-28).

## Roles

| Rol              | Valor técnico de `role` | Estado            |
| ---------------- | ----------------------- | ----------------- |
| Mesa de entradas | `MESA_ENTRADAS`         | Sprint 1          |
| Profesor         | `PROFESOR`              | Sprint 1          |
| Gerente          | `GERENTE`               | Sprint 2          |
| Alumno           | `ALUMNO`                | Sprint 3 (portal) |

- Cada usuario tiene un solo rol. Los valores técnicos son los de la tabla catálogo `rol`; la base rechaza cualquier otro (T-23).
- No hay registro público. Las cuentas se crean desde el sistema: el primer gerente (y un usuario por rol, en desarrollo) lo crea el seed (T-21), y mesa de entradas crea la cuenta de cada profesor (T-22).
- Un usuario inactivo no puede iniciar sesión: recibe "Su usuario no está habilitado".
- Cada profesor tiene su cuenta de usuario: mesa de entradas la crea con una contraseña inicial al dar de alta al profesor (T-22). La cuenta del alumno (HU-27) la crea mesa de entradas al darlo de alta, con un usuario generado y su DNI como contraseña inicial: es un `Usuario` con rol `ALUMNO` vinculado a su `Alumno` por `Usuario.alumnoId`, y cada alumno tiene a lo sumo una. Como Better Auth exige un email y el alumno ingresa con su usuario, su `email` es sintético (`<usuario>@alumnos.aulaclick.invalid`, un dominio reservado que no entrega correo); su `dni` es el del alumno y su `telefono`, el suyo o, si no tiene, el de su tutor (T-131, T-132).

## Alumnos

- El DNI es único entre alumnos. **No se puede modificar después del alta**: un `dni` en la edición se rechaza (T-45).
- Datos obligatorios del alta: nombre, apellido, DNI y fecha de nacimiento. Si es mayor de edad (18 años o más a la fecha de hoy), además su email y su teléfono. Si es menor, en cambio, nombre, apellido, teléfono y email del tutor (el DNI del tutor es opcional); el email y el teléfono propios del alumno son opcionales. El resto (datos escolares, colegio, observaciones) se completa después (T-45, corrige T-25).
- Cumple 18 el día de su cumpleaños: ese día ya es mayor. Quien nació un 29 de febrero cumple 18 el 1 de marzo.
- La fecha de nacimiento no puede ser posterior a hoy.
- La regla de contacto vale también al editar, sobre el alumno resultante: no se puede borrar un dato obligatorio del tutor de un menor, ni el email o el teléfono propios de un mayor. Si una edición hace que un menor pase a ser mayor y no tiene email o teléfono cargados, se rechaza. Los datos del tutor de un mayor se conservan.
- Los alumnos tienen baja lógica (estado activo / inactivo, `ACTIVO` por defecto), pero la baja no se implementa en este release.
- **Foto del alumno** (HU-26, amplía HU-02): opcional, JPG o PNG de hasta 5 MB, con las mismas reglas que la del profesor (HU-03). Se puede reemplazar o quitar; sin foto, la UI muestra un avatar genérico. Al reemplazarla o quitarla se borra el archivo anterior, y el cambio queda en la auditoría del alumno. El alumno no puede cambiarla desde el portal en este incremento.
- **Cada alumno tiene su acceso al portal** (HU-27): el alta lo crea junto con el alumno (ver Portal del alumno). Un alumno anterior a este incremento lo obtiene desde su ficha.

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
- **Serie** (decisión T-103): todo lo que se registró en un mismo alta `RECURRENTE` es una serie, y sus turnos comparten `serieId`: **todas sus horas** (una clase de 9 a 11 son dos turnos) y **todos sus tramos**, los que deja el alta por fechas sin lugar y los que deja una reprogramación. Una `SESION_UNICA` no es parte de ninguna serie (tampoco la fecha que se reprogramó de un recurrente). Dos altas distintas son dos series, aunque sean del mismo alumno, materia y hora. Un recurrente anterior a esta regla no tiene `serieId`: es una serie de un solo turno.
- **La fecha de inicio es hoy o posterior**: no se registran turnos con fecha pasada (hoy se permite aunque la hora ya haya pasado). Desde el portal, **desde mañana**: el alumno no saca turnos para el mismo día (HU-29).
- **Turno vigente:** está `ACTIVO` y tiene al menos una ocurrencia **no cancelada** entre hoy y su fin efectivo (T-52). Un recurrente sin fin siempre es vigente; uno finalizado (su **fin efectivo** ya pasó, aunque su `fechaFin` no cambie) o con todas sus fechas restantes canceladas deja de serlo, y ya no impide ninguna baja. Con los datos del Sprint 1 (sin cancelaciones ni finalizaciones) es lo mismo que "no tiene fecha de fin, o su fecha de fin es >= hoy".
- **Turno que ocupa lugar** en una hora en una fecha `d`: está `ACTIVO`, su fecha de inicio es <= `d` y no tiene fin o su fin es >= `d`. Es una sola condición para los dos tipos (una sesión única es el caso inicio = fin). Desde el Sprint 2 el fin es el **fin efectivo**: finalizar la serie (HU-14) no modifica `fechaFin`, así que es el menor entre `fechaFin` y el día anterior a `FinalizacionRecurrencia.fechaDesde` (T-48). Además, una ocurrencia **cancelada** no ocupa lugar: esa fecha queda libre para otro turno (T-30). Una pagada o pasada ocupa lugar igual.
- **Capacidad:** se controla por hora y por fecha contra la capacidad efectiva de esa hora (T-27: `min(profesor.capacidad, aula.capacidad)`, calculada al leer). Una fecha está llena si los turnos que ocupan lugar en ella son >= la capacidad efectiva.
- **Fechas sin lugar en un recurrente:** si algunas fechas del pedido están llenas, se rechaza con `BLOQUE_LLENO` informando, por hora, qué fechas están llenas (o desde qué fecha lo están todas). El usuario decide:
  - crearlo **solo en las fechas con lugar**: se guarda como varios turnos `RECURRENTE` ("tramos"), uno por cada racha de fechas consecutivas con lugar, que saltean las llenas. Ejemplo: lunes 9:00 del 05/10 al 30/11 con el 26/10 lleno → del 05/10 al 19/10 y del 02/11 al 30/11. El alta informa las fechas que quedaron sin turno;
  - o no crearlo.
- **Al confirmar se recalcula todo:** si alguien ocupó un lugar mientras tanto, entra en la cuenta.
- **Sin lugar en ninguna fecha** (incluida una sesión única en una hora llena): se rechaza con `BLOQUE_LLENO`, sin opción de crearlo.
- **Superposición del alumno:** un alumno no puede tener dos turnos que se pisen (mismo día y hora, con rangos de fechas que se cruzan), aunque sean de profesores distintos. Es un **rechazo total** (`ALUMNO_SUPERPUESTO`): no hay opción de crearlo en las fechas libres.
- **Prioridad** (no se ingresa a mano): Alta si el examen cae dentro de los 10 días desde la fecha del turno, Media entre 11 y 20 días, Baja en otro caso o si no hay fecha de examen. No se guarda: se calcula al leer. Las reglas están en [Prioridad](#prioridad).
- Un turno está `ACTIVO` o `CANCELADO`; la UI muestra `ACTIVO` como **"Agendado"** (no es otro valor). Que sea vigente se decide por sus fechas, no por su estado. Un turno `CANCELADO` no es vigente ni ocupa lugar: no impide ninguna baja.
- **Observaciones y temas a trabajar (HU-08):** las observaciones son siempre opcionales. Los **temas a trabajar** son opcionales en un `RECURRENTE` y **obligatorios** en una `SESION_UNICA`. Con "Asignar igual" (fechas sin lugar en un recurrente, tramos), todos los tramos creados de esa hora llevan las mismas observaciones y los mismos temas del pedido.
- **Ocurrencia (Sprint 2, T-46):** un turno en una fecha concreta es lo que se cancela, se paga, se reprograma y tiene prioridad. Se identifica por el par **`(turnoId, fecha)`**: no tiene una "fecha original" distinta de su fecha.
- **Cancelación de una ocurrencia (HU-13):** a partir del Sprint 2, cancelar registra siempre una fila en `CancelacionTurno` (`turnoId` + fecha de la ocurrencia), también para una sesión única; el resto de la serie sigue agendado. El valor `CANCELADO` de `Turno.estado` queda sólo para los turnos cancelados antes de este sprint (no se deshace una cancelación). Las reglas están en [Cancelación](#cancelación).
- **Finalización de una recurrencia (HU-14):** pone fin a **una hora** de una serie `RECURRENTE` desde una fecha, en todos sus tramos (`FinalizacionRecurrencia`, a lo sumo una por turno); los turnos anteriores a esa fecha no cambian. Las reglas están en [Finalización](#finalización).
- **Reprogramación de una ocurrencia (HU-20, T-47):** edita el turno, sin tabla propia: una sesión única cambia su bloque y su fecha; en un recurrente la serie se parte en tramos (el original termina en la ocurrencia anterior, un tramo nuevo sigue desde la siguiente y la fecha movida pasa a ser una `SESION_UNICA` en el destino), y sus cancelaciones y pagos pasan al turno nuevo. Las reglas están en [Reprogramación](#reprogramación).
- **Sacar un turno desde el portal (HU-29, T-93):** el alumno saca turnos para sí mismo con las mismas reglas que la mesa de entrada (capacidad, materia asignada, día del bloque, temas obligatorios en una sesión única, superposición y fechas sin lugar), por un recorrido más simple: materia (las activas con algún profesor activo que la tenga y tenga bloques activos), profesor y día, horario ("Disponible" o "Completo", sin ver cuántos lugares hay ni quiénes están anotados), tipo y fechas, desde mañana. Si se superpone con un turno suyo: "Ya tenés un turno ese día en ese horario". Con fechas llenas en un turno semanal, puede "Reservar sólo las fechas con lugar". El turno queda "Agendado" sin aprobación, registrado por el propio alumno. No escribe observaciones (son internas de la mesa). Cancelar o reprogramar lo sigue haciendo la mesa de entrada.
- **Tope de deuda:** un alumno con deuda vencida no saca turnos nuevos, ni desde el portal ni desde la mesa de entrada ([Tope de deuda](#tope-de-deuda)).
- **Pagos y exámenes:** un turno en una fecha se cobra (HU-15) y su prioridad depende de los exámenes del alumno (HU-17, HU-18). Las reglas están en [Pagos](#pagos), [Deuda](#deuda), [Exámenes](#exámenes) y [Prioridad](#prioridad).

## Cancelación

HU-13 (T-45). Cancelar registra una `CancelacionTurno` por ocurrencia (`turnoId` + fecha de la ocurrencia), también para una sesión única; el modelo está en [Turnos](#turnos) más arriba.

- **Qué se puede cancelar:** una ocurrencia del alumno que existe (el turno genera esa fecha, dentro de su fin efectivo), en estado `AGENDADO` (no cancelada, sin asistencia y de **hoy en adelante**) y con pago `PENDIENTE`.
- **Un turno con asistencia no se cancela** (HU-22, T-83): "Presente" o "Ausente", ya ocurrió, aunque sea de hoy. Es el primer motivo después de "ya cancelado": anular su pago no lo vuelve cancelable.
- **Un turno pagado no se cancela** (definición D): primero hay que anular el pago (HU-42); un pago anulado no cuenta, y la ocurrencia vuelve a poder cancelarse (lo resuelve el motor de ocurrencias, T-74). Una pasada tampoco: es historia.
- **Una cancelación sólo afecta a esa fecha:** el resto de la serie sigue agendado y la hora vuelve a tener lugar ese día. No se deshace una cancelación.
- **Varias a la vez:** de un mismo alumno (aunque sean de distintos turnos o profesores). **Todo o nada:** si alguna no se puede cancelar, no se cancela ninguna y la API informa cuáles y por qué (no existe, ya cancelada, con asistencia, pagada o pasada).
- **Motivo y detalle:** el motivo es obligatorio (`CANCELACION_ALUMNO`, `CANCELACION_PROFESOR`, `PROBLEMA_ADMINISTRATIVO` u `OTRO`); el detalle es libre, de hasta 500 caracteres, y **obligatorio con `OTRO`**. El mismo motivo y detalle valen para todas las ocurrencias del pedido.
- **Concurrencia:** la cancelación y un pago simultáneos de la misma ocurrencia se serializan con `alumno` `FOR UPDATE` (`bloquearAlumno`, decisión T-59): si el pago entra primero, la cancelación ve el turno pagado y responde 409.

## Finalización

HU-14 (T-47; por hora desde la decisión T-104, acordada con las PO el 01/10). Finalizar un turno recurrente es darlo por terminado desde una fecha: registra una `FinalizacionRecurrencia` (`turnoId` único, `fechaDesde`, motivo, detalle y quién la hizo). Lo hace mesa de entradas, desde el detalle del turno.

- **Finalizar actúa por hora:** se finaliza la hora del turno desde cuyo detalle se opera, en **todos los tramos de su serie**: los turnos `RECURRENTE` `ACTIVO` con su mismo `serieId` y su misma hora (la misma fila del horario). Las reglas de abajo se aplican a ese **conjunto**. Un recurrente sin `serieId` (anterior a la decisión T-103) es un conjunto de un solo turno.
- **Las otras horas de la serie no se finalizan:** si la clase se registró con más de una hora (de 9 a 11), finalizar la de 9 deja la de 10 agendada. La previa informa las otras horas que tienen alguna fecha desde `fechaDesde` y no están finalizadas ("Esta clase también tiene la hora de 10:00 a 11:00, que sigue agendada"), para que se finalicen desde su propio detalle. Una hora que termina antes de `fechaDesde` no se avisa.
- **Qué se puede finalizar:** un turno `RECURRENTE`, con su hora vigente y sin finalizar. **Vigente**, acá, es que alguno de los tramos de esa hora tenga `fechaFin` nula o de hoy en adelante: el mismo criterio con el que el detalle ofrece "Finalizar" (decisión T-75). **Ya finalizada** es que alguno de sus tramos tenga una finalización. Una sesión única no se finaliza: se cancela.
- **Desde qué fecha (`fechaDesde`):** de hoy en adelante, en el día de la semana de la serie, posterior al primer inicio de esa hora y no posterior a su último fin. Es la primera fecha que se libera. Una fecha que cae en un **hueco** entre dos tramos (una fecha sin lugar del alta, o la que se reprogramó) es válida: se liberan las que siguen. Para liberar sólo la primera fecha de un turno, se cancela.
- **Qué se registra:** una `FinalizacionRecurrencia` con la misma `fechaDesde`, motivo y detalle en cada tramo de esa hora que tiene fechas desde `fechaDesde`. Un tramo que termina antes no cambia.
- **`fechaFin` no se modifica** (definición C, decisión T-48): el **fin efectivo** de cada tramo pasa a ser el día anterior a `fechaDesde` y lo aplica el motor de ocurrencias. Desde `fechaDesde` esa hora no aparece en las agendas ni en los turnos del alumno, su lugar queda libre y deja de contar como turno vigente (no bloquea la baja del profesor, de la materia ni del bloque). Cada turno conserva su rango original junto con el motivo del fin anticipado.
- **Las ocurrencias anteriores a `fechaDesde` no cambian:** siguen con su estado, su pago y su cancelación.
- **Turnos pagados** (definición D): si alguna ocurrencia desde `fechaDesde` está pagada, en cualquiera de los tramos de esa hora, **no se finaliza**. La API informa cuáles son (fecha, horario e importe), la última fecha pagada y la primera fecha que sí se puede elegir (la ocurrencia siguiente a la última pagada). Si los pagados llegan hasta la última fecha de la serie, no hay fecha posible y el turno no se puede finalizar. Un pago anulado (HU-42) no cuenta: esa fecha se vuelve a poder finalizar.
- **Turnos con asistencia** (HU-22, T-83): con el mismo tratamiento que los pagados. Sólo puede ser el de hoy (la asistencia se registra el día del turno o después), así que pasa al finalizar **desde hoy**: ese turno ya ocurrió y no se libera. La API lo informa en la previa y la primera fecha posible es la siguiente; si era la última de la serie, no se puede finalizar. Si además hay pagados, se informa el de los pagados: el último pagado es el que fija la primera fecha posible.
- **Una fecha reprogramada no se libera:** al reprogramar una fecha de la serie, esa fecha pasa a ser una `SESION_UNICA` aparte (definición A). Finalizar la serie no la toca; si hay que liberarla, se cancela.
- **Reprogramación posterior** (T-49): si se reprograma una fecha de un turno ya finalizado y la serie se parte, la finalización pasa al tramo nuevo, que es el que tiene fechas desde `fechaDesde`. El tramo nuevo sigue en la misma serie, así que esa hora sigue contando como finalizada.
- **Motivo y detalle:** las mismas reglas que la cancelación (HU-13): motivo obligatorio (`CANCELACION_ALUMNO`, `CANCELACION_PROFESOR`, `PROBLEMA_ADMINISTRATIVO` u `OTRO`) y detalle libre de hasta 500 caracteres, **obligatorio con `OTRO`**.
- **No se deshace** una finalización, y una hora de una serie se finaliza una sola vez.
- **Concurrencia:** la finalización se serializa con un pago, una cancelación y una reprogramación del mismo alumno con `alumno` `FOR UPDATE` (`bloquearAlumno`, decisión T-78): con el lock tomado se vuelve a leer y a validar todo antes de escribir.

## Reprogramación

HU-20 (T-49). Reprogramar **edita el turno**: no hay tabla de reprogramaciones (definición A, decisión T-47) ni se guarda desde qué fecha y hora se reprogramó. Quién lo modificó y cuándo sale de la auditoría del turno.

- **Qué se puede reprogramar:** una ocurrencia `AGENDADO` (de hoy o posterior, sin asistencia). Una cancelada o pasada, no. **Una con asistencia registrada tampoco**, aunque sea de hoy: ya ocurrió (T-83, `TURNO_CON_ASISTENCIA`). **Pagada se puede**: el pago vigente acompaña a la ocurrencia y pasa a la fecha nueva; si el pago se anuló, se mueve como impaga.
- **Qué se valida en el destino** (las de HU-08, sobre la hora y la fecha nuevas): `fechaDestino` hoy o posterior y en el día de la hora; profesor activo; materia activa y asignada al profesor de destino (`MATERIA_NO_ASIGNADA`); lugar en la hora (`BLOQUE_LLENO`) y sin superposición del alumno (`ALUMNO_SUPERPUESTO`). En los dos últimos chequeos **la propia ocurrencia no cuenta**. Mover a la misma hora y la misma fecha es un error.
- **Sesión única:** se actualizan la hora, `fechaInicio` y `fechaFin` (= `fechaDestino`) del mismo turno.
- **Recurrente:** sólo se mueve esa fecha, así que la serie se parte en hasta tres turnos: el original termina en la ocurrencia anterior; un tramo `RECURRENTE` nuevo, en la misma hora, sigue desde la siguiente hasta el fin original (o sin fin); y la fecha movida es una `SESION_UNICA` nueva en el destino. Alumno, materia, observaciones y temas se copian.
- **Serie** (decisión T-103): el tramo nuevo **sigue en la serie** del original (hereda su `serieId`), así que finalizar esa hora lo alcanza. La `SESION_UNICA` de la fecha movida queda fuera de la serie.
- **Sin turnos vacíos:** si es la **primera** fecha, el original arranca en la siguiente (no hay tramo nuevo y nada se re-apunta); si es la **última** (o la última antes del fin efectivo), no hay tramo nuevo; si es su **única** fecha, el original se edita como una sesión única en el destino y deja de ser parte de la serie.
- **Cancelaciones y pagos:** los de las fechas posteriores pasan al tramo nuevo y el de la fecha movida, a la sesión única con la fecha nueva.
- **Finalización de la serie:** si el turno tiene una y se crea el tramo nuevo, pasa al tramo nuevo (es el que termina en `fechaDesde`); si no se crea, queda en el original. Si la ocurrencia era la única fecha del turno, se borra: una sesión única no se finaliza y la finalización podría cortar la fecha movida.

## Asistencia

HU-22 (T-74: estados y plazo). La asistencia se registra por ocurrencia (`AsistenciaTurno`, `turnoId` + fecha de la ocurrencia), como "Presente" o "Ausente".

- **Estados de una ocurrencia** (decisión T-137), en este orden:
  1. `CANCELADO` si está cancelada, aunque tenga una asistencia registrada.
  2. `REALIZADO` si la asistencia es "Presente".
  3. `AUSENTE` si es "Ausente".
  4. Sin asistencia: `SIN_REGISTRAR` si su fecha es anterior a hoy.
  5. Si no, `AGENDADO`.

  La UI los muestra como "Cancelado", "Realizado", "Ausente", "Sin registrar" y "Agendado". Una asistencia registrada no cambia con el paso del tiempo. El estado lo calcula siempre la API.

- **Plazo para registrar:** hasta las 23:59 del **séptimo día** después de la fecha del turno (vence = fecha + 7 días de calendario; el día 7 entero está dentro del plazo). Un "Sin registrar" dentro del plazo se muestra **"Sin registrar · vence el DD/MM"**; vencido, **"Sin registrar · cerrado por el sistema"**, con la observación "No registrada por el profesor en el plazo de 7 días. Cierre automático del sistema". Si el plazo venció o no, lo dice la API: la UI no lo calcula.
- **Pasado el plazo, el estado es definitivo:** un "Sin registrar" cerrado por el sistema no se puede registrar ni corregir, y lo ya registrado tampoco se puede corregir.
- **El cierre se calcula al leer** (decisión T-138, **pendiente de confirmación de las PO**, punto 2 de "Puntos a confirmar" del Sprint 3): no hay un proceso programado ni una fila que lo guarde. La fecha y hora del cierre que se muestra es el vencimiento (las 23:59 del séptimo día), no el momento en que corrió un proceso.
- **Horas seguidas** (ajuste del equipo y de las PO del 14/10): las ocurrencias no canceladas de un mismo alumno, profesor y materia en un día, una a continuación de la otra (de 8 a 9 y de 9 a 10, sí; de 8 a 9 y de 20 a 21, no; una hora cancelada en el medio corta el grupo).
  - **Cada hora es una ocurrencia**, con su propio estado y su propia asistencia: se cobra, se cuenta en los indicadores y en los porcentajes por separado. Los textos se guardan en **cada** hora; "una sola vez" es cómo se muestran.
  - **Cómo se ven:** en el detalle del turno (también el del portal), el historial, su PDF y "Mis materias", las horas seguidas se muestran **juntas**, con el estado de **cada** hora y "Qué se trabajó" e "Indicaciones para la próxima sesión" **una sola vez**. Si alguna hora tiene otros textos (porque se corrigió sola), se muestran también los de esa hora. Qué textos van una vez y cuáles aparte lo decide la API, así todas las vistas dicen lo mismo. Las listas y los calendarios no cambian: no muestran la asistencia.
  - **Registro desde el detalle:** el profesor del turno registra la asistencia de esa hora y, con "Aplicar también a…", la de sus horas seguidas **sin registrar**, con los mismos textos. Una hora ya registrada se corrige desde su propio detalle.

HU-22 (T-81: registro).

- **Quién:** sólo el **profesor del turno** registra y corrige su asistencia. Mesa de entrada y gerente no registran ni corrigen: la ven en el detalle del turno, el historial y el tablero.
- **Cuándo:** turnos de **hoy** (también antes de su hora) y de días anteriores dentro del plazo. Una fecha futura o una ocurrencia cancelada no se registran. Un día vencido se sigue viendo, en sólo lectura.
- **Campos:** "Presente" con "Qué se trabajó" e "Indicaciones para la próxima sesión" (opcionales, hasta 1000 caracteres cada uno), o "Ausente" con una "Observación" (opcional, hasta 500). Un ausente no lleva "Qué se trabajó" ni indicaciones.
- **Horas seguidas en la pantalla "Asistencia":** cada clase (una hora) muestra a todos sus alumnos, así un alumno de 16 a 18 aparece en las dos. Se registra cada hora, o, con "Aplicar también a…", sus otras horas seguidas sin registrar de una vez: el estado y los textos quedan en **cada** hora. Desde el detalle del turno se registra igual (ver Horas seguidas, arriba).
- **Corrección:** registrar de nuevo la misma ocurrencia la corrige: es la misma asistencia (una por ocurrencia), y queda quién y cuándo la modificó. Dentro del plazo se puede corregir; pasado el plazo, no.
- **"Marcar todos presentes"** marca sólo las filas sin asistencia: un ausente ya registrado no cambia (propuesta, punto 4 de "Puntos a confirmar" del Sprint 3).
- **Cierre:** pasado el séptimo día, lo que quedó "Sin registrar" se cierra solo (ver Plazo para registrar) y nada de esa fecha se puede registrar ni corregir.
- **Indicaciones anteriores:** al registrar, se muestran las indicaciones de la última clase "Presente" con indicaciones de ese alumno en esa materia.

HU-22 (T-81: registro).

- **Quién:** sólo el **profesor del turno** registra y corrige su asistencia. Mesa de entrada y gerente no registran ni corrigen: la ven en el detalle del turno, el historial y el tablero.
- **Cuándo:** turnos de **hoy** (también antes de su hora) y de días anteriores dentro del plazo. Una fecha futura o una ocurrencia cancelada no se registran. Un día vencido se sigue viendo, en sólo lectura.
- **Campos:** "Presente" con "Qué se trabajó" e "Indicaciones para la próxima sesión" (opcionales, hasta 1000 caracteres cada uno), o "Ausente" con una "Observación" (opcional, hasta 500). Un ausente no lleva "Qué se trabajó" ni indicaciones.
- **Horas seguidas en la pantalla "Asistencia":** cada clase (una hora) muestra a todos sus alumnos, así un alumno de 16 a 18 aparece en las dos. Se registra cada hora, o, con "Aplicar también a…", sus otras horas seguidas sin registrar de una vez: el estado y los textos quedan en **cada** hora. Desde el detalle del turno se registra igual (ver Horas seguidas, arriba).
- **Corrección:** registrar de nuevo la misma ocurrencia la corrige: es la misma asistencia (una por ocurrencia), y queda quién y cuándo la modificó. Dentro del plazo se puede corregir; pasado el plazo, no.
- **"Marcar todos presentes"** marca sólo las filas sin asistencia: un ausente ya registrado no cambia (propuesta, punto 4 de "Puntos a confirmar" del Sprint 3).
- **Cierre:** pasado el séptimo día, lo que quedó "Sin registrar" se cierra solo (ver Plazo para registrar) y nada de esa fecha se puede registrar ni corregir.
- **Indicaciones anteriores:** al registrar, se muestran las indicaciones de la última clase "Presente" con indicaciones de ese alumno en esa materia.

## Pagos

HU-15 (T-51; modelo de datos: T-29), con las formas de pago de HU-23 (T-96).

- **Un pago, un alumno:** un pago (`Pago`) es de **un solo alumno** y puede incluir una o varias de sus ocurrencias (`PagoTurno`), cada una identificada igual que una cancelación: `(turnoId, fecha de la ocurrencia)`. Genera un único comprobante, con `numeroComprobante` correlativo y único.
- **Forma de pago:** `FormaPago` es un catálogo con baja lógica; el seed carga **"Efectivo"**, **"Transferencia"** y **"Tarjeta de débito"**, identificadas por `tipoFormaPago` (`EFECTIVO`, `TRANSFERENCIA`, `DEBITO`) y no por el nombre (T-134). Todo pago tiene una forma de pago, que se elige siempre (no hay una por defecto). El ABM completo del catálogo sigue fuera de alcance.
- **Un pago, un medio** (HU-23): cada forma de pago lleva sus datos, que se guardan en el `Pago`, y no lleva los de las otras.
  - **Efectivo:** el monto recibido (ver abajo). Sin comprobante adjunto.
  - **Transferencia:** número de operación y banco (obligatorios) y titular (opcional), más el **comprobante adjunto, obligatorio**. No se compara el importe transferido con el total ni se impide repetir una operación: una transferencia puede cubrir los pagos de varios alumnos (por ejemplo, de hermanos).
  - **Débito:** red de la tarjeta (de una lista), número de cupón y, si se quiere, los últimos 4 números de la tarjeta (**nunca el número completo**); el comprobante adjunto es **opcional**, y después de registrado el pago se puede agregar o quitar sin que el pago deje de valer.
  - **El importe no cambia según el medio:** es el precio vigente de cada materia, se pague como se pague.
- **Comprobante adjunto** (HU-24): el archivo que trae la familia como respaldo de un pago, distinto del comprobante de pago que emite el centro. Se sube antes de registrar el pago (`ComprobanteAdjunto.pagoId` nulo) y se vincula al registrarlo. Un pago puede tener varios: se muestra el último activo y los reemplazados quedan guardados; quitarlo es una baja lógica (T-136).
- **Una sola vez:** una ocurrencia tiene a lo sumo un pago **vigente**, y lo garantiza la base (T-133): `PagoTurno.vigente` es `true` mientras el pago está vigente y el único `(turnoId, fechaOcurrencia, vigente)` impide un segundo. Un pago nace `VIGENTE`; al anularlo (HU-42) pasa a `ANULADO`, se registra su `AnulacionPago` (motivo y detalle) y sus filas de `PagoTurno` pasan a `vigente = null`: conserva todos sus datos, pero sus turnos vuelven a estar pendientes y se pueden cobrar de nuevo. Un turno con pago vigente no se puede cancelar.
- **Qué se puede cobrar:** una ocurrencia del alumno que existe (el turno genera esa fecha, dentro de su fin efectivo), que no está cancelada (`AGENDADO`, `SIN_REGISTRAR`, `REALIZADO` o `AUSENTE`: un turno dado e impago se cobra igual, HU-22) y sin un pago vigente (una de un pago anulado se vuelve a cobrar). Pasadas o futuras.
- **Tope de 8 semanas:** una ocurrencia futura, de una serie o una sesión única, se cobra sólo hasta hoy + 56 días. Las pasadas no tienen tope (T-60).
- **Precio vigente:** el importe de cada ocurrencia (`PagoTurno.importeAplicado`) es el precio por hora de su materia (`Materia.precioHora`) al registrar el pago (no lo manda el cliente). Cambiar el precio de la materia después no modifica los pagos ya registrados. Una materia sin precio no se cobra; una dada de baja con precio, sí (T-61).
- **Todo o nada:** si alguna ocurrencia no se puede cobrar, no se registra ninguna y la API informa cuáles y por qué (no existe, cancelada, ya pagada, fuera de las 8 semanas o sin precio). Dos pagos simultáneos de la misma ocurrencia: sólo uno se registra.
- **Fecha de pago:** obligatoria, hoy o anterior.
- **Monto recibido y vuelto:** sólo en efectivo, donde el monto recibido es **obligatorio**: mayor a 0 y >= el total. Sin él no se registra el pago (T-112). El vuelto (`monto recibido − total`) lo calcula la API al responder y al mostrar el comprobante: **no se guarda**. Con transferencia o débito no hay monto recibido ni vuelto.
- **Comprobante:** muestra los datos **actuales** de cada turno (si una ocurrencia pagada se reprograma, reimprimirlo muestra la fecha, la hora y el profesor nuevos) y el importe que se cobró, que no cambia (T-63). La numeración es correlativa pero puede tener huecos (T-62). Además:
  - la forma de pago con sus datos: el monto recibido y el vuelto del efectivo; la operación, el banco y el titular de una transferencia; la red, el cupón y "**** 1234" de un débito;
  - con más de una materia, los turnos **agrupados por materia**, con el subtotal de cada una (HU-25);
  - si el pago está anulado, **"ANULADO"** bien visible, con el motivo, la fecha y quién lo anuló (HU-42).
- Los importes, el total y el vuelto los calcula siempre la API; la UI sólo los muestra.

## Deuda

HU-16 (T-53). La deuda se calcula en cada consulta, no se guarda. La misma regla vale para la cuenta del alumno, la vista global "Pagos" y el tablero del gerente.

- **Adeudado:** una ocurrencia con fecha **anterior a hoy**, no cancelada y con pago pendiente. Entran los "Sin registrar" (también los cerrados por el sistema), los "Realizado" y los "Ausente": haya ido o no el alumno, su lugar estuvo reservado (HU-22). La ocurrencia de hoy no se adeuda todavía: es un próximo turno. Las canceladas no se adeudan.
- **Pagada:** tiene un pago **vigente**. Si el pago se anula (HU-42), sus turnos vuelven solos a adeudados o a próximos, según su fecha.
- **Próximos turnos:** ocurrencias no canceladas e impagas de hoy en adelante, de series y sesiones únicas, hasta el mismo tope que el cobro ([Pagos](#pagos): 8 semanas). Un turno de **hoy** con asistencia ("Realizado" o "Ausente") sigue en próximos hasta mañana: la fecha separa las dos secciones (propuesta pendiente de confirmación de las PO, punto 6 de "Puntos a confirmar" del Sprint 3). **Nunca son deuda:** no suman al total, pero se pueden cobrar por adelantado.
- **Importe:** el precio por hora **vigente** de la materia. Si el gerente cambia el precio, los turnos impagos muestran el precio nuevo; lo ya pagado conserva el importe que se cobró. Una materia sin precio muestra el turno sin importe y no suma al total.
- **Dos secciones, en las dos vistas:** "Turnos adeudados" y "Próximos turnos" se muestran por separado, tanto en la cuenta de un alumno como en la vista global (de todos los alumnos, o de uno). Hoy las separa: una ocurrencia nunca está en las dos.
- **Filtros:** período (desde y hasta, cada uno opcional y sin tope de días), una o más materias y profesor en las dos vistas; en la global, además, el alumno. Para cobrar una o varias materias completas (HU-25) se eligen en el filtro de materias y se seleccionan todos sus turnos, adeudados y próximos; no hay filtro por meses ni por tipo de turno.
- **Sin período:** los adeudados son todos los impagos anteriores a hoy y los próximos van de hoy al tope de cobro.
- **Con período:** cada sección muestra la parte del período que le toca.
  - Adeudados: del período, pero nunca hoy ni después. Si el período es sólo futuro (empieza hoy o después), la sección **no aplica**.
  - Próximos: del período, pero nunca antes de hoy ni después del tope de cobro. Si el período es sólo pasado (termina antes de hoy), la sección **no aplica**. Si es futuro pero empieza después del tope, aplica y queda vacía: la pantalla avisa hasta qué fecha se puede cobrar.
  - Una sección que no aplica no se muestra como "sin turnos": no tiene nada que ver con ese período.
- **Total adeudado:** la suma de los importes de los turnos adeudados de **todos** los filtros (alumno, período, materia y profesor): con un período es la deuda de ese período. En la vista global es el de todos los adeudados del filtro, no sólo el de la página. Con un período sólo futuro es $ 0, aunque haya próximos turnos con importe.
- Los importes y los totales los calcula siempre la API; la UI sólo los muestra.

## Tablero

HU-21 (T-61). Indicadores del centro para el gerente, de un período (desde y hasta, obligatorios, de hasta 366 días). Es de sólo lectura y sólo muestra agregados: nunca la agenda, la ficha de un alumno ni un pago puntual. Nada se guarda: cada número se calcula al consultarlo.

- **Turnos por estado:** los turnos del período (cada turno en cada fecha), incluidos los cancelados, con su cantidad y su porcentaje sobre el total: cancelados, sin registrar (pasados y no cancelados) y agendados (no cancelados, de hoy en adelante). Los agendados sólo se informan si el período incluye hoy o fechas futuras.
- **Asistencia:** "Asistió", "No asistió" y "alumnos atendidos" dependen de la asistencia (HU-22, próximo sprint). Se informan como **no disponibles**, sin número, y no se reemplazan por otra cuenta (por ejemplo, los turnos pasados no cancelados).
- **Profesores con más turnos:** los 5 con más turnos **no cancelados** en el período, con su cantidad: cada turno es un alumno que cursa en una hora del profesor, así que es el profesor con más alumnos. No depende de la asistencia. En empate, por apellido y nombre.
- **Clase:** una hora de un profesor en una fecha con al menos un turno no cancelado (la clase de HU-19). Una hora del horario sin turnos, o con todos cancelados, no es una clase.
- **Ocupación:** turnos no cancelados del período sobre la capacidad total de sus clases. La capacidad de cada clase es la capacidad efectiva de esa hora (la menor entre la del profesor y la del aula, HU-06) **al momento de consultar**, y cuenta una vez por clase, tenga uno o varios alumnos. No se recorta a 100 %: si a un profesor o a un aula le bajaron la capacidad después, el porcentaje real puede superarlo.
- **Alumnos nuevos:** los dados de alta dentro del período, en hora de Salta (de las 00:00 del primer día a las 24:00 del último). Cuentan aunque después se hayan dado de baja.
- **Materias con más demanda:** las 5 con más turnos **no cancelados** en el período, con su cantidad. En empate, por nombre.
- **Total cobrado:** la suma de los pagos vigentes con **fecha de pago** dentro del período (no la fecha en que se cargaron).
- **Total adeudado:** la deuda **a la fecha** (hoy), de todos los alumnos: no depende del período elegido. Es la misma de [Deuda](#deuda) y coincide con el total de la vista global "Pagos" sin filtros.
- **Porcentajes:** de 0 a 100 con un decimal; si no hay sobre qué calcular, 0.

## Exámenes

HU-17 (T-55; modelo de datos: T-29). Registrar un examen es cargar un `Examen` de un alumno en una materia, con `tipo` (`PARCIAL`, `FINAL`, `RECUPERATORIO`, `TRABAJO_PRACTICO` u `OTRO`); "eliminar" (HU-17) es darlo de baja (`estado`), nunca borrarlo.

- **Un examen pendiente por materia:** el alumno no puede tener dos exámenes `ACTIVO` de la misma materia con fecha `>= hoy` a la vez. Al intentar cargar o mover uno a esa situación, la API responde 409 `EXAMEN_PENDIENTE` con el existente, para ofrecer editarlo en vez de duplicarlo. Un examen pasado no cuenta: pasada su fecha, se puede cargar el siguiente de la misma materia sin límite.
- **Fecha pasada:** se acepta igual (por ejemplo, para dejar registrado un examen que ya se tomó); la API lo marca con `pasado: true` para que el front avise, pero no lo rechaza.
- **Materia activa:** no se puede cargar ni mover un examen a una materia inactiva (409 `MATERIA_INACTIVA`).
- **Materia con turnos próximos:** un examen nuevo sólo se puede cargar en una materia en la que el alumno tenga algún turno vigente (activo y con al menos una fecha no cancelada de hoy en adelante); si no, 409 `MATERIA_SIN_TURNOS`. El profesor, además, sólo en las de los turnos que el alumno tiene con él. Un examen ya cargado conserva su materia aunque el alumno deje de tener turnos en ella: se puede seguir editando y dando de baja.
- **Profesor:** sólo puede cargar, editar o dar de baja un examen de una materia que le dicta a ese alumno (`materiasDelProfesorConAlumno`, T-29/T-30); de una materia que no le dicta a ese alumno, 403. Mesa de entradas no tiene esta restricción.
- **Trazabilidad con rol:** a diferencia del resto de las entidades (sólo `createdBy`/`updatedBy`), un examen muestra también el **rol** de quien lo cargó y de quien lo modificó (`MESA_ENTRADAS` o `PROFESOR`), para distinguir un examen cargado por el profesor de uno cargado por mesa.
- De él depende la prioridad del turno (HU-18, más abajo): un examen dado de baja deja de contar en la próxima consulta, porque la prioridad no se persiste.

## Prioridad

HU-18. La prioridad de un turno es de cada **ocurrencia** (un turno en una fecha) y la calcula la API; no se carga a mano.

- Se toma el **próximo examen `ACTIVO` del mismo alumno y la misma materia** del turno, con fecha igual o posterior a la de la ocurrencia. Los exámenes anteriores a la ocurrencia y los dados de baja no cuentan.
- Días hasta el examen = fecha del examen − fecha de la ocurrencia, en días de calendario.
- **Alta** de 0 a 10 días (un examen el mismo día de la ocurrencia es Alta), **Media** de 11 a 20 y **Baja** con más de 20 días o si no hay examen próximo en esa materia.
- En una serie recurrente cada ocurrencia tiene su propia prioridad: el mismo examen puede dar Baja a una ocurrencia lejana y Alta a una cercana.
- Junto con la prioridad se informa el examen que la determina (fecha, tipo, materia y días que faltan). Una Baja por lejanía también lo trae; sin examen próximo, no.
- Las ocurrencias canceladas no tienen prioridad.
- La prioridad **no se guarda**: se calcula en cada consulta, así que cargar, modificar o dar de baja un examen la cambia en la próxima consulta.

## Asistencia

A completar por T-81 (HU-22): quién la registra, plazo, campos, horas seguidas, corrección y cierre.

## Historial académico

HU-31 y HU-33 (T-108). El historial es **una lectura**: no tiene datos propios ni se guarda. Son las clases ya dadas del alumno, una por hora, con el estado, la asistencia y la cancelación que ya definen Asistencia y Turnos. Es de **sólo lectura**: la asistencia se registra y se corrige sólo desde HU-22.

- **Dónde se ve:** mesa de entrada, en la ficha del alumno; el profesor, desde "Mis alumnos" (sólo los alumnos que tienen o tuvieron turnos con él, y de ellos ve el historial **completo**: también las clases de otras materias y de otros profesores, para entender su situación global); el alumno, en "Mis materias" del portal.
- **Agrupado por materia y profesor** ("Matemática — Prof. Gómez"), porque un alumno puede cursar la misma materia con más de un profesor. Cada grupo tiene su propio resumen.
- **Resumen de un grupo:** clases realizadas, ausencias y porcentaje de asistencia (realizadas sobre realizadas más ausencias, con un decimal). **Cada hora cuenta como un turno.** Los **cancelados**, los **sin registrar** y los **agendados no cuentan** para el porcentaje, que es 0 cuando no hay ninguna realizada ni ausente.
- **Las horas seguidas se muestran juntas** (ajuste del 14/10, ver `decisiones.md`): un bloque por día con el estado de **cada** hora y "Qué se trabajó" e "Indicaciones para la próxima sesión" **una sola vez**; si una hora tiene otros textos (porque se corrigió sola), se muestran también los suyos. Una hora cancelada **corta** el bloque y se muestra sola, con su motivo (HU-13). Cada hora sigue contando por separado.
- **Una clase cerrada por el sistema** (un "Sin registrar" con el plazo vencido, HU-22) se muestra con su observación, y se distingue de un "Sin registrar" que todavía está dentro del plazo.
- **Sólo clases de hoy o anteriores:** los turnos futuros no son historial, están en los turnos del alumno. Una clase **de hoy** todavía sin asistencia se ve "Agendado" en la ficha, y **no se le muestra al alumno** (decisión T-148).
- **Orden:** de la clase más reciente a la más antigua.
- **Período:** un mes (por defecto, el mes en curso) o un rango de fechas, de hasta 366 días (decisión T-147). En el portal, siempre un mes.
- **Filtros de la ficha:** materia y profesor. Sus opciones son las del historial **completo** del alumno, no las del período que se está viendo.
- **"Mis materias" del alumno:** cada materia y profesor en los que tiene o tuvo turnos, con su próximo turno (la primera clase no cancelada de hoy en adelante, hasta 366 días, decisión T-149) y su porcentaje sobre todo su historial. Al entrar a una materia, primero las "Indicaciones para la próxima clase" (las de la última clase realizada con indicaciones, de **cualquier** fecha) y debajo las clases del mes.
- **El alumno no ve** las observaciones internas de la ficha ni la observación de la ausencia, el motivo de la cancelación, ni datos de otros alumnos. Tampoco las clases "Sin registrar" (decisión T-148, _pendiente de confirmación de las PO_: punto 8 de "Puntos a confirmar" del Sprint 3).
- **Desde cada clase se abre el detalle del turno**, que es donde se registra y se corrige la asistencia (HU-22).
- El PDF mensual del historial es HU-32 (T-110).

## Portal del alumno

El alumno (o su familia) entra al portal con una cuenta propia. La convención de sus endpoints está en `contrato-api.md` → Portal del alumno; la contraseña y su cambio, abajo (HU-28).

- **Cada alumno tiene una sola cuenta** y **cada persona, un solo usuario por DNI**: si el DNI ya tiene usuario (por ejemplo, el de un profesor que además toma clases), el alta del alumno se rechaza. _Pendiente de confirmación de las PO_ (punto 10 de "Puntos a confirmar" del Sprint 3).
- **El usuario lo genera el sistema** y no se escribe a mano: inicial del nombre + apellido + últimos 3 dígitos del DNI, en minúsculas, sin espacios ni tildes y con la "ñ" como "n" (Juan Pérez, DNI 45.123.456 → `jperez456`). Si ya está tomado, se agrega un número al final (`jperez456-2`).
- **El usuario no cambia nunca**, aunque después se corrija el nombre o el apellido: es el dato con el que el alumno ingresa. El nombre que muestra la sesión sí se sincroniza con el del alumno.
- **La contraseña inicial es el DNI del alumno**, sin puntos, y queda marcada como inicial mientras siga siendo la que puso el sistema (el portal recomienda cambiarla, HU-28). No se muestra ni se devuelve nunca.
- **Cambiar la contraseña** (el alumno, desde "Configuración" en el portal, HU-28): pide la actual, la nueva y repetirla. La nueva tiene al menos 8 caracteres y no puede ser la actual ni su DNI. Si la actual no es correcta, no cambia nada. Al cambiarla deja de estar marcada como inicial (el portal deja de recomendar cambiarla) y la sesión sigue abierta.
- **Restablecer la contraseña** (mesa de entradas) la vuelve a dejar en el DNI y marcada como inicial. Es la forma de resolver un olvido: no hay recuperación por email. Queda registrado quién la restableció y cuándo, igual que quién creó el acceso.
- **Fuera de alcance en este incremento:** recuperación por email, y baja o reactivación del acceso.

## Comprobante adjunto

HU-24 (T-95). El **comprobante adjunto** es el archivo que trae la familia (la imagen o el PDF de la transferencia, o la foto del cupón de débito) y respalda el cobro. No es el comprobante de pago que emite el centro (HU-15): la UI los nombra siempre distinto.

- **Qué pagos lo llevan:** los por **transferencia** (obligatorio) y con **tarjeta de débito** (opcional). Uno en efectivo no lleva.
- **El archivo:** JPG, PNG o PDF de hasta 5 MB. La API verifica también el contenido, no sólo la extensión.
- **Se sube antes de registrar el pago**, así el formulario lo muestra en vista previa y el pago se registra todo junto; queda vinculado al registrarlo. Sólo lo puede vincular quien lo subió, y a un solo pago. Uno que se subió y nunca se vinculó (el pago no se registró) queda guardado y no se muestra en ningún lado.
- **Se ve el último:** el detalle del pago muestra el último comprobante adjunto activo, con quién lo adjuntó y cuándo, y se abre en otra pestaña. Lo ven mesa de entrada y el gerente; **el alumno no**.
- **Reemplazar** adjunta uno nuevo y **conserva el anterior** (nada se borra); se muestra sólo el último. En un pago con débito sin comprobante (nunca tuvo, o se quitó), reemplazar lo adjunta.
- **Quitar** sólo se puede en un pago **con débito**, donde es opcional: el comprobante deja de mostrarse, pero la fila y el archivo se conservan, con quién lo quitó y cuándo (baja lógica, decisión T-136). En uno por transferencia no se puede quitar: se reemplaza.
- **Un pago anulado** (HU-42) conserva su comprobante como estaba: se sigue viendo y no se reemplaza ni se quita.

## Anulación de pagos

HU-42 (T-104). Es la anulación que HU-13, HU-14 y HU-15 dejaron fuera de alcance.

- **Quién:** mesa de entrada, de forma directa, sin aprobación del gerente ni plazo máximo.
- **Qué se anula:** el pago **completo**, nunca un turno suelto ni una parte. No se deshace: un pago anulado no se puede volver a activar (409 `PAGO_ANULADO`); si hay que cobrar de nuevo, se registra un pago nuevo.
- **Motivo:** `ERROR_CARGA`, `FORMA_PAGO_EQUIVOCADA` u `OTRO`. El detalle (hasta 500 caracteres) es obligatorio con `OTRO`.
- **Efecto:** el pago pasa a `ANULADO` y se registra su anulación (motivo, detalle, quién y cuándo); sus ocurrencias dejan de tener un pago vigente (`PagoTurno.vigente = null`), así que **vuelven a estar pendientes de pago** y se pueden cobrar de nuevo al precio vigente. Los turnos pasados vuelven a ser deuda (con 30 días o más, deuda vencida: HU-29); los futuros vuelven a ser próximos.
- **Nada se borra:** el pago conserva todos sus datos, su forma de pago y su comprobante adjunto (que ya no se reemplaza ni se quita). Su comprobante de pago en PDF se sigue consultando con la leyenda "ANULADO", el motivo y la fecha. El número de comprobante no se reutiliza.
- **Avisos al confirmar** (informan, no bloquean): el alumno quedaría con deuda vencida; el precio vigente de una materia es distinto del cobrado (los turnos se volverán a cobrar al vigente); otros pagos vigentes comparten la misma transferencia (misma operación y banco), que **no** se anulan con éste.
- **Concurrencia:** anular toma el mismo lock del alumno que pagar, cancelar, finalizar y reprogramar, así que dos anulaciones del mismo pago, o una anulación y un cobro de las mismas ocurrencias, se ordenan; el único de `PagoTurno` sigue siendo la red contra el pago doble.
- **Fuera de alcance:** anulación parcial, "Anular y volver a cobrar" en un solo paso, anulación conjunta de los pagos de una misma transferencia y registro de devolución de dinero.

## Notas de exámenes

HU-34 y HU-35 (T-106).

- **Quién:** mesa de entrada y el profesor, con las reglas de HU-17: el profesor sólo carga la nota de los exámenes de las materias que le dicta a ese alumno. El profesor ve todos los exámenes del alumno.
- **Cuándo:** sólo de un examen **ya rendido**, con fecha de hoy o anterior. Un examen futuro no admite nota.
- **Resultado:** "Con nota", con una nota de 1 a 10 con hasta dos decimales, o "Ausente", sin nota. Un ausente no cuenta para los promedios.
- **Corrección:** cargar y corregir siguen las mismas reglas. La nota tiene su propia trazabilidad: quién la cargó y quién la modificó por última vez, con fecha, hora y rol. Cargar o corregir la nota no cambia la auditoría del examen.
- **Rendidos sin nota:** la ficha avisa cuántos exámenes ya rendidos no tienen nota cargada.
- **Portal (HU-35):** el alumno ve, por materia, su próximo examen con los días que faltan, los rendidos del más reciente al más antiguo (la nota, "Ausente" o "Sin nota") y el promedio de sus notas sin los ausentes. No ve las observaciones ni quién cargó cada dato.

## Tope de deuda

- **Deuda vencida:** los turnos adeudados ([Deuda](#deuda)) con fecha de hace **30 días o más** (`DIAS_DEUDA_VENCIDA`): con hoy 05/10, el turno del 05/09 está vencido y el del 06/09 todavía no. Se calcula al consultar, con la misma regla que la deuda: es la parte de los adeudados del alumno que cumple esa fecha, con su cantidad de turnos (también los de materia sin precio) y su total (los sin precio no suman).

- **Bloquea sacar turnos nuevos** (HU-29, amplía HU-08): un alumno con deuda vencida no puede sacar un turno, ni de una sola clase ni semanal, ni desde el portal ni desde la mesa de entrada. No hay excepciones manuales en este incremento.
- **Se calcula en el momento de sacar el turno**, con la misma regla que la cuenta del alumno: alcanza con pagar los turnos adeudados de 30 días o más para volver a sacar turnos; una deuda más reciente no bloquea, y los próximos turnos impagos no son deuda.
- **No afecta lo que ya tiene:** sus turnos siguen como están, y se pueden cancelar y reprogramar (HU-13, HU-20).
- **Mensajes:** a la mesa de entrada, con la cantidad y el total ("El alumno tiene deuda de más de 30 días (3 turnos · $ 24.000). Debe regularizar el pago para agendar turnos nuevos"); al alumno, sin importes ("Tenés clases adeudadas de hace más de 30 días. Para sacar un turno nuevo, regularizá el pago en la mesa de entrada"). El portal se lo avisa al entrar a "Sacar turno", antes del paso 1, y el alta lo vuelve a comprobar al confirmar.

## Reparto y liquidaciones (modelo)

HU-43 a HU-47 (tarea T-118). Qué se guarda y para qué; los términos (reparto, devengo, ajuste, saldo, estados) son los del [Vocabulario de la ampliación](sprint-3/sprint-3.md#vocabulario-de-la-ampliación), y las reglas, las de cada tarea.

- **`PorcentajeCentro`:** el historial del porcentaje que retiene el centro. Cada cambio es una fila nueva (desde cuándo rige y quién lo cambió); el vigente es el último. No se edita (decisión T-151).
- **`PagoTurno.porcentajeCentro`:** el porcentaje vigente al registrarse el pago, guardado en cada cobro de un turno. Las partes del centro y del profesor no se guardan: salen de este porcentaje y el importe cobrado (decisión T-151).
- **`Liquidacion`:** la liquidación **cerrada** de un profesor en un mes, `PAGADA` (con la fecha y el número de operación de la transferencia) o `DESCONTADA` (su saldo lo absorbió otra liquidación). Guarda los totales congelados y quién registró el pago y cuándo. Un mes se cierra una sola vez; una liquidación sin pagar no tiene fila: se calcula al consultarla (decisión T-152).
- **`LiquidacionTurno`:** cada turno de una liquidación cerrada, con su fecha de devengo, importe, porcentaje y parte del profesor congelados. Un cobro se liquida una sola vez (decisión T-153).
- **`AjusteLiquidacion`:** un ajuste aplicado en una liquidación cerrada, por la anulación de un turno ya liquidado o por el saldo de una liquidación anterior. Cada turno anulado y cada saldo se descuentan una sola vez (decisión T-153).
- **Comprobante de la transferencia:** un `ComprobanteAdjunto` vinculado a la liquidación en lugar de a un pago, con las reglas de [Comprobante adjunto](#comprobante-adjunto) (decisión T-154).

## Auditoría

Todas las entidades registran quién las creó y quién las modificó por última vez, y cuándo (`createdById`, `updatedById`, `createdAt`, `updatedAt`).
