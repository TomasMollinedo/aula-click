**ID:** HU-02 | **Sprint:** 2
**Título:** Gestión de Datos del Alumno (Alta, Edición, Listado y Búsqueda)
**Como…** Personal de mesa de entrada
**Necesito…** Registrar un nuevo alumno con sus datos identificatorios, de contacto, escolares, editarlos cuando cambien, y encontrarlo rápidamente desde el listado de alumnos.
**Para…** Contar con la información necesaria para ubicar, contactar y acompañar a cada alumno del centro y encontrar rápidamente su ficha.
**Criterios de Aceptación:**

- El módulo "Alumnos" muestra el listado de todos los alumnos registrados. Como no se contempla la baja lógica de alumnos, el listado no tiene filtro por estado.
- El listado muestra sólo apellido y nombre de cada alumno, ordenado alfabéticamente por apellido; el resto de los datos se ve en el detalle.
- El listado tiene un buscador por coincidencia parcial de DNI, nombre o apellido (por ejemplo, "gonz" encuentra a "González"); no distingue mayúsculas/minúsculas ni tildes.
- Si la búsqueda no tiene coincidencias, el sistema lo indica y ofrece la opción de dar de alta un nuevo alumno.
- Al seleccionar un alumno del listado se abre su detalle con todos sus datos: identificatorios, de contacto, del tutor (si corresponde), escolares, observaciones y sus turnos.
- El mismo buscador está disponible en la pantalla de registrar turno (HU-08).
- El alta se accede desde el módulo "Alumnos" mediante un botón "+ Nuevo alumno".
- Datos obligatorios para el alta: nombre, apellido, DNI y fecha de nacimiento; si el alumno es mayor de edad, también su email y su teléfono. Si el alumno es menor de edad, su email y su teléfono son opcionales, y son obligatorios nombre, apellido, teléfono y email de un tutor o responsable. El resto (datos escolares, colegio y observaciones) es opcional y puede cargarse en el alta o después desde la edición.
- Datos escolares: nivel de escolaridad (nivel y grado o año, por ejemplo "Primario – 5.º grado" o "Secundario – 3.er año"); colegio o institución al que asiste, opcional.
- Campo "Observaciones": texto libre, opcional, para registrar información relevante del alumno (por ejemplo, si tiene déficit de atención u otra dificultad de aprendizaje).
- El DNI es único: si ya existe un alumno registrado con ese DNI, el sistema lo indica y no permite continuar con el alta.
- No se puede guardar el alta si falta algún dato obligatorio; el sistema resalta los campos incompletos (la institución educativa y las observaciones, al ser opcionales, no bloquean el guardado).
- Al guardar, el alumno aparece en el listado y queda disponible para que se le registren turnos.
- La edición de los datos (incluidos los escolares y las observaciones) se realiza desde el detalle del alumno, con un botón "Editar", con las mismas validaciones del alta. El DNI no se puede modificar: en la edición se muestra como dato de sólo lectura, y el sistema rechaza cualquier intento de cambiarlo. (Reemplaza el criterio "El DNI no puede editarse a un valor ya usado por otro alumno".)
- Si al editar la fecha de nacimiento el alumno pasa a ser mayor de edad y le falta su email o su teléfono, el sistema lo indica y no permite guardar hasta completarlos.
- El detalle muestra quién creó el registro y quién lo modificó por última vez (con fecha y hora).

**ID:** HU-03 | **Sprint:** 2
**Título:** Gestión de Datos Personales del Profesor (Alta, Edición, Listado y Búsqueda)
**Como…** Personal de mesa de entrada
**Necesito…** Registrar un nuevo profesor con sus datos personales y profesionales, editarlos, y encontrarlo rápidamente desde el listado de profesores.
**Para…** Mantener actualizado el plantel docente del centro y acceder rápidamente a la ficha de cada profesor para consultarla o editarla.
**Criterios de Aceptación:**

- El módulo "Profesores" muestra el listado de profesores; por defecto sólo muestra los profesores en estado "Activo".
- El listado permite filtrar por estado: "Activos" (por defecto), "Inactivos" y "Todos"; y también por materia asignada.
- El listado tiene un buscador por coincidencia parcial de DNI, nombre o apellido; no distingue mayúsculas/minúsculas ni tildes y se combina con los filtros seleccionados.
- El listado muestra sólo la foto (o un avatar genérico si no tiene), apellido, nombre y DNI de cada profesor, ordenado alfabéticamente por apellido, y su estado; el resto de los datos se ve en el detalle. Con el filtro "Todos", los inactivos se distinguen con una etiqueta "Inactivo".
- Si la búsqueda o los filtros no tienen coincidencias, el sistema lo indica y ofrece la opción de dar de alta un nuevo profesor.
- Al seleccionar un profesor del listado se abre su detalle con todos sus datos, su estado, sus materias asignadas (HU-05) y su horario de atención (HU-06) junto con su agenda.
- El alta se accede desde el módulo "Profesores" mediante un botón "+ Nuevo profesor".
- Datos obligatorios: nombre y apellido, DNI, teléfono, email, título, matrícula y capacidad (cantidad máxima de alumnos que el profesor puede atender a la vez en una misma hora; número entero mayor o igual a 1). Esta capacidad se usa para calcular la capacidad efectiva de cada hora de sus bloques (HU-06). También es obligatorio asignarle al profesor una contraseña para su inicio de sesión.
- Foto: opcional; se adjunta una imagen (JPG o PNG) que luego puede reemplazarse o quitarse desde la edición.
- El DNI y la matrícula son únicos entre profesores (tanto activos como inactivos); si ya existen, el sistema lo indica y no permite continuar.
- No se puede guardar el alta si falta algún dato obligatorio; el sistema resalta los campos incompletos (la foto, al ser opcional, no bloquea el guardado).
- Al guardar, el profesor queda en estado "Activo".
- La edición de datos se realiza desde la ficha del profesor, con un botón "Editar", con las mismas validaciones del alta. El DNI no se puede modificar: en la edición se muestra como dato de sólo lectura, y el sistema rechaza cualquier intento de cambiarlo.
- La capacidad no puede bajarse a un valor menor que la cantidad de turnos vigentes que el profesor tenga en alguna hora de sus bloques (HU-06); en ese caso el sistema lo indica y no permite guardar.
- El detalle muestra quién creó el registro y quién lo modificó por última vez (con fecha y hora).

