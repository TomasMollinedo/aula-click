**ID:** HU-01 | **Sprint:** 1
**Título:** Inicio de Sesión en el Sistema
**Como…** Usuario del sistema (personal de mesa de entrada o profesor)
**Necesito…** Ingresar al sistema con mi usuario y contraseña.
**Para…** Acceder a las funciones que corresponden a mi rol y que quede registrado quién realiza cada acción en el sistema.
**Criterios de Aceptación:**

- Tienen acceso al sistema dos roles: "Personal de mesa de entrada" y "Profesor".
- El ingreso se realiza con usuario (email) y contraseña; ambos campos son obligatorios y la contraseña se muestra enmascarada.
- Si el usuario o la contraseña son incorrectos, el sistema muestra el mensaje "Usuario o contraseña incorrectos", sin indicar cuál de los dos datos falló, y no permite el ingreso.
- Al ingresar, cada usuario ve sólo las opciones de su rol: el personal de mesa de entrada accede a Alumnos, Profesores, Materias, Turnos y Agenda diaria del centro (HU-02 a HU-09); el profesor accede a su agenda (HU-10) y al apartado "Mis alumnos".
- Un profesor en estado "Inactivo" (HU-07) no puede ingresar al sistema; el sistema le indica que su usuario no está habilitado.
- El usuario puede cerrar sesión en cualquier momento desde un botón "Cerrar sesión".
- La sesión se cierra automáticamente luego de un período de inactividad; para continuar hay que volver a ingresar.
- El usuario que inició sesión es el que queda registrado en la trazabilidad de cada acción (quién creó y quién modificó cada registro).
- Fuera de alcance en este incremento: la administración de usuarios y la recuperación de contraseña.
  **Puntos de función:** 5

**ID:** HU-02 | **Sprint:** 1
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
- Datos obligatorios para el alta: nombre, apellido, DNI, fecha de nacimiento, email y telefono. Si el alumno es menor de edad, también son obligatorios nombre, apellido, teléfono y email de un tutor o responsable. El resto (datos escolares, colegio y observaciones) es opcional y puede cargarse en el alta o después desde la edición.
- Datos escolares: nivel de escolaridad (nivel y grado o año, por ejemplo "Primario – 5.º grado" o "Secundario – 3.er año"); colegio o institución al que asiste, opcional.
- Campo "Observaciones": texto libre, opcional, para registrar información relevante del alumno (por ejemplo, si tiene déficit de atención u otra dificultad de aprendizaje).
- El DNI es único: si ya existe un alumno registrado con ese DNI, el sistema lo indica y no permite continuar con el alta.
- No se puede guardar el alta si falta algún dato obligatorio; el sistema resalta los campos incompletos (instutision educativa y observaciones, al ser opcionales, no bloquean el guardado).
- Al guardar, el alumno aparece en el listado y queda disponible para que se le registren turnos.
- La edición de todos los datos (incluidos los escolares y las observaciones) se realiza desde el detalle del alumno, con un botón "Editar", con las mismas validaciones del alta.
- El DNI no puede editarse a un valor ya usado por otro alumno.
- El detalle muestra quién creó el registro y quién lo modificó por última vez (con fecha y hora).
  **Puntos de función:** 5

**ID:** HU-03 | **Sprint:** 1
**Título:** Gestión de Datos Personales del Profesor (Alta, Edición, Listado y Búsqueda)
**Como…** Personal de mesa de entrada
**Necesito…** Registrar un nuevo profesor con sus datos personales y profesionales, editarlos, y encontrarlo rápidamente desde el listado de profesores.
**Para…** Mantener actualizado el plantel docente del centro y acceder rápidamente a la ficha de cada profesor para consultarla o editarla.
**Criterios de Aceptación:**

