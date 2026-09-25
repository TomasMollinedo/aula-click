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

- El DNI es único entre alumnos.
- Datos obligatorios del alta: nombre, apellido, DNI, fecha de nacimiento, email y teléfono. Si es menor de edad (menos de 18 años a la fecha de hoy), además nombre, apellido, teléfono y email del tutor (el DNI del tutor es opcional). El resto (datos escolares, colegio, observaciones) se completa después (T-25).
- Cumple 18 el día de su cumpleaños: ese día ya es mayor. Quien nació un 29 de febrero cumple 18 el 1 de marzo.
- La fecha de nacimiento no puede ser posterior a hoy.
- La regla del tutor vale también al editar, sobre el alumno resultante: no se puede borrar un dato obligatorio del tutor de un menor. Los datos del tutor de un mayor se conservan.
- Los alumnos tienen baja lógica (estado activo / inactivo, `ACTIVO` por defecto), pero la baja no se implementa en este release.

## Profesores y materias

- DNI y matrícula son únicos entre profesores (activos e inactivos).
- Profesores y materias tienen baja lógica (estado activo / inactivo); nada se borra.
- La baja del profesor es la de su usuario: un profesor inactivo es un `Usuario` inactivo, que además no puede iniciar sesión.
- Un profesor inactivo no recibe materias, bloques ni turnos nuevos.
- No se puede dar de baja un profesor, quitarle una materia, dar de baja una materia que tiene profesores, ni editar o eliminar un bloque, si hay **turnos vigentes**.
- Un profesor dado de baja se puede reactivar: vuelve a `ACTIVO`, puede iniciar sesión de nuevo, vuelve a aparecer en el listado por defecto y queda disponible para agendar turnos, con sus materias y bloques intactos. La reactivación no revalida nada.
- **Capacidad del profesor** (T-27, HU-02): entero obligatorio, mínimo 1. Es la cantidad máxima de alumnos que atiende a la vez en una franja de una hora; es un dato del profesor, no del bloque. No se puede bajar a un valor menor que la ocupación simultánea máxima vigente del profesor en alguna franja (pendiente de implementar: depende de que existan turnos reales, HU-05/HU-07).

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
- **Tipos** (T-35):
  - `SESION_UNICA`: una fecha (`fechaFin = fechaInicio`).
  - `RECURRENTE`: una fecha de inicio y una de fin opcional (sin fin = sigue indefinidamente). Sus **ocurrencias** son todas las fechas de ese día de la semana dentro del rango.
  - La fecha de inicio y la de fin (si hay) tienen que caer en el día de la semana del bloque.
- **La fecha de inicio es hoy o posterior**: no se registran turnos con fecha pasada (hoy se permite aunque la hora ya haya pasado).
- **Turno vigente:** está `ACTIVO` y no tiene fecha de fin, o su fecha de fin es >= hoy.
- **Turno que ocupa lugar** en una hora en una fecha `d`: está `ACTIVO`, su fecha de inicio es <= `d` y no tiene fin o su fin es >= `d`. Es una sola condición para los dos tipos (una sesión única es el caso inicio = fin).
- **Capacidad:** se controla por hora y por fecha contra la capacidad efectiva de esa hora (T-27: `min(profesor.capacidad, aula.capacidad)`, calculada al leer). Una fecha está llena si los turnos que ocupan lugar en ella son >= la capacidad efectiva.
- **Fechas sin lugar en un recurrente:** si algunas fechas del pedido están llenas, se rechaza con `BLOQUE_LLENO` informando, por hora, qué fechas están llenas (o desde qué fecha lo están todas). El usuario decide:
  - crearlo **solo en las fechas con lugar**: se guarda como varios turnos `RECURRENTE` ("tramos"), uno por cada racha de fechas consecutivas con lugar, que saltean las llenas. Ejemplo: lunes 9:00 del 05/10 al 30/11 con el 26/10 lleno → del 05/10 al 19/10 y del 02/11 al 30/11. El alta informa las fechas que quedaron sin turno;
  - o no crearlo.
- **Al confirmar se recalcula todo:** si alguien ocupó un lugar mientras tanto, entra en la cuenta.
- **Sin lugar en ninguna fecha** (incluida una sesión única en una hora llena): se rechaza con `BLOQUE_LLENO`, sin opción de crearlo.
- **Superposición del alumno:** un alumno no puede tener dos turnos que se pisen (mismo día y hora, con rangos de fechas que se cruzan), aunque sean de profesores distintos. Es un **rechazo total** (`ALUMNO_SUPERPUESTO`): no hay opción de crearlo en las fechas libres.
- **Prioridad** (no se ingresa a mano): Alta si el examen cae dentro de los 10 días desde la fecha del turno, Media entre 11 y 20 días, Baja en otro caso o si no hay fecha de examen. No se guarda: se calcula al leer.
- Un turno está `ACTIVO` o `CANCELADO`; la UI muestra `ACTIVO` como **"Agendado"** (no es otro valor). Que sea vigente se decide por sus fechas, no por su estado. Un turno `CANCELADO` no es vigente ni ocupa lugar: no impide ninguna baja.

## Auditoría

Todas las entidades registran quién las creó y quién las modificó por última vez, y cuándo (`createdById`, `updatedById`, `createdAt`, `updatedAt`).