**ID:** HU-08 | **Sprint:** 2
**Título:** Registrar Turno
**Como…** Personal de mesa de entrada
**Necesito…** Registrar un turno asignando un alumno a una o varias horas de un bloque de clase de un profesor, indicando la materia y si el turno se repite o es una sesión única.
**Para…** Reservar un espacio de atención para el alumno con el profesor correspondiente.
**Criterios de Aceptación:**

- Cada turno es una asignación que vincula un alumno con una hora de un bloque del profesor (HU-06).
- Se selecciona un alumno (mediante el buscador del listado de alumnos, HU-02).
- Para buscar horarios se usan tres filtros: materia (obligatorio; sólo materias activas), día de la semana y profesor (estos dos opcionales, se pueden combinar). Sólo se muestran profesores activos que tengan asignada la materia elegida (HU-05).
- Según los filtros elegidos, el sistema muestra los bloques que coinciden, cada uno con su horario completo (por ejemplo, "de 8:00 a 12:00"):
  - Materia y día: los profesores que dictan la materia y tienen un bloque ese día.
  - Materia y profesor: los días en que ese profesor tiene bloques.
  - Materia, día y profesor: los bloques de ese profesor ese día.
  - Sólo materia: todos los profesores que dictan la materia, con sus días.
- Al seleccionar un resultado (un profesor en un día), se muestran las horas de ese bloque, cada una con un checkbox y su ocupación (turnos vigentes / capacidad efectiva, HU-06). Las horas que no tienen lugar también se muestran con un mensaje aclarando que estan llenas.
- Se pueden tildar una o varias horas del bloque, consecutivas o no (por ejemplo, 8:00–9:00 y 10:00–11:00). Cada hora seleccionada se registra como un turno, todos con la misma materia, tipo de turno y fechas.
- El turno se da en el aula asignada al bloque (HU-06); el sistema muestra el aula al confirmar el turno y en el detalle del turno.
- Validación: la materia del turno debe ser una de las materias asignadas al profesor del bloque; si no lo es, el sistema no permite continuar.
- Tipo de turno, obligatorio: "Recurrente" (el alumno viene todas las semanas en esa hora; se indica fecha de inicio y, opcionalmente, fecha de fin) o "Sesión única" (se indica la fecha). Las fechas deben coincidir con el día de la semana del bloque.
- Validación de capacidad: la cantidad de turnos vinculados a cada hora del bloque no puede superar su capacidad efectiva (la menor entre la del profesor y la del aula, HU-06). La capacidad se controla para cada hora seleccionada y para cada fecha en que aplica el turno, contando los turnos recurrentes vigentes y las sesiones únicas de esa fecha en esa hora.
- Sesión única sin lugar: si una hora seleccionada está completa en la fecha elegida, el sistema lo indica, no permite registrar el turno en esa hora y ofrece la opción "Buscar otros turnos disponibles".
- Recurrente con fechas completas: si una hora tiene lugar en algunas fechas pero está completa en otras, el sistema muestra un mensaje que indica puntualmente qué fechas no tienen lugar (por ejemplo: "El lunes 12/10 la hora de 9:00 a 10:00 está completa") y ofrece dos opciones: "Asignar igual" y "Cancelar".
- "Asignar igual": se registra el turno recurrente únicamente en las fechas con lugar (la serie se guarda en tramos que saltean las fechas completas); no se guardan excepciones. En las fechas sin lugar el alumno no figura en esa hora del bloque ni ocupa lugar. Una vez asignado, el mensaje de éxito lista las fechas en las que no se agendó turno.
- "Cancelar": vuelve a la pantalla de buscar turnos disponibles.
- Si una hora no tiene lugar en ninguna fecha (por ejemplo, porque está completa con turnos recurrentes sin fecha de fin), el sistema lo indica y no permite registrar el turno recurrente en esa hora.
- Un alumno no puede tener dos turnos que se superpongan en fecha y horario.
- Campo "Observaciones": texto libre, opcional (reemplaza al campo "motivo de consulta" del Sprint 1).
- Campo "Temas a trabajar": texto libre; opcional si el turno es recurrente y obligatorio si es sesión única.
- Al confirmar, el turno queda en estado "Agendado", reflejado en la agenda del profesor (HU-10), en la ficha del alumno y en la agenda diaria del centro (HU-09).
- Cada turno registrado queda con fecha, hora y usuario de creación, visibles en el detalle del turno.

**ID:** HU-11 | **Sprint:** 2
**Título:** PDF de turno y agenda
**Como…** Personal de mesa de entrada
**Necesito…** Guardar como PDF el resumen de un turno y la agenda del día.
**Para…** Entregarle la información al alumno o profesor .
**Criterios de Aceptación:**