- El módulo "Profesores" muestra el listado de profesores; por defecto sólo muestra los profesores en estado "Activo".
- El listado permite filtrar por estado: "Activos" (por defecto), "Inactivos" y "Todos"; y también por materia asignada.
- El listado tiene un buscador por coincidencia parcial de DNI, nombre o apellido; no distingue mayúsculas/minúsculas ni tildes y se combina con los filtros seleccionados.
- El listado muestra sólo la foto (o un avatar genérico si no tiene), apellido, nombre y DNI de cada profesor, ordenado alfabéticamente por apellido y estado el resto de los datos se ve en el detalle. Con el filtro "Todos", los inactivos se distinguen con una etiqueta "Inactivo".
- Si la búsqueda o los filtros no tienen coincidencias, el sistema lo indica y ofrece la opción de dar de alta un nuevo profesor.
- Al seleccionar un profesor del listado se abre su detalle con todos sus datos, su estado, sus materias asignadas (HU-05), su horario de atención (HU-06) junto con su agenda
- El alta se accede desde el módulo "Profesores" mediante un botón "+ Nuevo profesor".
- Datos obligatorios: nombre y apellido, DNI, teléfono, email, título, matrícula y capacidad (cantidad máxima de alumnos que el profesor puede atender a la vez en una misma hora; número entero mayor o igual a 1). Esta capacidad se usa para calcular la capacidad efectiva de cada hora de sus bloques (HU-06). Tambien aca es obligatorio asignarle al profesional una contraseña para su inicio de sesión
- Foto: opcional; se adjunta una imagen (JPG o PNG) que luego puede reemplazarse o quitarse desde la edición.
- El DNI y la matrícula son únicos entre profesores (tanto activos como inactivos); si ya existen, el sistema lo indica y no permite continuar.
- No se puede guardar el alta si falta algún dato obligatorio; el sistema resalta los campos incompletos (la foto, al ser opcional, no bloquea el guardado).
- Al guardar, el profesor queda en estado "Activo".
- La edición de datos se realiza desde la ficha del profesor, con un botón "Editar", con las mismas validaciones del alta.
- La capacidad no puede bajarse a un valor menor que la cantidad de turnos vigentes que el profesor tenga en alguna hora de sus bloques (HU-06); en ese caso el sistema lo indica y no permite guardar.
- El detalle muestra quién creó el registro y quién lo modificó por última vez (con fecha y hora).
  **Puntos de función:** 5

**ID:** HU-04 | **Sprint:** 1
**Título:** Gestión del Catálogo de Materias
**Como…** Personal de mesa de entrada
**Necesito…** Crear y dar de baja las materias que ofrece el centro, y consultar qué profesores dictan cada una.
**Para…** Tener un listado único de materias disponible al asignar materias a un profesor y al registrar turnos.
**Criterios de Aceptación:**

- El módulo "Materias" muestra el listado de materias; por defecto sólo muestra las materias en estado "Activa".
- El listado permite filtrar por estado: "Activas" (por defecto), "Inactivas" y "Todas".
- El listado tiene un buscador por coincidencia parcial del nombre de la materia; no distingue mayúsculas/minúsculas ni tildes y se combina con el filtro de estado.
- Al seleccionar una materia del listado se abre su detalle con nombre, descripción, estado y el listado de profesores que la dictan.
- El listado de profesores del detalle es de sólo lectura (muestra apellido, nombre y estado de cada profesor); cada profesor tiene un enlace a su ficha, desde donde se puede desasignar la materia (HU-05).
- Desde el módulo "Materias", botón "+ Nueva materia", se registran el nombre (obligatorio) y la descripción de la materia.
- El nombre de la materia es único: no se permiten materias duplicadas.
- La baja es lógica: una materia dada de baja no aparece como opción al asignar materias a un profesor (HU-05) ni al registrar un turno, pero no se elimina su registro.
- Sólo se permite dar de baja una materia si no tiene profesores asignados. Si los tiene, el sistema no permite la baja e indica cuántos y cuáles son, con enlace a la ficha de cada uno.
- El detalle muestra quién creó el registro y quién lo modificó por última vez (con fecha y hora).
  **Puntos de función:** 3

**ID:** HU-05 | **Sprint:** 1
**Título:** Gestión de Materias Asignadas al Profesor
**Como…** Personal de mesa de entrada
**Necesito…** Asignar una o más materias a un profesor, y poder editarlas.
**Para…** Saber qué materias puede dictar cada profesor al momento de registrar un turno.
**Criterios de Aceptación:**

