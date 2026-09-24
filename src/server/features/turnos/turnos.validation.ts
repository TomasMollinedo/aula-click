// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio.

/** Cantidad de turnos vigentes de una materia. No viaja por HTTP: la leen otras features. */
export type TurnosVigentesPorMateria = { materiaId: number; cantidad: number }

/**
 * Turno vigente de un profesor, con los datos que HU-06 pide mostrar antes de la baja: alumno,
 * materia, fecha y horario (del bloque). No viaja por HTTP desde acá: `profesores` lo usa en el
 * `details` del 409 TURNOS_VIGENTES.
 */
export type TurnoVigentePorProfesor = {
  alumno: { id: number; nombre: string; apellido: string }
  materia: { id: number; nombre: string }
  fecha: string
  horaInicio: string
  horaFin: string
}