- El detalle de un turno y la agenda diaria del centro (HU-09) tienen un botón "generar PDF".
- Resumen del turno: nombre del centro, alumno (nombre, apellido y DNI), materia, profesor, aula, día y horario, tipo de turno con sus fechas (si es recurrente, el período completo de la serie), temas a trabajar (HU-08), fecha de emisión y usuario que lo emitió.
- Agenda del día: se imprime tal como se está viendo, con la fecha y los filtros aplicados indicados en el encabezado, y la lista de turnos con horario, alumno, profesor, materia, aula y estado.
- La salida muestra sólo el contenido, sin menú lateral, encabezado de la aplicación ni botones, en tamaño A4.
- Se puede guardar como PDF desde el diálogo de impresión del navegador.
- El PDF es un documento oficial del centro: lleva un encabezado con el logo, el nombre, la dirección y el teléfono del centro, y la fecha y hora de emisión. El mismo encabezado se usa en el comprobante de pago (HU-15). El logo y los datos del centro (nombre, dirección y teléfono) son fijos del sistema: vienen precargados y en este incremento no hay pantalla para editarlos.

**ID:** HU-12 | **Sprint:** 2
**Título:** Gestión de materias con precio (alta, edición, baja y reactivación)
**Como…** Gerente
**Necesito…** Registrar una materia con su precio por hora, editarla, darla de baja y reactivarla.
**Para…** Mantener actualizado el catálogo y que el sistema establezca el importe de cada turno al cobrarlo.
**Criterios de Aceptación:**

- Reemplaza a HU-04 (sprint 1) en cuanto a quién administra el catálogo: el ABM de materias pasa a ser exclusivo del gerente. El personal de mesa de entrada deja de ver los botones "+ Nueva materia", "Editar", "Dar de baja" y "Reactivar".
- El acceso del gerente al sistema (inicio de sesión y sección propia, HU-21) es requisito de esta HU, aunque el tablero de HU-21 sea opcional.
- El personal de mesa de entrada conserva el acceso de sólo lectura al módulo "Materias" (HU-01): puede listar, buscar y ver el detalle de cada materia con su precio y sus profesores asignados, porque lo necesita para registrar turnos (HU-08) y para cargar exámenes (HU-17).
- Asignar y quitar materias a un profesor (HU-05) sigue a cargo del personal de mesa de entrada: esta HU cambia quién administra el catálogo, no quién arma el plantel.
- El alta se hace desde el módulo "Materias" del menú del gerente, con el botón "+ Nueva materia".
- Datos obligatorios del alta: nombre y precio por hora de clase. La descripción es opcional.
- Nombre: único, sin distinguir mayúsculas/minúsculas ni tildes. Si ya existe otra materia con ese nombre, el sistema lo indica y no permite guardar.
- Precio por hora de clase: importe en pesos, mayor a 0, con hasta dos decimales.
- No se puede guardar el alta ni la edición si falta algún dato obligatorio; el sistema resalta los campos incompletos. La descripción, al ser opcional, no bloquea el guardado.
- Como toda materia tiene siempre un precio mayor a 0, cualquier materia activa se puede usar para registrar un turno (HU-08) y siempre hay un importe con el cual cobrarlo (HU-15).
- Materias creadas antes de este incremento: las que no tengan precio pasan a estado "Inactiva" y el listado las marca como "Sin precio". No se ofrecen para asignar a profesores (HU-05) ni para registrar turnos (HU-08) hasta que el gerente les cargue el precio y las reactive.
- La edición se hace desde el detalle de la materia, botón "Editar", con las mismas validaciones del alta. Se pueden modificar el nombre, la descripción y el precio.
- Cambiar el precio no modifica los pagos ya registrados ni los importes de los turnos ya cobrados: rige para los cobros que se registren a partir de ese momento (HU-15).
- El listado de materias muestra el nombre, el precio y el estado de cada una, y mantiene el filtro por estado y el buscador de HU-04.
- La baja es lógica, la hace sólo el gerente con confirmación, y mantiene la regla de HU-04: sólo se permite si la materia no tiene profesores asignados. Si los tiene, el sistema lo indica, muestra cuántos y cuáles son con enlace a la ficha de cada uno, y no permite la baja.
- Una materia inactiva muestra el botón "Reactivar" (con confirmación, sólo para el gerente). Al reactivarla vuelve a estar disponible para asignar a profesores (HU-05) y para registrar turnos (HU-08).
- El detalle muestra quién creó la materia y quién la modificó por última vez (con fecha y hora).
- El personal de mesa de entrada no puede crear, editar, dar de baja ni reactivar materias, cualquiera sea su precio: esas acciones son sólo del gerente. El único cambio que no hace el gerente es el automático de las materias sin precio al pasar a este incremento, que quedan inactivas hasta que el gerente les carga el precio y las reactiva.

**ID:** HU-13 | **Sprint:** 2
**Título:** Cancelar un turno
**Como…** Personal de mesa de entrada
**Necesito…** Cancelar el turno de un alumno en una fecha, indicando el motivo.
**Para…** Liberar el lugar para otro alumno y dejar registro de por qué no se dio.
**Criterios de Aceptación:**