- Desde la ficha del profesor, sección "Materias", botón "+ Asignar materia".
- Las materias se eligen del catálogo de materias registradas en el sistema (HU-04); no se cargan como texto libre. Sólo se ofrecen materias activas.
- Un profesor puede tener asignadas una o varias materias a la vez.
- Sólo se pueden asignar materias a profesores activos.
- El profesor aparece en el listado de profesores del detalle de cada materia que tiene asignada (HU-04).
- Se puede quitar una materia previamente asignada desde la misma sección, salvo que el profesor tenga turnos vigentes (turnos recurrentes sin fecha de fin o con fecha de fin igual o posterior a hoy, y sesiones únicas con fecha igual o posterior a hoy; ver HU-08) de esa materia; en ese caso el sistema lo indica y no permite quitarla.
- Al registrar un turno, sólo se listan como opción los profesores que tienen asignada la materia solicitada.
  **Puntos de función:** 3

**ID:** HU-06 | **Sprint:** 1
**Título:** Gestión de Horario de Atención del Profesor (Bloques de Clase)
**Como…** Personal de mesa de entrada
**Necesito…** Cargar el horario semanal de atención de un profesor como bloques de clase, con el aula asignada a cada bloque, y poder editarlo.
**Para…** Que el sistema sepa cuándo da clase cada profesor y cuántos alumnos puede atender en cada clase, para registrar turnos.
**Criterios de Aceptación:**

- Desde la ficha del profesor, sección "Horario", botón "+ Nuevo bloque".
- Cada bloque representa el horario en que el profesor atiende en el centro un día de la semana y tiene: día de la semana, hora de inicio, hora de fin y aula asignada. Todos son obligatorios.
- Los bloques se repiten semanalmente: por ejemplo, si se define un bloque el lunes de 8:00 a 12:00, el profesor atiende todos los lunes de 8:00 a 12:00 mientras el bloque exista.
- El horario del profesor se carga en un solo bloque indicando sólo la hora de inicio y la hora de fin (por ejemplo, de 8:00 a 12:00); no hace falta cargar un bloque por cada hora.
- La hora de inicio y la hora de fin deben ser en hora en punto (por ejemplo, 8:00 y no 8:30); la hora de fin debe ser posterior a la de inicio y el bloque debe durar como mínimo una hora.
- Dentro del bloque, los turnos se toman por hora: por ejemplo, un bloque de 8:00 a 12:00 tiene las horas 8:00–9:00, 9:00–10:00, 10:00–11:00 y 11:00–12:00 (ver HU-08).
- Se puede definir más de un bloque por día (por ejemplo, de 8:00 a 12:00 y de 16:00 a 18:00).
- Los bloques cargados para un mismo profesor no pueden superponerse entre sí.
- Sólo se pueden crear bloques para profesores activos con al menos una materia asignada (HU-05).
- El bloque no tiene materia: la materia se indica en cada turno (HU-08), entre las que dicta el profesor.
- Aulas: las aulas del centro vienen precargadas en el sistema, cada una con su nombre y su capacidad (cantidad máxima de alumnos); en este incremento las aulas no tienen ABM.
- A cada bloque se le asigna un aula para todo su horario. Al cargar el bloque, el sistema ofrece para elegir sólo las aulas que están libres durante todo el horario del bloque ese día de la semana: un aula no puede estar asignada a dos bloques que se superpongan el mismo día, y un bloque no se reparte entre varias aulas.
- Si no hay ningún aula libre durante todo el horario del bloque, el sistema muestra el mensaje "No hay un aula disponible en ese horario. Por favor, elija otro horario." y no permite guardar el bloque.
- Capacidad efectiva: cada hora del bloque admite como máximo la menor entre la capacidad del profesor (HU-03) y la capacidad del aula asignada. Si una es mayor que la otra, el bloque se crea igual y se toma la menor (por ejemplo, un profesor con capacidad 12 en un aula de 10 admite hasta 10 turnos por hora; uno con capacidad 6 en la misma aula, hasta 6).
- La sección muestra los bloques ordenados por día y hora, con su aula y la ocupación de cada hora (turnos vigentes / capacidad efectiva).
- Los bloques cargados son la base para los turnos que se registran en HU-08; cada hora del bloque puede estar vinculada a uno o más turnos, hasta su capacidad efectiva.
- Se puede editar un bloque existente (día, horario y aula) sólo si el bloque no tiene turnos vigentes (turnos recurrentes sin fecha de fin o con fecha de fin igual o posterior a hoy, y sesiones únicas con fecha igual o posterior a hoy; ver HU-08). La edición tiene las mismas validaciones del alta, incluida la disponibilidad del aula.
- Se puede eliminar un bloque sólo si no tiene turnos vigentes; si los tiene, el sistema lo indica y no permite eliminarlo.
- El detalle muestra quién creó el registro y quién lo modificó por última vez (con fecha y hora).
  **Puntos de función:** 5

