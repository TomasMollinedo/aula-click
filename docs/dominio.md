# Reglas de dominio — Aula Click (Sprint 1)

Reglas de negocio acordadas. No se modifican sin acuerdo del equipo; lo pendiente está en [`decisiones.md`](./decisiones.md) → Abiertas. Estas reglas las **decide y hace cumplir la API**; el frontend las muestra y puede anticipar errores de formato, pero no las recalcula.

## Roles

| Rol                          | Estado                                                   |
| ---------------------------- | -------------------------------------------------------- |
| Personal de mesa de entradas | Sprint 1                                                 |
| Profesor                     | Planificado                                              |
| Gerente                      | Planificado. Crea los usuarios (no hay registro público) |
| Alumno                       | A confirmar si tiene usuario y portal (D-02)             |

- Cada usuario tiene un rol. El valor técnico del campo `role` todavía no está definido (D-01).
- Cómo se crea el primer gerente con el registro público deshabilitado está pendiente (D-05).

## Alumnos

- El DNI es único entre alumnos.
- Los alumnos no tienen baja lógica.

## Profesores y materias

- DNI y matrícula son únicos entre profesores (activos e inactivos).
- Profesores y materias tienen baja lógica (estado activo / inactivo); nada se borra.
- Un profesor inactivo no recibe materias, bloques ni turnos nuevos.
- No se puede dar de baja un profesor, quitarle una materia, dar de baja una materia que tiene profesores, ni editar o eliminar un bloque, si hay **turnos vigentes**.

## Turnos

- Un turno une a un alumno con un bloque de un profesor e indica la materia. La materia debe estar asignada a ese profesor.
- Tipos: `RECURRENTE` (fecha de inicio y fin opcional) o `SESION_UNICA` (una fecha). Las fechas deben coincidir con el día de la semana del bloque.
- **Turno vigente:** un recurrente sin fecha de fin o con fin >= hoy, o una sesión única con fecha >= hoy.
- Un alumno no puede tener dos turnos superpuestos en fecha y horario.
- **Capacidad del bloque:** se controla por cada fecha en que aplica el turno. Si una fecha puntual de un recurrente está llena, se informa qué fechas no pueden (`BLOQUE_LLENO`, con las fechas en `details`). Qué pasa con esas fechas (excepciones) está pendiente (D-04).
- **Prioridad** (no se ingresa a mano): Alta si el examen cae dentro de los 10 días desde la fecha del turno, Media entre 11 y 20 días, Baja en otro caso o si no hay fecha de examen.
- Cómo se modelan los recurrentes está pendiente (D-03).

## Auditoría

Todas las entidades registran quién las creó y quién las modificó por última vez, y cuándo (`createdById`, `updatedById`, `createdAt`, `updatedAt`).