- Se cancela el turno de un alumno en una fecha concreta, no la clase completa: los demás alumnos anotados en esa hora no se ven afectados.
- Desde el detalle del turno (agenda diaria del centro HU-09, agenda de un profesor, "Mi agenda" HU-10, calendario semanal HU-19 o turnos de la ficha del alumno HU-02), botón "Cancelar turno".
- Sólo se cancelan turnos impagos. El botón está visible únicamente si el turno está en estado "Agendado", su estado de pago es "Pendiente" y su fecha es hoy o posterior. No se puede cancelar un turno de una fecha pasada.
- Si el turno ya está pagado, el botón se muestra deshabilitado con la aclaración "El turno está pagado: no se puede cancelar". La anulación de pagos queda fuera de este incremento.
- El motivo es obligatorio y se elige de una lista: "Cancelación por el alumno", "Cancelación por el profesor", "Problema administrativo" u "Otro". Hay además un campo de detalle, de texto libre y opcional (hasta 500 caracteres), que pasa a ser obligatorio si el motivo es "Otro".
- Se pueden cancelar varios turnos a la vez desde los turnos de la ficha del alumno (HU-02), seleccionándolos con un checkbox. Sólo se ofrecen los que cumplen las condiciones de arriba: agendados, impagos y de hoy en adelante.
- El motivo y el detalle se cargan una sola vez y se aplican a todos los turnos seleccionados.
- Antes de cancelar, el sistema pide confirmación con el resumen de lo que se va a cancelar: si es un turno, sus datos (por ejemplo: "¿Cancelar el turno de Matemática de Ana Pérez del lunes 12/10 de 9:00 a 10:00?"); si son varios, la lista completa con fecha, horario, materia y profesor de cada uno, más la cantidad total.
- Se cancela todo junto o nada: si alguno de los turnos seleccionados dejó de poder cancelarse, el sistema lo indica y no cancela ninguno.
- Si el turno pertenece a una serie recurrente (HU-08), se cancela sólo la fecha elegida: los demás turnos de la serie siguen agendados. Para terminar la serie completa se usa "Finalizar turno" (HU-14).
- Si es una sesión única, cancelar el turno cancela la reserva.
- Al cancelar, el turno pasa a estado "Cancelado" y su lugar queda libre: esa hora vuelve a tener disponibilidad en esa fecha al registrar un turno (HU-08).
- El turno cancelado se sigue viendo, con su estado y color, en las agendas, en el detalle y en los turnos de la ficha del alumno (HU-02).
- El detalle del turno muestra el motivo, el detalle, quién lo canceló y cuándo (fecha y hora).
- Mensaje de éxito: "Turno cancelado. El lugar quedó disponible." Si fueron varios: "Se cancelaron N turnos. Los lugares quedaron disponibles."
- Fuera de alcance en este incremento: deshacer una cancelación, que el profesor cancele turnos desde su agenda y la condición de que el turno no tenga asistencia registrada (llega con la asistencia, HU-22, en el próximo sprint).

**ID:** HU-14 | **Sprint:** 2
**Título:** Finalizar un turno recurrente
**Como…** Personal de mesa de entrada
**Necesito…** Terminar una serie de turnos recurrentes a partir de una fecha.
**Para…** Reflejar que el alumno deja de venir sin tener que cancelar los turnos uno por uno.
**Criterios de Aceptación:**

- Desde el detalle de un turno recurrente vigente (HU-08), botón "Finalizar turno". No se ofrece en sesiones únicas ni en series que ya terminaron.
- Se indica la fecha desde la que el alumno deja de venir, es decir, el primer turno que ya no se da. Debe ser hoy o posterior, coincidir con el día de la semana de la serie y ser posterior a su fecha de inicio.
- El motivo es obligatorio, con la misma lista y el mismo campo de detalle que HU-13.
- Sólo se pueden liberar turnos impagos. Si hay turnos pagados (HU-15) desde la fecha elegida, el sistema lo indica, muestra cuáles son (fecha, horario e importe) y no permite finalizar desde esa fecha: hay que elegir una fecha posterior al último turno pagado. La anulación de pagos queda fuera de este incremento.
- Si el turno recurrente se guardó en varios tramos (HU-08), se finaliza el tramo desde cuyo detalle se opera. Antes de confirmar, el sistema avisa si hay tramos posteriores del mismo alumno, hora y materia; esos tramos no se modifican.
- Antes de confirmar, el sistema indica cuántos turnos se liberan (por ejemplo: "Se liberan 7 turnos, del 19/10 al 30/11") o, si la serie no tenía fecha de fin, "Se liberan todos los turnos desde el 19/10".
- Al confirmar, la serie termina en el último turno que se da: desde la fecha indicada deja de figurar en las agendas y libera su lugar para nuevos turnos (HU-08).
- Los turnos anteriores a esa fecha no cambian: conservan su estado y sus pagos.
- El detalle de la serie muestra "Finalizada el [fecha]" con el motivo, quién la finalizó y cuándo.
- Deja de contar como turno vigente desde el día siguiente a su último turno, de modo que ya no impide quitarle la materia al profesor (HU-05), darlo de baja (HU-07) ni editar o eliminar el bloque (HU-06).

**ID:** HU-15 | **Sprint:** 2
**Título:** Registrar el pago de un turno
**Como…** Personal de mesa de entrada
**Necesito…** Registrar el pago de un turno con su forma de pago.
**Para…** Llevar el control de lo cobrado.
**Criterios de Aceptación:**