**ID:** HU-07 | **Sprint:** 1
**Título:** Baja y Reactivación Lógica del Profesor
**Como…** Personal de mesa de entrada
**Necesito…** Dar de baja a un profesor que deja de trabajar en el centro, y poder reactivarlo si vuelve.
**Para…** Que deje de estar disponible para nuevos turnos sin perder su historial en el sistema.
**Criterios de Aceptación:**

- La baja es lógica: el registro del profesor no se elimina, y se conservan sus materias asignadas, su horario y el historial de sus turnos.
- Desde la ficha del profesor, botón "Dar de baja" (sólo visible si está activo, solicita confirmación) y botón "Reactivar" (sólo visible si está inactivo, solicita confirmación).
- No se permite dar de baja a un profesor que tenga turnos vigentes (turnos recurrentes sin fecha de fin o con fecha de fin igual o posterior a hoy, y sesiones únicas con fecha igual o posterior a hoy; ver HU-08). En ese caso el sistema lo indica, muestra cuántos y cuáles son (alumno, materia, día y horario) y no permite continuar.
- Un profesor dado de baja pasa a estado "Inactivo": no aparece en el listado de profesores por defecto (sólo con los filtros "Inactivos" o "Todos", HU-03) y no aparece como opción al registrar un nuevo turno.
- A un profesor inactivo no se le pueden asignar materias (HU-05) ni cargar bloques (HU-06).
- Un profesor inactivo que tenga materias asignadas sigue figurando, con su estado, en el detalle de esas materias (HU-04).
- Al reactivar, el profesor vuelve a estado "Activo", vuelve a aparecer en el listado por defecto y vuelve a estar disponible para agendar turnos con sus materias y bloques.
- La baja y la reactivación aplican sólo a profesores; los alumnos no tienen baja lógica.
- El detalle muestra quién creó lo modifico por ultima vez(con fecha y hora).
  **Puntos de función:** 3

**ID:** HU-08 | **Sprint:** 1
**Título:** Registrar Turno
**Como…** Personal de mesa de entrada
**Necesito…** Registrar un turno asignando un alumno a una o varias horas de un bloque de clase de un profesor, indicando la materia y si el turno se repite o es una sesión única.
**Para…** Reservar un espacio de atención para el alumno con el profesor correspondiente.
**Criterios de Aceptación:**

- Cada turno es una asignación que vincula un alumno con una hora de un bloque del profesor (HU-06).
- Se selecciona un alumno (mediante el buscador del listado de alumnos, HU-02).
- Para buscar horarios se usan tres filtros: materia (obligatorio; sólo materias activas), día de la semana y profesor (estos dos opcionales, se pueden combinar). Sólo se muestran profesores activos que tengan asignada la materia elegida (HU-05).
- Según los filtros elegidos, el sistema muestra los bloques que coinciden, cada uno con su horario completo (por ejemplo, "de 8:00 a 12:00"):
  ◦ Materia y día: los profesores que dictan la materia y tienen un bloque ese día.
  ◦ Materia y profesor: los días en que ese profesor tiene bloques.
  ◦ Materia, día y profesor: los bloques de ese profesor ese día.
  ◦ Sólo materia: todos los profesores que dictan la materia, con sus días.
