// Tipos de `GET /api/v1/tablero` (HU-21), según docs/contrato-api.md → Tablero. Solo agregados del
// período: nunca datos de un alumno, un pago o una agenda. Los números llegan sin formato (ni
// pesos ni `%`): los textos los pone la UI.

/**
 * Indicador que depende de la asistencia (HU-22, próximo sprint): es exactamente
 * `{ disponible: false }`, sin valor. La UI no lo reemplaza por ningún otro número.
 */
export type IndicadorNoDisponible = { disponible: false }

/** `porcentaje` es de 0 a 100 con un decimal, sobre `turnos.total`. */
export type Conteo = { cantidad: number; porcentaje: number }

export type MateriaConDemanda = {
  materia: { id: number; nombre: string }
  cantidad: number
}

export type Tablero = {
  /** El período pedido, extremos incluidos (`YYYY-MM-DD`). */
  periodo: { desde: string; hasta: string }
  /** La fecha con la que la API calculó todo: la de `pagos.totalAdeudado`. */
  hoy: string
  turnos: {
    /** Ocurrencias del período, incluidas las canceladas. */
    total: number
    cancelados: Conteo
    sinRegistrar: Conteo
    /** `null` si el período no incluye fechas futuras: el indicador no se muestra. */
    agendados: Conteo | null
    asistio: IndicadorNoDisponible
    noAsistio: IndicadorNoDisponible
  }
  ocupacion: {
    turnos: number
    capacidad: number
    /** No se recorta a 100: puede superarlo si bajaron una capacidad. */
    porcentaje: number
  }
  alumnos: { nuevos: number; atendidos: IndicadorNoDisponible }
  materiasConMasDemanda: MateriaConDemanda[]
  profesoresConMasActividad: IndicadorNoDisponible
  pagos: {
    totalCobrado: number
    /** A la fecha `hoy`, no del período. */
    totalAdeudado: number
  }
}

/** El período que se le pide a la API: los dos extremos son obligatorios. */
export type PeriodoTablero = { desde: string; hasta: string }