- Reglas generales
- Se cobra por turno: cada alumno paga su turno, aunque comparta la clase con otros alumnos.
- Cada turno tiene un estado de pago independiente de su estado (Agendado, Sin registrar o Cancelado): "Pendiente" (por defecto) o "Pagado". Por ejemplo, un turno puede estar "Sin registrar" y "Pendiente". Los estados "Realizado" y "Ausente" no existen en este incremento: llegan con la asistencia (HU-22), en el próximo sprint.
- El importe de cada turno es el precio por hora vigente de su materia (HU-12) al momento de registrar el pago; no se modifica a mano.
- Un pago corresponde a un solo alumno y puede incluir uno o varios de sus turnos. Genera un único comprobante.
- Desde dónde se registra un pago
- Desde el detalle de un turno, botón "Registrar pago": el pago incluye sólo ese turno. El botón se ofrece sólo si el turno no está cancelado y está "Pendiente".
- Desde la vista global "Pagos" (HU-16): para seleccionar varios turnos hay que filtrar primero por un alumno. Sin filtro, "Registrar pago" se usa de a un turno.
- Qué turnos se pueden incluir
- Turnos del alumno en estado "Agendado" o "Sin registrar" (agendado de una fecha anterior a hoy), con pago "Pendiente".
- Se pueden cobrar turnos pasados y futuros (pago adelantado). De una serie recurrente se ofrecen los turnos de las próximas 8 semanas.
- No se pueden incluir turnos cancelados ni turnos ya pagados.
- Hay opciones para seleccionar todos los adeudados y para quitar la selección.
- Formulario de pago
- Muestra el resumen de los turnos seleccionados: fecha, horario, materia, profesor e importe de cada uno, y el total, que se calcula solo.
- Forma de pago: efectivo, único medio de pago en este incremento.
- Monto recibido: en efectivo se puede ingresar el monto recibido. Es opcional; si se ingresa, debe ser un importe en pesos con hasta dos decimales y mayor o igual al total. El sistema calcula y muestra el vuelto (monto recibido menos total); el vuelto no se guarda.
- Fecha de pago: obligatoria, por defecto hoy, no puede ser futura.
- Observaciones: opcional, hasta 500 caracteres.
- No se puede confirmar si falta algún dato obligatorio; el sistema resalta los campos incompletos.
- Confirmación y resultado
- Antes de guardar, el sistema pide confirmación con la cantidad de turnos, el total y la forma de pago (por ejemplo: "¿Registrar el pago de 4 turnos por $ 32.000 en efectivo?").
- El pago se registra todo junto o nada: si alguno de los turnos seleccionados dejó de poder cobrarse (por ejemplo, otro usuario ya lo cobró o lo canceló), el sistema lo indica y no registra el pago.
- Al guardar, todos los turnos incluidos pasan a "Pagado" y quedan vinculados al mismo pago.
- Mensaje de éxito: "Pago registrado: 4 turnos por $ 32.000", con la opción "Imprimir comprobante". Si se ingresó monto recibido, el mensaje muestra también el vuelto (por ejemplo: "Vuelto: $ 3.000").
- El detalle de cada turno pagado muestra el importe, la forma de pago con sus datos, la fecha, el número de comprobante y quién registró el pago.
- Comprobante
- Cada pago tiene un número de comprobante correlativo que no se repite.
- El comprobante incluye: nombre del centro, número de comprobante, fecha de pago, alumno (nombre, apellido y DNI), el detalle de cada turno incluido (fecha, horario, materia, profesor e importe), el total, la forma de pago con sus datos, el monto recibido y el vuelto (si se ingresó monto recibido) y el usuario que registró el pago.
- Se guarda como PDF desde el diálogo de impresión del navegador, con el mismo formato de salida que HU-11 (sólo el contenido, tamaño A4).
- Relación con otras operaciones del turno
- Un turno pagado no se puede cancelar (HU-13) ni liberar al finalizar su serie (HU-14). La anulación de pagos queda fuera de este incremento.
- Si un turno pagado se reprograma (HU-20), el pago acompaña a la fecha movida y no hay que registrarlo de nuevo. En una serie recurrente, el pago de esa fecha pasa al turno reprogramado, en su nuevo horario.
- Al registrar un pago, se actualizan el total adeudado y el pagado del mes del alumno, y la vista global de pagos (HU-16).
- Fuera de alcance en este incremento
- Pagos parciales de un turno, descuentos, reembolsos, anulación de pagos, otras formas de pago además del efectivo y pagos que incluyan turnos de más de un alumno.

**ID:** HU-16 | **Sprint:** 2
**Título:** Pagos y deuda del alumno
**Como…** Personal de mesa de entrada
**Necesito…** Ver los pagos de un alumno y lo que tiene pendiente.
**Para…** Cobrar lo adeudado y responder las consultas del alumno o su familia.
**Criterios de Aceptación:**