- Al seleccionar un resultado (un profesor en un día), se muestran las horas de ese bloque, cada una con un checkbox y su ocupación (turnos vigentes / capacidad efectiva, HU-06). Las horas que no tienen lugar también se muestran con un mensaje aclarando que estan llenas.
- Se pueden tildar una o varias horas del bloque, consecutivas o no (por ejemplo, 8:00–9:00 y 10:00–11:00). Cada hora seleccionada se registra como un turno, todos con la misma materia, tipo de turno y fechas.
- El turno se da en el aula asignada al bloque (HU-06); el sistema muestra el aula al confirmar el turno y en el detalle del turno.
- Validación: la materia del turno debe ser una de las materias asignadas al profesor del bloque; si no lo es, el sistema no permite continuar.
- Tipo de turno, obligatorio: "Recurrente" (el alumno viene todas las semanas en esa hora; se indica fecha de inicio y, opcionalmente, fecha de fin) o "Sesión única" (se indica la fecha). Las fechas deben coincidir con el día de la semana del bloque.
- Validación de capacidad: la cantidad de turnos vinculados a cada hora del bloque no puede superar su capacidad efectiva (la menor entre la del profesor y la del aula, HU-06). La capacidad se controla para cada hora seleccionada y para cada fecha en que aplica el turno, contando los turnos recurrentes vigentes y las sesiones únicas de esa fecha en esa hora.
- Sesión única sin lugar: si una hora seleccionada está completa en la fecha elegida, el sistema lo indica, no permite registrar el turno en esa hora y ofrece la opción "Buscar otros turnos disponibles".
- Recurrente con fechas completas: si una hora tiene lugar en algunas fechas pero está completa en otras, el sistema muestra un mensaje que indica puntualmente qué fechas no tienen lugar (por ejemplo: "El lunes 12/10 la hora de 9:00 a 10:00 está completa") y ofrece dos opciones: "Asignar igual" y "Cancelar".
- "Asignar igual": se registra el turno recurrente con esas fechas como excepciones; en esas fechas el alumno no figura en esa hora del bloque ni ocupa lugar. Y una vez asignado se muestra un mensaje de éxito con las aclaraciones de las fechas en las que hay excepciones (fechas en las que no hay turno).
- "Cancelar": vuelve a la pantalla de buscar turnos disponibles.
- Si una hora no tiene lugar en ninguna fecha (por ejemplo, porque está completa con turnos recurrentes sin fecha de fin), el sistema lo indica y no permite registrar el turno recurrente en esa hora.
- Las fechas exceptuadas de un turno recurrente se muestran en el detalle del turno.
- Un alumno no puede tener dos turnos que se superpongan en fecha y horario.
- Campo "motivo de consulta" de texto libre, opcional.
- Al confirmar, el turno queda en estado "Agendado", reflejado en la agenda del profesor (HU-10), en la ficha del alumno y en la agenda diaria del centro (HU-09).
- Cada turno registrado queda con fecha, hora y usuario de creación, visibles en el detalle del turno.
  **Puntos de función:** 8

**ID:** HU-09 | **Sprint:** 1
**Título:** Ver Agenda Diaria del Centro
**Como…** Personal de mesa de entradas
**Necesito…** Ver todos los turnos agendados para el día, de todos los profesores.
**Para…** Tener una vista general de la actividad del centro y organizar la atención en el mostrador.
**Criterios de Aceptación:**

- Vista de agenda diaria que muestra los turnos de todos los profesores para la fecha seleccionada.
- Cada turno se muestra con alumno, profesor, materia, horario y estado.
- Permite navegar a días anteriores y posteriores.
- Permite filtrar la vista por profesor.
- Por defecto, al ingresar al módulo se muestra la agenda del día en curso.
  **Puntos de función:** 3

**ID:** HU-10 | **Sprint:** 1
**Título:** Ver Agenda Propia del Profesor
**Como…** Profesor
**Necesito…** Ver mi propia agenda de turnos.
**Para…** Saber qué alumnos tengo agendados y cuándo, sin depender de mesa de entradas.
**Criterios de Aceptación:**

- Historia opcional: se incluye si el equipo tiene margen en el sprint; requiere que el profesor tenga acceso propio al sistema.
- Vista de solo lectura con los turnos propios del profesor, por día o por semana.
- Cada turno propio se muestra con alumno, materia, horario y estado.
- El profesor no puede editar ni cancelar turnos desde esta vista en este incremento.
  **Puntos de función:** 2
