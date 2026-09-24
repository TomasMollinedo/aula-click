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
- **Capacidad del profesor** (T-27, HU-02): entero obligatorio, mínimo 1. Es la cantidad máxima de alumnos que atiende a la vez en una franja de una hora; es un dato del profesor, no del bloque. No se puede bajar a un valor menor que la ocupación simultánea máxima vigente del profesor en alguna franja (pendiente de implementar: depende de que existan turnos reales, HU-05/HU-07).

## Aulas

- Catálogo cargado por el seed; sin alta, edición ni baja en este release (HU-05): sólo lectura.
- El nombre es único. La capacidad es un entero obligatorio, mínimo 1.
- Tienen baja lógica (estado activo / inactivo, `ACTIVO` por defecto), aunque en este release nada la cambia salvo el seed.

## Turnos

- Un turno une a un alumno con un bloque de un profesor e indica la materia. La materia debe estar asignada a ese profesor.
- Tipos: `RECURRENTE` (fecha de inicio y fin opcional) o `SESION_UNICA` (una fecha). Las fechas deben coincidir con el día de la semana del bloque.
- **Turno vigente:** un recurrente sin fecha de fin o con fin >= hoy, o una sesión única con fecha >= hoy.
- Un alumno no puede tener dos turnos superpuestos en fecha y horario.
- **Capacidad del bloque:** se controla por cada fecha en que aplica el turno, contra la capacidad efectiva de esa hora (T-27: `min(profesor.capacidad, aula.capacidad)`, con `Aula` como catálogo propio; no es un valor fijo guardado en el bloque). Si una fecha puntual de un recurrente está llena, se informa qué fechas no pueden (`BLOQUE_LLENO`, con las fechas en `details`). Qué pasa con esas fechas (excepciones) está pendiente (D-04); el mecanismo de bloqueo concurrente sobre esta capacidad se define al implementar `turnos` (HU-07; ver `convenciones-backend.md` → Concurrencia en la capacidad de un bloque).
- **Prioridad** (no se ingresa a mano): Alta si el examen cae dentro de los 10 días desde la fecha del turno, Media entre 11 y 20 días, Baja en otro caso o si no hay fecha de examen.
- Un recurrente se guarda como regla (fecha de inicio y fin opcional); las fechas en que no aplica se registran como excepciones y las ocurrencias se calculan al consultar (T-20). La prioridad tampoco se guarda: se calcula al leer.
- Un turno está `ACTIVO` o `CANCELADO`; que sea vigente se decide por sus fechas, no por su estado. Un turno `CANCELADO` no cuenta como vigente: no impide ninguna baja.

## Auditoría

Todas las entidades registran quién las creó y quién las modificó por última vez, y cuándo (`createdById`, `updatedById`, `createdAt`, `updatedAt`).