- Los importes se calculan con el precio por hora vigente de la materia de cada turno (HU-12), el mismo que se usa al registrar el pago (HU-15).
- Turnos adeudados
- Se listan los turnos del alumno con pago "Pendiente" cuya fecha ya pasó y que están en estado "Sin registrar" (turno "Agendado" de una fecha anterior a hoy; la asistencia se registra en el próximo sprint, HU-22).
- Los turnos "Sin registrar" generan deuda, porque el lugar del alumno estuvo reservado para esa clase y para que la deuda no dependa de que se haya cargado la asistencia.
- Los turnos "Cancelado" no forman parte de la deuda.
- Cada turno adeudado muestra, como mínimo: fecha, horario, materia, profesor, estado del turno (Sin registrar) e importe.
- Se ordenan del más antiguo al más reciente.
- Próximos turnos (pago adelantado)
- Debajo de los adeudados se listan los próximos turnos del alumno con pago "Pendiente": turnos "Agendado" de hoy en adelante, incluidos los de sus series recurrentes de las próximas 8 semanas (HU-15).
- Cada uno muestra fecha, horario, materia, profesor e importe.
- Estos turnos no suman al total adeudado: sólo se muestran para poder cobrarlos por adelantado.
- Registrar un pago desde la pestaña
- Cada turno adeudado y cada próximo turno tiene una casilla de selección. Hay opciones para seleccionar todos los adeudados y para quitar la selección.
- Al seleccionar turnos se muestran la cantidad y el total de lo seleccionado (por ejemplo: "4 turnos seleccionados · $ 32.000").
- El botón "Registrar pago" abre el flujo de HU-15 con los turnos seleccionados. Sin ningún turno seleccionado, el botón está deshabilitado.
- Cada turno tiene además su propia acción "Registrar pago", que abre el flujo de HU-15 sólo con ese turno.
- Vista global "Pagos"
- El menú del personal de mesa de entrada tiene la opción "Pagos", con los turnos adeudados de todos los alumnos (mismo criterio que "Turnos adeudados").
- Arriba se muestra el total adeudado de todos los alumnos.
- El listado muestra, como mínimo: alumno, fecha, horario, materia, profesor, estado del turno (Sin registrar), importe y la acción "Registrar pago" (HU-15, con ese turno).
- Se ordena por fecha, del más antiguo al más reciente, y está paginado.
- Se puede filtrar por alumno con el buscador de alumnos (HU-02). Al filtrar por un alumno, se listan sólo sus turnos adeudados y se habilitan las casillas de selección para cobrar varios juntos, igual que en la pestaña del alumno. Sin filtro, el cobro es de a un turno, porque un pago corresponde a un solo alumno.
- Cada fila tiene un enlace a la ficha del alumno.
- Permite consultar la deuda de distintos alumnos sin entrar al detalle de cada uno.
- Actualización de la información
- Al registrar un pago (HU-15), sus turnos dejan de aparecer como adeudados o próximos pendientes, y se actualizan el total adeudado, el pagado del mes y la vista global.
- Al cancelar un turno (HU-13) o finalizar una serie (HU-14), los turnos liberados dejan de aparecer.
- Si se cambia el precio de una materia (HU-12), los importes de los turnos todavía no pagados se muestran con el precio nuevo.
- Sin información
- Si el alumno no tiene deuda, turnos pendientes ni pagos registrados, la pestaña muestra "Sin pagos registrados".
- Si no hay deuda pero sí pagos, se muestra el historial con el total adeudado en $ 0.

**ID:** HU-17 | **Sprint:** 2
**Título:** Registrar exámenes del alumno
**Como…** Personal de mesa de entrada
**Necesito…** Cargar las fechas de examen de un alumno por materia.
**Para…** Saber cuándo necesita más apoyo y que el sistema calcule la prioridad de sus turnos.
**Criterios de Aceptación:**

- El personal de mesa de entrada carga los exámenes desde la ficha del alumno (HU-02), pestaña "Exámenes", botón "+ Nuevo examen".
- El profesor también carga exámenes, desde "Mis alumnos" → detalle del alumno → pestaña "Exámenes", con el mismo formulario y las mismas validaciones. Sólo se le ofrecen las materias que le dicta a ese alumno.
- Datos: materia (obligatoria; se elige del catálogo de materias activas, HU-12), fecha (obligatoria), tipo (obligatorio: "Parcial", "Final", "Recuperatorio", "Trabajo práctico" u "Otro") y observaciones (opcional, hasta 500 caracteres).
- Un examen vigente por materia: el alumno no puede tener más de un examen pendiente (fecha igual o posterior a hoy) en la misma materia. Si ya tiene uno y se intenta cargar otro, el sistema lo indica, muestra el existente con su tipo y su fecha, y ofrece editarlo en lugar de crear uno nuevo.
- Los exámenes ya rendidos no cuentan para esa restricción: una vez que la fecha quedó atrás, se puede cargar el siguiente examen de esa materia.
- La fecha puede ser pasada (para registrar un examen ya rendido), pero el sistema avisa si lo es.
- La pestaña muestra primero los próximos exámenes, ordenados por fecha, cada uno con cuántos días faltan ("en 5 días", "hoy"), y después los pasados, separados.
- Cada examen se puede editar (con las mismas validaciones) y eliminar (con confirmación). El profesor sólo puede editar y eliminar los exámenes de las materias que le dicta a ese alumno; el personal de mesa de entrada puede hacerlo con cualquiera.
- Los exámenes se usan para calcular la prioridad de los turnos del alumno (HU-18): al cargar, editar o eliminar un examen, la prioridad se actualiza sola.
- Cada examen muestra quién lo cargó y quién lo modificó por última vez, con su rol, la fecha y la hora, para distinguir si lo registró mesa de entrada o el profesor.

**ID:** HU-18 | **Sprint:** 2
**Título:** Prioridad del turno
**Como…** Usuario del sistema (personal de mesa de entrada o profesor)
**Necesito…** Ver la prioridad de cada turno según la proximidad del examen del alumno en esa materia.
**Para…** Atender primero a quien rinde antes.
**Criterios de Aceptación:**

