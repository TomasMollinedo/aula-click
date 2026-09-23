// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio.

/** Cantidad de turnos vigentes de una materia. No viaja por HTTP: la leen otras features. */
export type TurnosVigentesPorMateria = { materiaId: number; cantidad: number }
