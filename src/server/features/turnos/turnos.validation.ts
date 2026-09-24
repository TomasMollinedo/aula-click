// Schemas Zod de entrada, salida y params. Son la fuente del OpenAPI. Sin reglas de negocio.

/** Cantidad de turnos vigentes de una materia. No viaja por HTTP: la leen otras features. */
export type TurnosVigentesPorMateria = { materiaId: number; cantidad: number }

/** Cantidad de turnos vigentes de una fila de `bloque_agenda`. No viaja por HTTP. */
export type TurnosVigentesPorBloque = { bloqueAgendaId: number; cantidad: number }

/**
 * Turnos que ocupan lugar en una fila de `bloque_agenda` en una fecha (`YYYY-MM-DD`). No viaja
 * por HTTP: lo lee `bloques` para la ocupación del horario.
 */
export type OcupacionPorBloque = { bloqueAgendaId: number; fecha: string; cantidad: number }