- La prioridad no se carga a mano: el sistema la calcula para cada turno a partir de los exámenes del alumno (HU-17).
- Se toma el próximo examen del alumno en la misma materia del turno, con fecha igual o posterior a la fecha del turno. Los exámenes anteriores al turno no cuentan.
- Días hasta el examen = fecha del examen − fecha del turno. "Alta": de 0 a 10 días (un examen el mismo día del turno es "Alta"). "Media": de 11 a 20 días. "Baja": más de 20 días o si no hay examen próximo en esa materia.
- La prioridad se muestra en un canal visual distinto del estado, para que no se confundan: una franja lateral y un punto de color junto al turno, además de la palabra escrita. "Alta" (rojo), "Media" (amarillo) y "Baja" (sin distintivo; sólo se indica en el detalle).
- Se muestra en la agenda diaria del centro (HU-09), en la agenda de un profesor, en "Mi agenda" (HU-10), en el calendario semanal (HU-19) y en el detalle del turno.
- Al pasar el mouse por la prioridad (o en el detalle) se ve el examen que la determina: "Examen de Matemática el 15/10 (en 5 días)".
- En una serie recurrente, cada turno tiene su propia prioridad (el mismo examen puede dar "Baja" a un turno lejano y "Alta" a uno cercano).
- La agenda diaria del centro permite filtrar por prioridad, combinable con los demás filtros.
- Los turnos cancelados no muestran prioridad.
- Si se carga, modifica o elimina un examen, la prioridad de los turnos afectados cambia en la próxima consulta (no se guarda).

**ID:** HU-19 | **Sprint:** 2
**Título:** Agenda en calendario semanal
**Como…** Usuario del sistema (personal de mesa de entrada o profesor)
**Necesito…** Ver la agenda como un calendario de la semana.
**Para…** Entender de un vistazo la ocupación de los días y horarios.
**Criterios de Aceptación:**

- Disponible en la agenda diaria del centro (HU-09), en la agenda de un profesor y en "Mi agenda" (HU-10), con un selector "Calendario / Lista". La vista de lista actual se mantiene.
- La grilla muestra los días de la semana en columnas (de lunes a domingo; se ocultan los días sin turnos) y las horas en filas, desde la primera hasta la última hora con turnos de esa semana.
- En el calendario, cada clase se representa como un único bloque en el día y horario que corresponda. Una clase es una hora concreta de un bloque, en una fecha determinada, con su profesor y aula.
- El bloque de la clase muestra inicialmente información resumida para evitar sobrecargar el calendario: horario, materia y, cuando corresponda, profesor y aula.También indica de forma resumida los alumnos que tienen turno en esa clase, sin desplegar inicialmente el detalle completo de cada turno.
- Cuando una clase tiene varios alumnos con turno en la misma hora, todos se agrupan dentro del mismo bloque horario. El calendario no muestra inicialmente un bloque independiente por cada alumno.
- Al hacer clic sobre el bloque de una clase, este se expande y muestra el detalle de los turnos de los alumnos correspondientes a esa clase. Para cada alumno se muestra, como mínimo, su nombre y apellido, estado del turno y distintivo de prioridad cuando corresponda (HU-18).
- Los datos propios de cada turno se mantienen diferenciados aunque los turnos pertenezcan a la misma clase: cada alumno puede tener un estado y una prioridad diferente.
- El bloque expandido permite volver a contraerse para recuperar la vista resumida del calendario.
- Al hacer clic sobre un turno/alumno dentro del bloque expandido se abre su detalle, con las acciones que correspondan (HU-13, HU-15, HU-20).
- El estado y el color mostrado para cada turno siguen los estados del turno (Agendado, Sin registrar y Cancelado). Si varios alumnos de una misma clase tienen estados diferentes, cada turno muestra su propio estado dentro del bloque expandido. La clase no tiene un único estado común.
- La prioridad de cada turno se muestra según HU-18. La prioridad se mantiene asociada a cada alumno/turno y no al bloque horario de la clase.
- Si una clase no tiene alumnos con turno vigente para esa fecha, no se muestra en el calendario.
- Por defecto se muestra la semana actual, con el día de hoy destacado. Se puede avanzar y retroceder de a una semana y volver a "Hoy".
- Los filtros de cada agenda (profesor, materia, estado, prioridad) también se aplican al calendario. Al aplicar un filtro, se muestran los bloques horarios que tengan al menos un turno que coincida con los criterios seleccionados; dentro del bloque se muestran únicamente los turnos que cumplen los filtros.
- Al expandir un bloque horario, se mantiene la agrupación de los turnos correspondientes a esa clase, sin mezclar turnos de otras horas.
- El calendario debe permitir identificar visualmente cuándo una misma hora tiene varios alumnos asignados, sin necesidad de mostrar toda la información de los turnos de forma simultánea.
- El selector no recuerda la última vista elegida: por defecto se muestra la vista de lista.
- Fuera de alcance en este incremento: vista mensual y arrastrar turnos para moverlos.

**ID:** HU-20 | **Sprint:** 2
**Título:** Reprogramar un turno
**Como…** Personal de mesa de entrada
**Necesito…** Pasar un turno a otra fecha, hora o profesor.
**Para…** Atender el cambio que pide el alumno o el profesor sin perder el registro de cuándo estaba programado.
**Criterios de Aceptación:**

