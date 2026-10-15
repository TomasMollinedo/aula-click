**ID:** HU-22 | **Sprint:** 3
**Título:** Registrar la asistencia a un turno
**Como…** Profesor
**Necesito…** Registrar la asistencia de mis alumnos en cada clase, con lo que se trabajó y las indicaciones para la próxima sesión. Si el alumno viene varias horas seguidas, registrarlo una sola vez.
**Para…** Dejar constancia de cada clase y construir el historial académico de cada alumno.
**Criterios de Aceptación:**
Es la HU-22 que HU-13, HU-15, HU-16 y HU-21 dejaron anunciada para este sprint.

▶ Dónde y qué turnos

- El menú del profesor suma la opción "Asistencia". Por defecto muestra sus turnos del día de hoy, agrupados por clase (una hora del profesor en esa fecha, como en HU-19), en orden horario.
- Se puede elegir una fecha anterior para registrar asistencias que quedaron pendientes, hasta 7 días después de la fecha del turno (ver "Plazo, corrección y cierre automático"). No se registra asistencia de una fecha futura.
- Si el profesor tiene turnos de días anteriores sin asistencia registrada y todavía dentro del plazo, la pantalla lo avisa con la fecha límite ("Tenés 3 turnos sin registrar de días anteriores. El más antiguo se puede registrar hasta el 12/10").
- Los turnos cancelados (HU-13) no aparecen: no se registra asistencia de un turno cancelado.
- Sólo el profesor del turno registra su asistencia. El personal de mesa de entrada y el gerente la ven, pero no la registran ni la modifican.

▶ Qué muestra cada alumno

- Cada clase muestra horario, materia y aula; dentro, una fila por alumno con su foto en miniatura (HU-26) o un avatar genérico, apellido y nombre, materia, temas a trabajar del turno (HU-08) y estado de asistencia. No se usa la tarjeta del listado de alumnos, para que la lista sea compacta.
- Junto a cada alumno se ven las indicaciones que dejó el profesor en la clase anterior de ese alumno en esa materia (si las hay), para retomar desde ahí.

▶ Qué se registra

- Estado de asistencia, obligatorio: "Presente" o "Ausente".
- Presente: "Qué se trabajó" es opcional (hasta 1000 caracteres) y "Indicaciones para la próxima sesión" es opcional (hasta 1000 caracteres).
- Ausente: "Observación" opcional (hasta 500 caracteres); "Qué se trabajó" e "Indicaciones" no se piden.
- Botón "Marcar todos presentes" en cada clase; después se completa "Qué se trabajó" e "Indicaciones" de cada alumno, porque es su historial individual.
- Muestra "Asistencia registrada" ya sea que se registre de un alumno puntual o con el botón de todos presentes.

▶ Alumno con varias horas seguidas (mismo bloque de la agenda)

