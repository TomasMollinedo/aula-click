// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio.

/**
 * Materia con su estado, tal como la leen otras features (asignación de materias al profesor).
 * No viaja por HTTP: es lo que devuelve `materiasRepository.buscarPorIds`.
 */
export type MateriaConEstado = { id: number; nombre: string; estado: 'ACTIVO' | 'INACTIVO' }