- Desde el detalle de un turno en estado "Agendado" con fecha hoy o posterior, botón "Reprogramar".
- Reprogramar no cancela el turno: la fecha movida conserva su alumno, su materia, sus observaciones, sus temas a trabajar (HU-08) y su pago (HU-15); sólo cambian la fecha, la hora y, si corresponde, el profesor.
- Se reprograma el turno de un alumno: los demás alumnos anotados en esa hora no se ven afectados.
- Se abre la búsqueda de horarios de registrar turno (HU-08) con el alumno y la materia ya elegidos (no se pueden cambiar). Se puede elegir otro profesor que dicte la materia, otro día y otra hora.
- Se aplican todas las validaciones de HU-08: sólo profesores activos con la materia asignada, capacidad efectiva de la hora en la fecha nueva, fecha hoy o posterior y coincidente con el día del bloque, y que el alumno no tenga otro turno superpuesto. El turno que se está reprogramando no cuenta como superpuesto consigo mismo.
- Antes de confirmar se muestra el cambio: "Del lunes 12/10 9:00–10:00 con Prof. Gómez al jueves 15/10 17:00–18:00 con Prof. Ruiz".
- Al confirmar, el turno pasa a su fecha y hora nuevas y sigue en estado "Agendado". El lugar que ocupaba queda libre: esa hora vuelve a tener disponibilidad en la fecha anterior al registrar un turno (HU-08).
- Como el turno no se cancela, su pago no se pierde: acompaña a la fecha movida y conserva su estado de pago (HU-15). Por eso un turno pagado se puede reprogramar sin restricciones, a diferencia de cancelarlo (HU-13).
- Si el turno pertenece a una serie recurrente (HU-08), sólo se mueve esa fecha: esa fecha pasa a ser un turno aparte en el nuevo horario y el resto de la serie no cambia (la serie conserva su día y su hora).
- El detalle del turno muestra quién lo creó y quién lo modificó por última vez, con fecha y hora.
- El turno reprogramado se sigue viendo con el color de "Agendado": no aparece como cancelado en ninguna agenda ni en los turnos de la ficha del alumno.
- Mensaje de éxito: "Turno reprogramado".

**ID:** HU-21 | **Sprint:** 2 (tablero opcional; inicio de sesión y sección del gerente obligatorios por HU-12)
**Título:** Tablero del gerente
**Como…** Gerente
**Necesito…** Ingresar al sistema con mi usuario y contraseña, acceder a una sección propia y ver un tablero con los indicadores principales del centro.
**Para…** Administrar el catálogo de materias y conocer la actividad del centro para tomar decisiones.
**Criterios de Aceptación:**

- Amplía HU-01: el sistema pasa a tener tres roles con acceso: "Personal de mesa de entrada", "Profesor" y "Gerente".
- El gerente ingresa con las mismas reglas de HU-01: usuario (email) y contraseña obligatorios, contraseña enmascarada, mensaje "Usuario o contraseña incorrectos" sin indicar cuál de los dos datos falló, un usuario inactivo no puede ingresar ("Su usuario no está habilitado"), cierre de sesión con el botón "Cerrar sesión" y cierre automático por inactividad.
- La cuenta del gerente viene creada en el sistema (usuario inicial). En este incremento no hay alta, edición ni baja de gerentes desde las pantallas.
- Al ingresar, el gerente llega a su propia sección, con su menú: "Tablero" y "Materias" (HU-12). La primera pantalla es "Tablero". "Formas de pago" (HU-23) no entra en este incremento.
- El menú del gerente muestra su nombre, su rol y la opción "Cerrar sesión", igual que los demás roles.
- El gerente no ve las opciones de mesa de entrada ni de profesor. Si intenta entrar a una pantalla de otro rol (por ejemplo, escribiendo la dirección), el sistema muestra "No tiene permiso para acceder a esta sección" con un enlace a su pantalla de inicio.
- Los demás roles no ven la sección del gerente. Si intentan entrar, el sistema muestra el mismo mensaje.
- Los permisos los controla el sistema, no sólo la pantalla: si un usuario que no es gerente intenta crear, editar, dar de baja o reactivar una materia, el sistema lo rechaza aunque lo intente por fuera de la pantalla.
- Las operaciones del gerente quedan registradas con su usuario en la trazabilidad (quién creó y quién modificó cada registro), igual que las de los demás roles.
- Tablero: selector de período "Hoy", "Esta semana" (por defecto), "Este mes" o un rango de fechas.
- Turnos del período, cada uno con su cantidad y su porcentaje sobre el total: cancelados, sin registrar (pasados y no cancelados) y, si el período incluye fechas futuras, agendados (no cancelados y todavía sin darse). Los indicadores "Asistió" y "No asistió" dependen de la asistencia (HU-22, próximo sprint): se muestran como "Disponible cuando se registre la asistencia", sin número.
- Ocupación del período: turnos no cancelados sobre la capacidad efectiva total de las horas con clase (HU-06), expresada en porcentaje.
- Alumnos: alumnos nuevos (dados de alta en el período). "Alumnos atendidos" depende de la asistencia (HU-22): se muestra como "Disponible cuando se registre la asistencia", sin número.
- Materias con más demanda: las 5 con más turnos en el período, con su cantidad.
- Profesores con más actividad: depende de la asistencia (los 5 con más turnos con asistencia "Asistió" en el período, con su cantidad). Se muestra como "Disponible cuando se registre la asistencia", sin número, hasta HU-22.
- Pagos: total cobrado en el período y total adeudado a la fecha (HU-16).
- Cada número indica el período al que corresponde y se calcula al consultarlo (no hace falta actualizar nada a mano).
- El tablero es de sólo lectura: el gerente no modifica datos desde ahí, y el acceso a esos datos es agregado (no ve la agenda, ni la ficha de un alumno, ni un pago puntual).