- Si un alumno tiene turnos en horas consecutivas, el mismo día, con el mismo profesor y la misma materia, la pantalla los muestra como una sola fila. (Ejemplo: Pérez, Juan · 8:00 a 11:00 (3 h)". Los turnos no consecutivos, o con otro profesor u otra materia, quedan en filas separadas.
- El estado se elige una sola vez y vale para todas las horas de la fila. Con "Ajustar por hora" se puede dar un estado distinto a cada hora (por ejemplo, el alumno se retiró después de la primera hora: "Presente" la primera y "Ausente" las otras dos), porque el turno, el lugar y el cobro son por hora.
- "Qué se trabajó" e "Indicaciones para la próxima sesión" se cargan una sola vez por fila y valen para sus horas "Presente". El sistema las guarda en cada turno. La fila agrupada existe sólo en esta pantalla: en el detalle del turno, el historial (HU-31, HU-32, HU-33) y las demás vistas cada hora se muestra por separado, con su estado y su asistencia. La observación de una hora "Ausente" se carga por hora.
- Las correcciones se pueden hacer sobre toda la fila o hora por hora. Los indicadores (HU-39) siguen contando cada hora como un turno.

▶ Plazo, corrección y cierre automático a los 7 días

- El profesor tiene 7 días desde la fecha del turno para registrar la asistencia y también para corregirla (estado y textos), hasta las 23:59 del séptimo día. Cada corrección actualiza quién y cuándo la modificó.
- Pasado el plazo, el sistema cierra el turno y guarda en forma definitiva la asistencia como "Sin registrar", con la observación "No registrada por el profesor en el plazo de 7 días. Cierre automático del sistema", dejando como autor al sistema y la fecha y hora del cierre.
- Un turno cerrado es de sólo lectura para todos los roles: ni el profesor, ni la mesa de entrada, ni el gerente pueden registrarlo o modificarlo. Se puede ver eligiendo su fecha en "Asistencia".
- El sistema distingue dos situaciones en el detalle del turno y el historial: "Sin registrar · vence el 12/10" (todavía se puede registrar) y "Sin registrar · cerrado por el sistema" (definitivo, con la observación visible y la aclaración de que no lo registró una persona).

▶ Control de los profesores que no registran

- Los indicadores del gerente (HU-39, pestaña "Asistencia") muestran qué profesores no registran la asistencia: por profesor, los turnos cerrados "Sin registrar" por el sistema y los que todavía están dentro del plazo.

▶ Estados del turno

- Al registrar la asistencia, el turno pasa de "Agendado" o "Sin registrar" (dentro del plazo) a "Realizado" (presente) o "Ausente". Si vence el plazo sin registro, queda "Sin registrar" en forma definitiva.
- Los estados de asistencia se ven sólo en el detalle del turno (y en esta pantalla y el historial).
- Ninguna vista de calendario ni de lista cambia: el calendario semanal (HU-19), las listas de las agendas del centro (HU-09) y del profesor (HU-10), los turnos de la ficha del alumno y "Mi calendario" (HU-30) no muestran el estado de asistencia, para no sobrecargarlos.
- El detalle del turno muestra la asistencia: estado, qué se trabajó, indicaciones u observación, quién la registró y quién la modificó por última vez, con fecha y hora. Si la cerró el sistema, lo indica en lugar del nombre de una persona.

▶ Relación con otras operaciones

- Un turno con asistencia registrada no se puede cancelar (HU-13) ni reprogramar (HU-20): ya ocurrió. Esto completa la condición que HU-13 dejó fuera de alcance.
- Deuda (amplía HU-16): un turno "Realizado" o "Ausente" impago se adeuda igual que uno "Sin registrar", incluso cerrado por el sistema, porque el lugar del alumno estuvo reservado.
- Lo registrado forma el historial académico del alumno (HU-31, HU-33) y alimenta los indicadores de asistencia (HU-39).

▶ Fuera de alcance en este incremento

- Llegadas tarde, justificación de ausencias, registro de asistencia por mesa de entrada y reapertura de un turno cerrado por el sistema.
  **Puntos de función:** 8

**ID:** HU-23 | **Sprint:** 3
**Título:** Cobrar con transferencia o tarjeta de débito
**Como…** Personal de mesa de entrada
**Necesito…** Registrar el pago de turnos en efectivo, por transferencia bancaria o con tarjeta de débito, con los datos propios de cada medio.
**Para…** Aceptar los medios de pago que usan las familias y que cada cobro quede respaldado con sus datos.
**Criterios de Aceptación:**
Amplía HU-15, donde el efectivo era el único medio de pago. Reemplaza la idea de una HU-23 "Formas de pago" con ABM del gerente: los medios son fijos, porque cada uno pide datos distintos.

▶ Medios de pago

- Formas de pago disponibles: "Efectivo", "Transferencia" y "Tarjeta de débito". Vienen precargadas en el sistema; en este incremento no hay pantalla para crearlas ni editarlas.
- La forma de pago es obligatoria y no tiene valor por defecto, para evitar registrar un pago con el medio equivocado.
- Un pago se hace con una sola forma de pago: no se combinan medios en un mismo pago.
- El formulario muestra sólo los campos del medio elegido; si se cambia de medio, se limpian los datos del anterior.
- El importe no cambia según el medio: no hay recargos ni descuentos.

▶ Efectivo

- Sin cambios respecto de HU-15: monto recibido obligatorio (mayor o igual al total) y vuelto calculado por el sistema.

▶ Transferencia

- Número de operación o de referencia: obligatorio, hasta 50 caracteres.
- Banco o billetera de origen: obligatorio, texto libre hasta 100 caracteres (por ejemplo, "Banco Macro" o "Mercado Pago").
- Titular de la cuenta de origen: opcional, hasta 100 caracteres (sirve cuando transfiere un familiar con otro apellido).
- Comprobante de la transferencia: obligatorio (HU-24).
- No hay monto recibido ni vuelto: el importe del pago es el total de sus turnos. La transferencia puede haber cubierto además los pagos de otros alumnos, por eso el sistema no compara el importe transferido con el del pago.
- Una misma transferencia puede respaldar pagos de varios alumnos (por ejemplo, una familia con 5 hijos que hace una sola transferencia por todos): el sistema no valida que el número de operación y el banco o billetera se repitan. Cada alumno tiene su propio pago y su propio comprobante, cargados con los mismos datos de la transferencia.

▶ Tarjeta de débito

- Red de la tarjeta: obligatoria, de una lista: "Visa Débito", "Mastercard Débito", "Maestro", "Cabal Débito" u "Otra".
- Número de cupón del posnet: obligatorio, sólo números, hasta 20 dígitos.
- Últimos 4 dígitos de la tarjeta: opcionales, exactamente 4 números. El sistema nunca pide ni guarda el número completo de la tarjeta.
- Foto del cupón: opcional (HU-24).
- No hay monto recibido ni vuelto.

▶ Confirmación y comprobante

- La confirmación indica el medio: "¿Registrar el pago de 4 turnos por $ 32.000 por transferencia?".
- El comprobante de pago en PDF (HU-15) muestra la forma de pago con sus datos: efectivo, con monto recibido y vuelto; transferencia, con número de operación, banco o billetera y titular; débito, con red, cupón y "**** 1234" si se cargaron los últimos dígitos.
- El detalle de cada turno pagado y el historial de pagos (HU-36) muestran la forma de pago y sus datos.
- El total cobrado del tablero del gerente se puede ver separado por forma de pago (HU-39).

▶ Fuera de alcance en este incremento

- Pagos en línea desde el portal, tarjeta de crédito, cuotas, recargos o descuentos por medio de pago, pagos con más de un medio y conciliación bancaria.
  **Puntos de función:** 8

**ID:** HU-24 | **Sprint:** 3
**Título:** Adjuntar el comprobante de un pago
**Como…** Personal de mesa de entrada
**Necesito…** Subir al sistema la imagen del comprobante de una transferencia (o del cupón de débito) al registrar el pago.
**Para…** Que el respaldo del cobro quede en el sistema y no en el celular personal de quien atiende la mesa de entrada.
**Criterios de Aceptación:**
Responde a la observación de los clientes en la review del Sprint 2. Depende de HU-23.

▶ Al registrar el pago

- El formulario de pago (HU-15, HU-23) tiene el campo "Comprobante" cuando el medio es transferencia o tarjeta de débito. Con efectivo no se ofrece.
- Obligatorio con transferencia: no se puede confirmar el pago sin el comprobante. Opcional con tarjeta de débito.
- Se adjunta un archivo JPG, PNG o PDF de hasta 5 MB, eligiéndolo o arrastrándolo al campo.
- Antes de confirmar se ve una vista previa del archivo; se puede quitar y elegir otro.
- Cuando una misma transferencia respalda pagos de varios alumnos (HU-23), el comprobante se adjunta en cada uno de esos pagos.
- Si el archivo no es válido, el sistema lo indica: "El archivo debe ser JPG, PNG o PDF" o "El archivo supera los 5 MB", y no lo adjunta.

▶ Consulta posterior

- El detalle del pago (desde el detalle de un turno pagado o desde el historial de pagos, HU-36) tiene el botón "Ver comprobante adjunto", que lo abre en otra pestaña.
- Para no confundirlos, el archivo que adjunta la familia se llama "Comprobante adjunto" y el documento que emite el centro sigue siendo el "Comprobante de pago" (PDF de HU-15).
- Lo ven el personal de mesa de entrada y el gerente. El alumno no lo ve desde el portal.

▶ Reemplazo y baja

- Desde el detalle del pago, el personal de mesa de entrada puede reemplazar el comprobante adjunto (por ejemplo, si la foto salió ilegible), con confirmación.
- El archivo anterior no se elimina: queda guardado y el detalle muestra sólo el último, con quién lo adjuntó y cuándo.
- Un pago por transferencia no puede quedar sin comprobante: se reemplaza, no se quita.
- En un pago con tarjeta de débito, donde el comprobante es opcional, el personal de mesa de entrada puede quitarlo desde el detalle del pago, con confirmación. Es una baja lógica: el archivo queda guardado en el sistema, pero el pago se ve sin comprobante adjunto y se le puede adjuntar otro.

▶ Fuera de alcance en este incremento

- Que la familia suba el comprobante desde el portal y la lectura automática de los datos del comprobante.
  **Puntos de función:** 3

**ID:** HU-25 | **Sprint:** 3
**Título:** Cobrar una materia completa
**Como…** Personal de mesa de entrada
**Necesito…** Filtrar los turnos pendientes del alumno por una o más materias y seleccionarlos todos de una vez con "Seleccionar todo", para cobrarlos juntos.
**Para…** Que la familia pueda pagar una o varias materias completas (por ejemplo, Inglés, o Inglés y Matemática), con sus turnos adeudados y los próximos, y dejar otra pendiente, sin tildar turno por turno.
**Criterios de Aceptación:**
Amplía HU-15 y HU-16. Responde al pedido de la review del Sprint 2 (pago por materia). Se sigue cobrando por turno, con el importe de cada uno; esta HU agrega el checkbox "Seleccionar todo" sobre los turnos que dejan los filtros.

▶ Filtros

- En la pestaña "Pagos" de la ficha del alumno (y en la vista global "Pagos" con un alumno filtrado), el filtro de materia de la lista "Por cobrar" permite elegir una o más materias. Profesor y período siguen como en HU-16.
- Con el filtro aplicado se ven los turnos adeudados y los próximos de esas materias. Los próximos nunca pasan del límite de cobro (8 semanas, HU-15).
- Sin filtro de materia, se ven todos los pendientes del alumno.

▶ Seleccionar todo

- Sobre la lista hay un checkbox "Seleccionar todo". Marca todos los turnos que cumplen los filtros aplicados en ese momento, de todas las páginas y no sólo los de la página visible, y lo aclara: "Se seleccionaron los 12 turnos del filtro".
- Si se destilda un turno, el checkbox queda en estado intermedio; con todo marcado, el mismo control pasa a "Deseleccionar todo".
- Los turnos cancelados, los ya pagados y los posteriores al límite de cobro no aparecen en la lista, por lo que nunca quedan seleccionados.
- Para cobrar varias materias juntas, se eligen todas en el filtro de materia y se usa "Seleccionar todo": se cobran en un mismo pago.
- Se muestran siempre la cantidad y el total seleccionados ("8 turnos de Inglés · $ 64.000"), con el subtotal por materia cuando hay más de una. Antes de continuar se puede destildar cualquier turno.
- Después sigue el flujo de registro de pago de HU-15 y HU-23 (forma de pago, datos y confirmación).
- Valen todas las reglas de HU-15: no se incluyen turnos cancelados ni ya pagados, el importe es el precio por hora vigente de la materia y el pago se registra todo junto o nada.
- En una serie recurrente sin fecha de fin, sólo se cobran los turnos que entran en el filtro, hasta el límite de cobro.

▶ Comprobante

- Cuando el pago incluye turnos de más de una materia, el comprobante de pago (HU-15) agrupa los turnos por materia, con el subtotal de cada una.

▶ Fuera de alcance en este incremento

- Cuota mensual con un precio distinto de la suma de los turnos, bonificaciones por pagar la materia completa y pagos parciales.
  **Puntos de función:** 2

**ID:** HU-26 | **Sprint:** 3
**Título:** Foto de perfil del alumno
**Como…** Personal de mesa de entrada
**Necesito…** Agregar, reemplazar o quitar la foto de un alumno.
**Para…** Reconocer rápidamente al alumno en la mesa de entrada y en las clases.
**Criterios de Aceptación:**
Amplía HU-02. Cumple el compromiso de la review del Sprint 2: extender a los alumnos la foto que ya tienen los profesores (HU-03).

- La foto es opcional; se adjunta una imagen JPG o PNG en el alta o desde "Editar", con las mismas reglas de tamaño y formato que la foto del profesor (HU-03).
- Desde la edición se puede reemplazar o quitar.
- Si el alumno no tiene foto, se muestra un avatar genérico.
- El listado de alumnos pasa a mostrar la foto (o el avatar genérico), apellido, nombre y DNI de cada alumno, igual que el listado de profesores (HU-03). Reemplaza el criterio de HU-02 "El listado muestra sólo apellido y nombre".
- La foto también se muestra en el detalle del alumno, en "Mis alumnos" del profesor y en el menú del portal del alumno (HU-28).
- En la pantalla de asistencia (HU-22) se muestra sólo la foto en miniatura junto al nombre, no la tarjeta del listado.
- El alumno no puede cambiar su foto desde el portal en este incremento.
- El detalle muestra quién modificó por última vez los datos del alumno, con fecha y hora, como el resto de la edición.
  **Puntos de función:** 2

**ID:** HU-27 | **Sprint:** 3
**Título:** Credenciales de acceso del alumno al portal
**Como…** Personal de mesa de entrada
**Necesito…** Generar el usuario y la contraseña inicial del alumno al darlo de alta, y poder restablecerla.
**Para…** Que el alumno o su familia puedan ingresar al portal web del centro.
**Criterios de Aceptación:**
Amplía HU-02. Es la cuenta del alumno que las definiciones del Sprint 1 dejaron para el portal (Sprint 3).

▶ En el alta del alumno

- El formulario de alta suma la sección "Acceso al portal".
- Usuario: lo genera el sistema y no se escribe a mano. Se arma con la inicial del nombre, el apellido y los últimos 3 dígitos del DNI, en minúsculas, sin espacios ni tildes y con la "ñ" como "n". Por ejemplo, Juan Pérez, DNI 45.123.456 → "jperez456".
- Si ese usuario ya existe, el sistema agrega un número al final ("jperez456-2").
- El usuario se muestra en el formulario en cuanto se completan nombre, apellido y DNI.
- Contraseña inicial: es el DNI del alumno, sin puntos. No se escribe a mano.
- La sección lo indica: "La contraseña inicial es el DNI del alumno (sin puntos). El alumno puede cambiarla desde Configuración en el portal (HU-28)".

▶ Después del alta

- El usuario no cambia aunque después se corrija el nombre o el apellido: es el dato con el que el alumno ingresa.
- El detalle del alumno muestra "Usuario del portal: jperez456". La contraseña no se vuelve a mostrar.
- Botón "Restablecer contraseña" (con confirmación): la contraseña vuelve a ser el DNI del alumno. La confirmación lo indica: "La contraseña de jperez456 volverá a ser su DNI". Es la forma de resolver un olvido, porque no hay recuperación por email.
- Alumnos registrados antes de este incremento: su detalle muestra "Sin acceso al portal" y el botón "Crear acceso al portal", que genera el usuario con la misma regla y deja el DNI como contraseña inicial, con el mismo aviso.
- Cada alumno tiene una sola cuenta; si es menor de edad, la usa su familia.
- El detalle muestra quién creó el acceso y quién restableció la contraseña por última vez, con fecha y hora.

▶ Fuera de alcance en este incremento

- Recuperación de contraseña por email y baja o reactivación del acceso.
  **Puntos de función:** 3

**ID:** HU-28 | **Sprint:** 3
**Título:** Ingreso al portal del alumno
**Como…** Alumno (o su familia)
**Necesito…** Ingresar al sistema con mi usuario y contraseña y acceder a mi propia sección.
**Para…** Consultar mi información y sacar turnos sin depender de la mesa de entrada.
**Criterios de Aceptación:**
Amplía HU-01 y HU-21: el sistema pasa a tener cuatro roles con acceso: "Personal de mesa de entrada", "Profesor", "Gerente" y "Alumno".

▶ Inicio de sesión

- La pantalla de inicio de sesión es la misma para todos: el campo se llama "Email o usuario". El alumno ingresa con el usuario generado en HU-27; los demás roles, con su email.
- Valen las reglas de HU-01: los dos campos son obligatorios, la contraseña se muestra enmascarada, el mensaje de error es "Usuario o contraseña incorrectos" sin indicar cuál falló, se puede cerrar sesión y la sesión se cierra sola por inactividad.

▶ Sección del alumno

- Menú del alumno: "Mi calendario" (HU-30), "Sacar turno" (HU-29), "Mis materias" (HU-33, HU-35), "Mis pagos" (HU-37) y "Configuración". La primera pantalla es "Mi calendario".
- El menú muestra su nombre, su foto (HU-26) o un avatar genérico y el botón "Cerrar sesión".
- La sección está pensada para usarse desde el celular: todas sus pantallas se adaptan a pantallas chicas.
- En todas las pantallas del portal hay un aviso visible: "Para cancelar o reprogramar un turno, comunicate con la mesa de entrada al [teléfono del centro]". El teléfono es el de los datos fijos del centro (HU-11).

▶ Configuración: cambiar la contraseña

- "Configuración" sirve únicamente para cambiar la contraseña; no tiene otras opciones.
- Campos obligatorios: contraseña actual, contraseña nueva y repetir la contraseña nueva, todos enmascarados con opción de mostrarlos.
- La contraseña nueva tiene al menos 8 caracteres y no puede ser igual a la actual ni al DNI del alumno.
- Si la contraseña actual es incorrecta, el sistema muestra "La contraseña actual no es correcta" y no la cambia. Si la nueva y su repetición no coinciden, lo indica y no la cambia.
- Mensaje de éxito: "Contraseña actualizada". La sesión sigue abierta.
- Mientras el alumno siga con la contraseña inicial (su DNI), el portal muestra un aviso que no bloquea el uso: "Por seguridad, te recomendamos cambiar tu contraseña" con un enlace a "Configuración".
- Si la mesa de entrada restablece la contraseña (HU-27), vuelve a ser el DNI y el aviso reaparece.

▶ Permisos y privacidad

- El alumno sólo ve sus propios datos. Si intenta entrar a una pantalla de otro rol o a datos de otro alumno, el sistema muestra "No tiene permiso para acceder a esta sección" con un enlace a su pantalla de inicio.
- Los permisos los controla el sistema, no sólo la pantalla: un pedido por fuera de las pantallas a datos de otro alumno se rechaza.
- El alumno nunca ve las observaciones internas de su ficha (por ejemplo, dificultades de aprendizaje registradas por mesa de entrada), la prioridad de sus turnos ni datos de otros alumnos.
- Las acciones del alumno quedan registradas con su usuario en la trazabilidad.
  **Puntos de función:** 3

**ID:** HU-29 | **Sprint:** 3
**Título:** Sacar un turno desde el portal
**Como…** Alumno (o su familia)
**Necesito…** Reservar un turno eligiendo materia, profesor, día y horario disponibles.
**Para…** Organizar mis clases sin tener que llamar ni ir a la mesa de entrada.
**Criterios de Aceptación:**

- Cumple el compromiso de autogestión de turnos de la review del Sprint 2. Reutiliza la búsqueda y las validaciones de HU-08, con un recorrido más simple, y suma el tope de deuda, que también pasa a regir en HU-08.

▶ Recorrido

- El alumno no se elige: el turno es siempre para él.
- Paso 1, materia: se ofrecen las materias activas que tienen al menos un profesor activo con bloques de clase.
- Paso 2, profesor y día: los dos son opcionales y se combinan como en HU-08. Se muestran sólo profesores activos con esa materia asignada.
- Paso 3, horario: se muestran las horas del bloque elegido como "Disponible" o "Completo"; las completas no se pueden elegir. El alumno no ve cuántos lugares hay ni quiénes están anotados.
- Paso 4, tipo de turno: "Una sola clase" (sesión única) o "Todas las semanas" (recurrente).
- Una sola clase: se elige la fecha.
- Todas las semanas: se elige la fecha de inicio y, opcionalmente, la fecha de fin; sin fecha de fin el turno sigue indefinidamente. Se resuelve igual que cuando lo registra la mesa de entrada (HU-08).
- Las fechas son desde el día siguiente en adelante: no se sacan turnos para el mismo día desde el portal.
- Paso 5, "¿Qué querés trabajar en la clase?": obligatorio en una sola clase y opcional en las semanales, como los temas a trabajar de HU-08.

▶ Validaciones (las de HU-08)

- Capacidad por hora y por fecha, materia asignada al profesor y fechas en el día de la semana del bloque.
- Si el alumno ya tiene un turno que se superpone, el sistema muestra "Ya tenés un turno ese día en ese horario" y no permite continuar.
- Si en un turno semanal algunas fechas están completas, el sistema las muestra ("El lunes 12/10 la clase de 9:00 a 10:00 está completa") y ofrece "Reservar sólo las fechas con lugar" o "Elegir otro horario".

▶ Tope de deuda

- Un alumno con deuda vencida no puede sacar turnos nuevos. Se considera deuda vencida a los turnos adeudados (ya dados, es decir "Realizado", "Ausente" o "Sin registrar", e impagos, HU-16) con 30 días o más de antigüedad contados desde su fecha. Los próximos turnos impagos no cuentan como deuda.
- Se valida al entrar a "Sacar turno", antes del paso 1, para que el alumno no pierda tiempo: "Tenés clases adeudadas de hace más de 30 días. Para sacar un turno nuevo, regularizá el pago en la mesa de entrada", con acceso a "Mis pagos" (HU-37).
- La misma validación rige cuando el personal de mesa de entrada saca un turno (amplía HU-08), de una sola clase o semanal: "El alumno tiene deuda de más de 30 días (3 turnos · $ 24.000). Debe regularizar el pago para agendar turnos nuevos", con acceso a "Cobrar" (HU-15).
- Se calcula en el momento de sacar el turno: alcanza con pagar los turnos adeudados de 30 días o más para volver a poder sacar turnos; una deuda más reciente no bloquea.
- No afecta a los turnos que el alumno ya tiene ni a su cancelación o reprogramación (HU-13, HU-20). No hay excepciones manuales en este incremento.

▶ Confirmación

- Antes de confirmar se muestra el resumen: materia, profesor, aula, día y horario, fechas y valor por clase (precio por hora de la materia, HU-12), con la aclaración "Las clases se abonan en la mesa de entrada".
- Al confirmar, el turno queda "Agendado" sin aprobación de la mesa de entrada, y aparece en las agendas (HU-09, HU-10), en el calendario (HU-19) y en "Mi calendario" (HU-30).
- El detalle del turno muestra que lo registró el propio alumno desde el portal (trazabilidad de HU-08).
- Mensaje de éxito: "Turno reservado", junto con el aviso para cancelar o reprogramar por la mesa de entrada.

▶ Fuera de alcance en este incremento

- Cancelar o reprogramar desde el portal (lo hace la mesa de entrada, HU-13 y HU-20), pagar en línea y lista de espera.
  **Puntos de función:** 5

**ID:** HU-30 | **Sprint:** 3
**Título:** Ver mi calendario de turnos
**Como…** Alumno (o su familia)
**Necesito…** Ver mis turnos en un calendario semanal.
**Para…** Saber cuándo, con quién y dónde tengo cada clase.
**Criterios de Aceptación:**
Reutiliza el calendario semanal de HU-19, con los turnos del alumno.

- Se muestran sólo los turnos del alumno. Cada turno muestra horario, materia, profesor y aula.
- Aunque reutiliza el calendario de HU-19, no muestra la ocupación: ni cuántos alumnos hay anotados ni cuántos lugares quedan en una hora, ni datos de otros alumnos. Vale para el calendario, la lista y el detalle.
- En la vista de calendario los turnos se ven con los mismos estados y colores que el calendario semanal de HU-19: no muestra el estado de asistencia, para no sobrecargarlo.
- La vista de lista tampoco muestra el estado de asistencia: "Realizado" o "Ausente" (HU-22) se ven sólo en el detalle del turno.
- Los turnos cancelados se ven siempre, con su estado y su color, para que la familia sepa que esa clase no se da.
- Por defecto se muestra la semana actual con el día de hoy destacado; se puede avanzar y retroceder de a una semana y volver a "Hoy".
- Selector "Calendario / Lista". En el celular, la vista por defecto es la lista de la semana, porque la grilla no entra en pantallas chicas.
- Al tocar un turno se abre su detalle: datos del turno, temas a trabajar, estado de pago ("Pagado" o "Pendiente") y, si ya se dio, lo que se trabajó y las indicaciones del profesor (HU-22).
- El calendario es de sólo lectura y no muestra la prioridad de los turnos.
- Muestra el aviso para cancelar o reprogramar por la mesa de entrada (HU-28).
- Si la semana no tiene turnos, lo indica y ofrece el acceso a "Sacar turno" (HU-29).
  **Puntos de función:** 3

**ID:** HU-31 | **Sprint:** 3
**Título:** Historial académico del alumno
**Como…** Usuario del sistema (personal de mesa de entrada o profesor)
**Necesito…** Consultar el historial de asistencia de un alumno, con lo que se trabajó y las indicaciones de cada clase.
**Para…** Seguir su evolución y responder las consultas de la familia.
**Criterios de Aceptación:**

- Depende de HU-22. Cubre las historias del mapa "Consultar historial de asistencia y observaciones de avance de sus alumnos" (profesor) y "de todos los alumnos" (mesa de entrada).

▶ Dónde

- Personal de mesa de entrada: ficha del alumno, pestaña "Historial académico", con todas sus materias y profesores.
- Profesor: "Mis alumnos" → detalle del alumno → pestaña "Historial académico", con el historial completo de ese alumno: sus propias clases y las de las demás materias y profesores, para entender la situación global del alumno.
- "Mis alumnos" sigue listando sólo a los alumnos que tienen o tuvieron turnos con el profesor: no puede consultar el historial de un alumno al que no le da clases.
- El profesor también ve los exámenes y las notas del alumno en todas sus materias (pestaña "Exámenes", HU-34), pero sólo carga y edita los de las materias que le dicta.

▶ Qué muestra

- El historial se agrupa por materia y profesor ("Matemática — Prof. Gómez"), porque un alumno puede cursar una materia con más de un profesor.
- Cada grupo muestra un resumen: clases realizadas, ausencias y porcentaje de asistencia (presentes sobre presentes más ausentes). Los turnos cancelados y los sin registrar no cuentan para el porcentaje.
- Debajo, cada clase con fecha, horario, estado ("Realizado", "Ausente", "Cancelado" o "Sin registrar"), qué se trabajó, indicaciones para la próxima sesión u observación de la ausencia. Un turno cancelado muestra su motivo (HU-13). Un "Sin registrar" cerrado por el sistema (HU-22) se muestra con su observación. Cada hora se muestra como una clase, también cuando el alumno tiene horas seguidas con el mismo profesor y materia; para el porcentaje, cada hora cuenta como un turno.
- Las clases se ordenan de la más reciente a la más antigua. No se muestran turnos futuros: esos están en los turnos del alumno.

▶ Filtros

- Período: un mes (por defecto, el mes en curso) o un rango de fechas desde y hasta.
- Materia y profesor.
- Si no hay clases en el período, se indica "No hay clases registradas en este período".

▶ Reglas

- Es de sólo lectura: la asistencia se registra y corrige sólo desde HU-22.
- Desde cada clase se puede abrir el detalle del turno.
  **Puntos de función:** 5

**ID:** HU-32 | **Sprint:** 3
**Título:** PDF del historial académico
**Como…** Personal de mesa de entrada
**Necesito…** Generar el PDF mensual del historial académico de un alumno.
**Para…** Entregarle a la familia un resumen de la asistencia y del avance del mes.
**Criterios de Aceptación:**
Depende de HU-31. Reutiliza el formato y el encabezado oficial de los documentos de HU-11.

- Botón "Generar PDF" en la pestaña "Historial académico" de la ficha del alumno (HU-31).
- El PDF es de un mes: por defecto, el que se está viendo; si el filtro es un rango que abarca más de un mes, el sistema pide elegir uno. Respeta los filtros de materia y profesor aplicados.
- Contenido: encabezado oficial del centro, datos del alumno (apellido, nombre, DNI y nivel de escolaridad), mes y filtros aplicados.
- Por cada materia y profesor: resumen de asistencia (clases realizadas, ausencias y porcentaje) y la lista de clases con fecha, horario, estado, qué se trabajó e indicaciones.
- Turnos cancelados del mes, con fecha, horario y motivo.
- Exámenes del mes con su nota, si la tienen (HU-34).
- No incluye las observaciones internas de la ficha del alumno, porque el documento es para la familia.
- Si en el mes no hay clases, el documento lo indica.
- Nombre del archivo: alumno y mes (por ejemplo, "historial-academico_perez-juan_2026-10.pdf").
- Se abre en otra pestaña, en el visor de PDF del navegador, como los demás documentos (HU-11).
  **Puntos de función:** 3

**ID:** HU-33 | **Sprint:** 3
**Título:** Mis materias e historial de asistencia
**Como…** Alumno (o su familia)
**Necesito…** Ver las materias que curso y, en cada una, mi historial de asistencia con lo trabajado y las indicaciones de mi profesor.
**Para…** Saber cómo vengo y qué tengo que preparar para la próxima clase.
**Criterios de Aceptación:**
Depende de HU-22. Es la vista del alumno del historial académico (HU-31).

- El menú del portal tiene la opción "Mis materias".
- Lista cada combinación de materia y profesor en la que el alumno tiene o tuvo turnos ("Inglés — Prof. Ruiz"), con su próximo turno y su porcentaje de asistencia.
- Al entrar a una materia se ven primero las "Indicaciones para la próxima clase" de la última clase realizada, destacadas.
- Debajo, el historial de clases: fecha, horario, estado ("Realizado", "Ausente" o "Cancelado"), qué se trabajó e indicaciones del profesor, de la más reciente a la más antigua. Cada hora se ve como una clase, también las horas seguidas con el mismo profesor y materia.
- Se puede filtrar por mes (por defecto, el mes en curso).
- La misma pantalla tiene la sección "Exámenes" de esa materia (HU-35).
- Es de sólo lectura. No muestra las observaciones internas de la ficha ni datos de otros alumnos.
- Si el alumno todavía no tiene clases realizadas en una materia, lo indica: "Todavía no tenés clases registradas en esta materia".
  **Puntos de función:** 5

**ID:** HU-34 | **Sprint:** 3
**Título:** Cargar la nota de un examen
**Como…** Usuario del sistema (personal de mesa de entrada o profesor)
**Necesito…** Cargar la nota que obtuvo el alumno en un examen ya rendido.
**Para…** Conocer su desempeño y que quede en su historial académico.
**Criterios de Aceptación:**
Amplía HU-17: además de la fecha del examen (que ya define la prioridad, HU-18), se registra su resultado.

▶ Dónde y quién

- Personal de mesa de entrada: ficha del alumno, pestaña "Exámenes". Profesor: "Mis alumnos" → detalle del alumno → pestaña "Exámenes".
- Valen las restricciones de HU-17: el profesor sólo carga y edita notas de las materias que le dicta a ese alumno; el personal de mesa de entrada, de cualquiera. El profesor ve, en sólo lectura, los exámenes y notas de las demás materias del alumno (HU-31).
- El alumno nunca carga ni modifica notas.

▶ Qué se carga

- Sólo los exámenes ya rendidos (fecha igual o anterior a hoy) tienen el botón "Cargar nota". Un examen futuro no admite nota.
- Resultado, obligatorio: "Con nota" o "Ausente al examen".
- Con nota: número de 1 a 10, con hasta dos decimales.
- Ausente al examen: no se carga nota y no cuenta para los promedios.
- Se puede usar el campo de observaciones del examen (HU-17) para comentar el resultado.

▶ Consulta y edición

- La lista de exámenes pasados muestra la nota, "Ausente" o "Sin nota". Si hay exámenes rendidos sin nota, la pestaña lo avisa ("2 exámenes rendidos sin nota").
- La nota se puede corregir con las mismas reglas. El examen muestra quién cargó la nota y quién la modificó por última vez, con su rol, fecha y hora (como HU-17).

▶ Fuera de alcance en este incremento

- Notas conceptuales (por ejemplo, "Muy bueno") y escalas distintas por nivel escolar.
  **Puntos de función:** 2

**ID:** HU-35 | **Sprint:** 3
**Título:** Mis exámenes y notas
**Como…** Alumno (o su familia)
**Necesito…** Ver mis próximos exámenes y las notas de los que ya rendí.
**Para…** Seguir mi desempeño en cada materia.
**Criterios de Aceptación:**
Depende de HU-34.

- En "Mis materias" (HU-33), cada materia tiene la sección "Exámenes".
- Próximos exámenes: fecha, tipo y cuántos días faltan ("en 5 días", "hoy"). Una materia tiene un solo examen pendiente a la vez, por lo que se muestra como máximo uno por materia.
- Exámenes rendidos: fecha, tipo y resultado (la nota, "Ausente" o "Sin nota"), del más reciente al más antiguo.
- Si la materia tiene notas, se muestra el promedio de las notas de esa materia.
- Es de sólo lectura: el alumno no carga exámenes ni notas.
- Si no hay exámenes cargados en la materia, lo indica: "No hay exámenes cargados en esta materia".
  **Puntos de función:** 2

**ID:** HU-36 | **Sprint:** 3
**Título:** Historial de pagos
**Como…** Usuario del sistema (personal de mesa de entrada o gerente)
**Necesito…** Consultar los pagos realizados, de un alumno o de todos, con su forma de pago y sus comprobantes.
**Para…** Responder las consultas de las familias y controlar lo cobrado.
**Criterios de Aceptación:**
Completa HU-16, que dejó el historial de pagos y el total pagado para un sprint posterior.

▶ Dónde (sin sobrecargar la pantalla de cobro)

- Ficha del alumno, pestaña "Pagos": se divide en dos subpestañas, "Por cobrar" (lo actual de HU-16 y HU-25) y "Pagos realizados" (nueva).
- La vista global "Pagos" de la mesa de entrada suma la misma subpestaña "Pagos realizados", de todos los alumnos.
- El gerente tiene en su menú la opción "Pagos", sólo con "Pagos realizados" y en sólo lectura: no registra pagos ni ve la pantalla de cobro.

▶ Qué muestra

- Cada pago: número de comprobante, fecha de pago, alumno (en la vista global), materias incluidas, cantidad de turnos, total, forma de pago y quién lo registró.
- Se ordenan del más reciente al más antiguo y están paginados.
- Al abrir un pago se ve su detalle: los turnos incluidos con fecha, horario, materia, profesor e importe; los datos de la forma de pago (HU-23); el botón "Ver comprobante" (PDF de HU-15) y, si tiene, "Ver comprobante adjunto" (HU-24).

▶ Filtros y totales

- Los mismos filtros que la pantalla "Pagos" del Sprint 2 (HU-16): período (por fecha de pago; por defecto, el mes en curso), materia y profesor; en la vista global, además, alumno. Suma el filtro por forma de pago.
- Arriba se muestra el total cobrado del filtro y su detalle por forma de pago (efectivo, transferencia y débito).
- Si no hay pagos con esos filtros, se indica "No hay pagos en este período".

▶ Reglas

- Es de sólo lectura. Los importes y totales los calcula el sistema.
- Los pagos anulados (HU-42) se siguen viendo, marcados como "Anulado" con el motivo, y no suman al total cobrado.
- Para el gerente, esta HU amplía HU-21, que limitaba su acceso a datos agregados: puede ver cada pago, pero no la agenda ni la ficha del alumno.
  **Puntos de función:** 3

**ID:** HU-37 | **Sprint:** 3
**Título:** Mis pagos
**Como…** Alumno (o su familia)
**Necesito…** Ver lo que tengo pendiente de pago y los pagos que ya hice.
**Para…** Saber cuánto debo y tener mis comprobantes a mano.
**Criterios de Aceptación:**
Reutiliza los cálculos de HU-16 y el historial de HU-36, sólo con los datos del alumno.

- El menú del portal tiene la opción "Mis pagos", con dos secciones.
- Pendientes: los turnos adeudados (con el total adeudado) y los próximos turnos hasta el límite de cobro (8 semanas), con fecha, horario, materia, profesor e importe, agrupados por materia con su subtotal.
- Pagos realizados: número de comprobante, fecha, materias, total y forma de pago, del más reciente al más antiguo. Cada pago tiene el botón "Ver comprobante", que abre el comprobante de pago en PDF (HU-15).
- Un pago anulado (HU-42) se ve marcado como "Anulado"; sus turnos vuelven a figurar como pendientes.
- Es de sólo lectura: el alumno no paga desde el portal.
- Aviso visible: "Los pagos se realizan en la mesa de entrada, en efectivo, por transferencia o con tarjeta de débito".
- Los importes y totales los calcula el sistema con las mismas reglas de HU-16: lo que ve el alumno coincide con lo que ve la mesa de entrada.
- Si no tiene nada pendiente, lo indica: "No tenés pagos pendientes".
  **Puntos de función:** 3

**ID:** HU-39 | **Sprint:** 3
**Título:** Tablero del gerente por secciones: General y Asistencia
**Como…** Gerente
**Necesito…** Ver los indicadores del centro organizados en secciones, con los de asistencia incluidos, y exportar cada sección a PDF.
**Para…** Analizar la actividad del centro sin que el tablero se vuelva una sola pantalla sobrecargada.
**Criterios de Aceptación:**

- Amplía HU-21. Depende de HU-22 (asistencia) y HU-23 (medios de pago). Sin indicadores de notas.

▶ Estructura del tablero

- El tablero pasa a tener pestañas: "General" y "Asistencia". La primera que se ve es "General".
- El selector de período de HU-21 queda arriba, común a todas las pestañas: al cambiar de pestaña se conserva el período elegido.
- "General" mantiene la disposición actual de HU-21. La pestaña nueva sigue una estructura pensada para no saturar la vista: una fila de hasta 4 números principales arriba y, debajo, como mucho dos tablas. Las tablas se paginan de a 10 y no se listan todos los alumnos del centro.

▶ Pestaña "General" (lo que ya existe en HU-21)

- Mantiene los indicadores de HU-21 (turnos, ocupación, alumnos nuevos, materias y profesores con más turnos, total cobrado y total adeudado).
- Los indicadores de asistencia que HU-21 mostraba como "no disponibles" pasan a tener valor: "Asistió" y "No asistió" (cantidad y porcentaje sobre los turnos con asistencia registrada) y "Alumnos atendidos" (alumnos distintos con al menos un turno "Realizado").
- El total cobrado se ve separado por forma de pago: efectivo, transferencia y tarjeta de débito (HU-23). Los pagos anulados (HU-42) no suman.

▶ Pestaña "Asistencia"

- Números principales: porcentaje de asistencia del centro, turnos cerrados "Sin registrar" por el sistema en el período (pasaron los 7 días sin que el profesor los registrara, HU-22), cantidad de profesores con turnos sin registrar y cantidad de alumnos con menos de 75 % de asistencia.
- Tabla por profesor, para ver qué profesores no registran la asistencia (HU-22): clases realizadas, ausencias, porcentaje de asistencia de sus alumnos, turnos cerrados "Sin registrar" por el sistema, turnos todavía dentro del plazo de registro y porcentaje de turnos sin registrar sobre los turnos del período. Por defecto se ordena por turnos cerrados sin registrar, de mayor a menor; se puede reordenar por cualquier columna; paginada.
- El profesor con al menos un turno cerrado sin registrar en el período lleva el distintivo "No registra asistencia", y el filtro "Sólo con turnos sin registrar" deja a la vista únicamente a esos profesores.
- Tabla por materia: los mismos datos, agrupados por materia; paginada.
- Muestra datos agregados por profesor y por materia: no lista alumnos con nombre.

▶ PDF

- Cada pestaña tiene su botón "Generar PDF", que exporta esa sección del período con el encabezado oficial del centro (HU-11). Las tablas salen completas, no sólo la página que se está viendo.
- El PDF de "General" reemplaza al de HU-21 e incluye los indicadores de asistencia.

▶ Reglas

- Los números se calculan al consultar. El tablero sigue siendo de sólo lectura.
  **Puntos de función:** 8

**ID:** HU-42 | **Sprint:** 3
**Título:** Anular un pago
**Como…** Personal de mesa de entrada
**Necesito…** Anular un pago registrado por error, indicando el motivo.
**Para…** Corregir cobros mal cargados sin borrar el registro y sin dejar turnos marcados como pagados.
**Criterios de Aceptación:**

- Es la anulación de pagos que HU-13, HU-14 y HU-15 dejaron fuera de alcance. La mesa de entrada anula de forma directa, sin aprobación.

▶ Dónde

- Desde el detalle de un pago (desde el detalle de un turno pagado o desde “Pagos realizados”, HU-36), botón “Anular pago”.
- Se anula el pago completo, con todos sus turnos. No se anula un turno suelto. Si el error fue en una parte del pago, se anula todo y se vuelve a cobrar lo correcto.

▶ Qué se pide

- Motivo obligatorio, de una lista: “Error de carga”, “Forma de pago equivocada” u “Otro”. Detalle de texto libre, hasta 500 caracteres, obligatorio si el motivo es “Otro”.
- Confirmación con el resumen del pago: “¿Anular el comprobante N.º 123 de Juan Pérez por $ 32.000 (4 turnos)?”.

▶ Avisos en la confirmación (informan, no bloquean)

- Deuda: si al anular el alumno queda con turnos adeudados de 30 días o más (HU-29), avisa: “Al anular, el alumno queda con deuda de más de 30 días y no podrá sacar turnos hasta regularizarla”.
- Precio: si el precio vigente de la materia es distinto del cobrado, avisa: “Los turnos se volverán a cobrar a $ 9.000 por hora; en este pago se cobraron a $ 8.000”.
- Transferencia compartida: si otros pagos tienen el mismo número de operación y banco o billetera (HU-23), los lista: “Hay 2 pagos más con esta transferencia: Ana Pérez (N.º 124) y Luis Pérez (N.º 125). No se anulan con este pago”.

▶ Qué pasa al anular

- El pago no se elimina: pasa a estado “Anulado” y conserva todos sus datos, su forma de pago y su comprobante adjunto (HU-24).
- Sus turnos vuelven a pago “Pendiente”: reaparecen como adeudados o próximos (HU-16) y se pueden volver a cobrar en un pago nuevo, con el precio vigente de la materia en ese momento (HU-15).
- Como ya no están pagados, esos turnos se pueden cancelar (HU-13) o liberar al finalizar la serie (HU-14), salvo que tengan asistencia registrada (HU-22).
- El comprobante de pago en PDF se puede seguir consultando, con la leyenda “ANULADO”, el motivo y la fecha de anulación. El número de comprobante no se reutiliza.
- Un pago anulado no se puede volver a activar: si fue un error, se registra un pago nuevo.
- Los pagos anulados no suman al total cobrado (HU-36, HU-39) y se muestran marcados como “Anulado” en el historial (HU-36) y en “Mis pagos” del alumno (HU-37).
- El detalle muestra quién anuló el pago y cuándo, con el motivo.
- Mensaje de éxito: “Pago anulado. Sus turnos volvieron a quedar pendientes de pago”.

▶ Fuera de alcance en este incremento

- Anulación parcial de un pago, “Anular y volver a cobrar” en un solo paso, plazo máximo o intervención del gerente, anulación conjunta de los pagos de una misma transferencia y registro de devolución de dinero.
  **Puntos de función:** 5

**ID:** HU-43 | **Sprint:** 3
**Título:** Porcentaje del centro sobre cada cobro
**Como…** Gerente
**Necesito…** Definir el porcentaje que el centro retiene de cada turno cobrado, y que cada cobro guarde el porcentaje con el que se registró.
**Para…** Saber cuánto de lo cobrado es del centro y cuánto le corresponde a cada profesor.
**Criterios de Aceptación:**
Pedido de los clientes durante el Sprint 3. Es la base del reparto entre el centro y los profesores (HU-44 a HU-47). Amplía HU-15: el profesor cobra un porcentaje de lo que pagan sus alumnos, no un sueldo.

▶ Configuración del porcentaje

- El menú del gerente suma la opción "Configuración", que en este incremento sólo tiene "Porcentaje del centro".
- El valor inicial es 15 %. Es un número mayor o igual a 0 y menor que 100, con hasta dos decimales. Si no cumple, el sistema lo indica y no lo guarda.
- Es uno solo para todo el centro: vale igual para todos los profesores y todas las materias.
- Al cambiarlo, el sistema pide confirmación: "Desde ahora, el centro retendrá el 18 % de cada turno cobrado. Los cobros ya registrados conservan su porcentaje".
- La pantalla muestra el historial de cambios: porcentaje, desde qué fecha y hora rige y quién lo cambió.
- Sólo el gerente ve y cambia el porcentaje. Los demás roles no acceden, y el sistema rechaza el cambio aunque se intente por fuera de las pantallas.

▶ Reparto de cada turno cobrado

- Al registrar un pago (HU-15, HU-23, HU-25), cada turno incluido guarda el porcentaje del centro vigente en ese momento, igual que hoy guarda su importe.
- Parte del centro = importe del turno × porcentaje, redondeada a centavos. Parte del profesor = importe del turno − parte del centro, para que las dos sumen siempre el importe. Por ejemplo, un turno de $ 8.000 al 15 %: $ 1.200 para el centro y $ 6.800 para el profesor.
- Cambiar el porcentaje no modifica los turnos ya cobrados: rige para los cobros que se registren desde ese momento.
- Si un pago se anula (HU-42) y sus turnos se vuelven a cobrar, el nuevo cobro toma el porcentaje vigente en ese momento.
- La parte del profesor es del profesor que da la clase: si el turno se reprogramó con otro profesor (HU-20), le corresponde al nuevo.

▶ Dónde se ve el reparto

- El gerente ve el reparto de cada turno (importe, porcentaje, parte del centro y parte del profesor) en el detalle del pago (HU-36), en las liquidaciones (HU-44), en la caja diaria (HU-46) y en el tablero (HU-47).
- El profesor ve el reparto sólo de sus propios turnos (HU-45).
- El personal de mesa de entrada y el alumno no ven el reparto: el comprobante de pago (HU-15) no cambia.

▶ Fuera de alcance en este incremento

- Porcentajes distintos por profesor o por materia y programar un cambio de porcentaje para una fecha futura.
  **Puntos de función:** (a estimar)

**ID:** HU-44 | **Sprint:** 3
**Título:** Liquidación mensual y pago a los profesores
**Como…** Gerente
**Necesito…** Ver cuánto le corresponde a cada profesor por cada mes y registrar la transferencia con la que le pago.
**Para…** Pagarle a cada profesor lo que generó con sus clases dadas y cobradas, y dejar el pago respaldado.
**Criterios de Aceptación:**
Depende de HU-22 (asistencia), HU-42 (anulación) y HU-43 (porcentaje del centro). Los profesores cobran en forma mensual, por transferencia.

▶ Cuándo se le debe un turno al profesor

- Un turno se le debe al profesor cuando cumple las dos condiciones: está pagado (con un pago no anulado) y tiene la asistencia registrada como "Realizado" o "Ausente" (HU-22). Le corresponde la parte del profesor que guardó el cobro (HU-43).
- Un turno "Ausente" pagado también se le debe, porque el lugar estuvo reservado (igual que en la deuda, HU-16).
- Si la clase se dio y el alumno todavía no pagó, el profesor espera: el turno se le debe cuando se registra el pago.
- Si el alumno pagó por adelantado, el turno se le debe cuando se registra la asistencia.
- La fecha en que el turno pasa a debérsele es la más tardía entre la del registro del pago y la del registro de la asistencia. Esa fecha define en qué liquidación entra.
- Un turno pagado que el sistema cerró como "Sin registrar" (pasaron los 7 días sin asistencia, HU-22) no se le debe al profesor: su importe completo queda para el centro.
- Un turno cancelado no se cobra, por lo que nunca se le debe.

▶ Liquidación del mes

- El menú del gerente suma la opción "Liquidaciones". Se elige el mes; por defecto, el último mes terminado.
- La liquidación de un mes incluye, para cada profesor, todos los turnos que pasaron a debérsele hasta el último día de ese mes y que no entraron en una liquidación anterior. Por ejemplo, un turno dado en octubre y pagado en noviembre entra en la liquidación de noviembre.
- El listado muestra una fila por profesor: cantidad de turnos, total cobrado de esos turnos, parte del centro, parte del profesor, ajustes, total a pagar y estado ("Pendiente de pago" o "Pagada"). Aparecen sólo los profesores con turnos o ajustes en ese mes, aunque estén inactivos.
- El mes en curso se puede consultar como "En curso": muestra lo acumulado hasta hoy, pero no se puede pagar hasta que el mes termine.
- Al abrir una liquidación se ve el detalle: cada turno con fecha, horario, alumno, materia, número de comprobante del cobro, importe cobrado, porcentaje del centro y parte del profesor; y los ajustes, con su motivo.
- Mientras una liquidación no esté pagada, se calcula al consultarla: si se anula un pago que incluía alguno de sus turnos (HU-42), ese turno deja de figurar.

▶ Ajustes por anulaciones

- Si se anula un pago (HU-42) cuyos turnos ya estaban en una liquidación pagada, la parte del profesor de esos turnos se descuenta en su próxima liquidación, como ajuste negativo: "Ajuste por anulación del comprobante N.º 123 (2 turnos)".
- Si el total de una liquidación queda negativo, no se paga: pasa como ajuste a la liquidación del mes siguiente, y el listado lo indica ("Saldo a descontar el mes próximo").

▶ Registrar el pago al profesor

- En una liquidación de un mes terminado, en estado "Pendiente de pago" y con total mayor a 0, el botón "Registrar pago".
- Forma de pago: transferencia, única forma de pago a profesores en este incremento.
- Datos: fecha de la transferencia (obligatoria, no puede ser futura ni anterior al último día del mes liquidado), número de operación (obligatorio, hasta 50 caracteres), comprobante de la transferencia (opcional, JPG, PNG o PDF de hasta 5 MB, con las mismas reglas de HU-24) y observaciones (opcional, hasta 500 caracteres).
- El monto es el total de la liquidación: no se escribe a mano y no hay pagos parciales.
- Confirmación: "¿Registrar el pago de $ 245.000 a Gómez, Ana por la liquidación de octubre de 2026?".
- Al confirmar, la liquidación pasa a "Pagada" y queda cerrada: sus turnos ya no entran en otra liquidación y sus importes no cambian.
- Mensaje de éxito: "Pago registrado. La liquidación de octubre de Gómez, Ana quedó pagada".
- El detalle de una liquidación pagada muestra la fecha, el número de operación, el comprobante adjunto (si tiene), quién registró el pago y cuándo.

▶ PDF

- Cada liquidación tiene el botón "Generar PDF": encabezado oficial del centro (HU-11), profesor, mes, detalle de turnos, ajustes y totales; si está pagada, también la fecha y el número de operación de la transferencia.
- Nombre del archivo: profesor y mes (por ejemplo, "liquidacion_gomez-ana_2026-10.pdf").

▶ Reglas

- Sólo el gerente accede a "Liquidaciones". Los importes y totales los calcula el sistema.

▶ Fuera de alcance en este incremento

- Pagos parciales o adelantos a cuenta, pagar antes de que termine el mes, pagar en efectivo, anular el pago de una liquidación y la facturación o las obligaciones impositivas del profesor.
  **Puntos de función:** (a estimar)

**ID:** HU-45 | **Sprint:** 3
**Título:** Mis ingresos
**Como…** Profesor
**Necesito…** Ver cuánto llevo generado en el mes, qué clases todavía no se me pueden pagar y mis liquidaciones.
**Para…** Saber cuánto voy a cobrar y por qué, sin tener que preguntarle al gerente.
**Criterios de Aceptación:**
Depende de HU-43 y HU-44. Es la vista del profesor de su propia liquidación.

▶ Dónde

- El menú del profesor suma la opción "Mis ingresos". Sólo muestra datos del propio profesor.

▶ Qué muestra

- "Este mes": los turnos que ya se le deben en el mes en curso (HU-44), con fecha, horario, alumno, materia, importe cobrado, porcentaje del centro y su parte, y el total acumulado. Aclaración: "Se te paga a mes vencido, por transferencia".
- "Clases dadas sin cobrar": las clases con asistencia registrada ("Realizado" o "Ausente") que el alumno todavía no pagó, con fecha, horario, alumno y materia. Aclaración: "Se suman a tu liquidación cuando el alumno las pague".
- "Clases cobradas sin asistencia": los turnos ya pagados cuya asistencia todavía no registró y siguen dentro del plazo de 7 días (HU-22), con la fecha límite y un acceso a "Asistencia". Aclaración: "Registrá la asistencia para que se sumen a tu liquidación. Si vence el plazo, no se te pagan".
- "Mis liquidaciones": una fila por mes con el total, el estado ("Pendiente de pago" o "Pagada", con la fecha de la transferencia) y el botón "Generar PDF", con el mismo documento de HU-44. Al abrir una se ve su detalle de turnos y ajustes.

▶ Reglas

- Es de sólo lectura. Los importes los calcula el sistema con las mismas reglas de HU-44: lo que ve el profesor coincide con lo que ve el gerente.
- El profesor no ve datos de otros profesores, ni los totales del centro, ni la forma de pago o los comprobantes de las familias.
- Si no tiene nada en una sección, la sección lo indica (por ejemplo, "No tenés clases dadas sin cobrar").
  **Puntos de función:** (a estimar)

**ID:** HU-46 | **Sprint:** 3
**Título:** Caja diaria
**Como…** Gerente
**Necesito…** Ver, para un día, todo el dinero que entró y salió del centro, separado por forma de pago, con la parte del centro y la de los profesores.
**Para…** Controlar el movimiento de dinero de cada día.
**Criterios de Aceptación:**
Depende de HU-23 (medios de pago), HU-42 (anulación), HU-43 (porcentaje) y HU-44 (pagos a profesores). La caja se arma sola con lo que ya registra el sistema.

▶ Dónde

- El menú del gerente suma la opción "Caja diaria". Por defecto muestra el día de hoy; se puede elegir otra fecha o pasar al día anterior y al siguiente. No se pueden elegir fechas futuras.

▶ Movimientos del día

- Lista de movimientos ordenada por hora de registro:
  - Cobros (+): figuran el día de su fecha de pago (HU-15), con hora de registro, número de comprobante, alumno, forma de pago e importe.
  - Anulaciones (−): figuran el día en que se anula el pago, no el del cobro original, con el número de comprobante, el alumno, la forma de pago, el importe y el motivo (HU-42). Si un pago se cobra y se anula el mismo día, se ven los dos movimientos.
  - Pagos a profesores (−): figuran el día de la fecha de la transferencia, con profesor, mes liquidado, número de operación e importe (HU-44).
- Se puede filtrar por tipo de movimiento (cobros, anulaciones o pagos a profesores) y por forma de pago.
- Desde cada cobro o anulación se abre el detalle del pago (HU-36); desde cada pago a profesor, su liquidación (HU-44).

▶ Resumen del día

- Ingresos por forma de pago (efectivo, transferencia y tarjeta de débito) y su total, ya descontadas las anulaciones del día.
- De esos ingresos: la parte del centro y la parte de los profesores, según el porcentaje guardado en cada cobro (HU-43).
- Egresos: total pagado a profesores en el día.
- Saldo del día: ingresos menos egresos.
- Si el día no tiene movimientos, la pantalla lo indica: "No hubo movimientos de caja el 15/10".

▶ PDF

- Botón "Generar PDF" con la caja del día: encabezado oficial del centro (HU-11), fecha, resumen y lista completa de movimientos. Nombre del archivo: "caja_2026-10-15.pdf".

▶ Reglas

- Sólo el gerente accede a "Caja diaria". Es de sólo lectura: los movimientos salen de los cobros, las anulaciones y los pagos a profesores ya registrados.
- Los importes y totales los calcula el sistema al consultar.
  **Puntos de función:** (a estimar)

**ID:** HU-47 | **Sprint:** 3
**Título:** Pestaña "Finanzas" del tablero
**Como…** Gerente
**Necesito…** Ver en el tablero cuánto se cobró, cuánto le queda al centro y cuánto se les pagó y se les debe a los profesores en un período.
**Para…** Conocer el margen que deja el centro y lo que tiene comprometido con los profesores.
**Criterios de Aceptación:**
Amplía HU-39: el tablero suma la pestaña "Finanzas". Depende de HU-43 y HU-44.

▶ Estructura

- La pestaña "Finanzas" se agrega después de "Asistencia". Usa el selector de período común del tablero y la misma estructura de las pestañas nuevas de HU-39: hasta 4 números principales arriba y, debajo, como mucho dos tablas paginadas de a 10.

▶ Números principales

- Total cobrado: pagos no anulados con fecha de pago dentro del período (el mismo número de la pestaña "General").
- Margen del centro: suma de la parte del centro de esos cobros, con su porcentaje sobre el total cobrado. Incluye el importe completo de los turnos cobrados que el sistema cerró "Sin registrar" (HU-44), y lo informa aparte: "Incluye $ 13.600 de turnos sin asistencia registrada".
- Pagado a profesores: total de las liquidaciones pagadas con fecha de transferencia dentro del período.
- Saldo a pagar a profesores: lo que se les debe a la fecha de hoy (turnos que ya se les deben y todavía no se pagaron). No depende del período, igual que el total adeudado de HU-21.

▶ Tablas

- Por profesor: turnos cobrados en el período, total cobrado de sus turnos, parte del centro, parte del profesor, pagado en el período y saldo pendiente a hoy. Se puede ordenar por cualquier columna; paginada.
- Evolución mensual: los últimos 6 meses hasta el fin del período, con total cobrado, margen del centro y pagado a profesores de cada mes.

▶ PDF

- Botón "Generar PDF" de la pestaña, como las demás de HU-39: encabezado oficial (HU-11), período, números principales y las dos tablas completas.

▶ Reglas

- Sólo el gerente ve la pestaña. Los números se calculan al consultar y el tablero sigue siendo de sólo lectura.
- Los pagos anulados (HU-42) no suman en ningún número.
  **Puntos de función:** (a estimar)
