// Tipos de `GET /api/v1/tablero`, `GET /api/v1/tablero/asistencia` y `GET /api/v1/tablero/finanzas`
// (HU-21, HU-39 y HU-47), según
// docs/contrato-api.md → Tablero. Solo agregados del período: nunca datos de un alumno, un pago o
// una agenda. Los números llegan sin formato (ni pesos ni `%`): los textos los pone la UI.

import type { PaginatedResponse } from '@/types'

/** `porcentaje` es de 0 a 100 con un decimal. */
export type Conteo = { cantidad: number; porcentaje: number }

/**
 * La forma de pago por su código fijo, el mismo de `features/pagos` (nunca por el nombre). Se
 * declara acá porque una feature de UI no importa los tipos de otra: si los valores dejaran de
 * coincidir con los de la API, no compilaría el `Record` de etiquetas.
 */
export type CodigoFormaPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO'

export const CODIGOS_FORMA_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'DEBITO'] as const

export type MateriaConDemanda = {
  materia: { id: number; nombre: string }
  cantidad: number
}

export type ProfesorConMasTurnos = {
  profesor: { id: number; nombre: string; apellido: string }
  /** Turnos no cancelados del período en sus horas: alumnos con turno con ese profesor. */
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
    /** Turnos con asistencia "Presente"; el porcentaje es sobre los que tienen asistencia. */
    asistio: Conteo
    /** Turnos con asistencia "Ausente"; el porcentaje es sobre los que tienen asistencia. */
    noAsistio: Conteo
  }
  ocupacion: {
    turnos: number
    capacidad: number
    /** No se recorta a 100: puede superarlo si bajaron una capacidad. */
    porcentaje: number
  }
  alumnos: {
    nuevos: number
    /** Alumnos distintos con al menos un turno realizado en el período. */
    atendidos: number
  }
  materiasConMasDemanda: MateriaConDemanda[]
  /** Hasta 5, por turnos no cancelados del período (descendente). */
  profesoresConMasTurnos: ProfesorConMasTurnos[]
  pagos: {
    totalCobrado: number
    /** El mismo total por forma de pago: las tres claves siempre vienen, con `0` si no hubo. */
    cobradoPorForma: Record<CodigoFormaPago, number>
    /** A la fecha `hoy`, no del período. */
    totalAdeudado: number
  }
}

/** El período que se le pide a la API: los dos extremos son obligatorios. */
export type PeriodoTablero = { desde: string; hasta: string }

// ---------------------------------------------------------------------------------------------
// Sección "Asistencia" (`GET /tablero/asistencia`, HU-39)
// ---------------------------------------------------------------------------------------------

/** Columnas por las que la API ordena la tabla de profesores. */
export const ORDENES_PROFESORES = [
  'profesor',
  'asistenciasRegistradas',
  'porcentajeRegistrado',
  'cerradosSinRegistrar',
  'porcentajeCerrados',
  'sinRegistrar',
  'porcentajeSinRegistrar',
] as const

export type OrdenProfesores = (typeof ORDENES_PROFESORES)[number]

export const DIRECCIONES_ORDEN = ['asc', 'desc'] as const

export type DireccionOrden = (typeof DIRECCIONES_ORDEN)[number]

/**
 * Las cifras de asistencia de una fila (un profesor o una materia) en el período. Los turnos que ya
 * pasaron y no se cancelaron son `total`, y se reparten en tres: registradas, cerradas por el
 * sistema y sin registrar (dentro del plazo). Los tres porcentajes son sobre `total` y suman 100.
 */
export type CifrasDeAsistencia = {
  /** Turnos con la asistencia marcada, "Presente" o "Ausente" (cada hora de un alumno es un turno). */
  asistenciasRegistradas: number
  porcentajeRegistrado: number
  /** Turnos que cerró el sistema sin asistencia registrada (pasaron los 7 días del plazo). */
  cerradosSinRegistrar: number
  porcentajeCerrados: number
  /** Turnos sin registrar que todavía están dentro de los 7 días: el profesor aún puede marcarlos. */
  sinRegistrar: number
  porcentajeSinRegistrar: number
  /** Registradas, cerradas y sin registrar: la base de los tres porcentajes ("12 de 20"). */
  total: number
}

export type FilaProfesorAsistencia = CifrasDeAsistencia & {
  profesor: { id: number; nombre: string; apellido: string }
  /** Tiene al menos un turno cerrado sin registrar: lleva el distintivo de la pantalla. */
  noRegistraAsistencia: boolean
}

export type FilaMateriaAsistencia = CifrasDeAsistencia & {
  materia: { id: number; nombre: string }
}

/**
 * Los números principales de la sección. La torta (`presentes`, `ausentes`, `sinRegistrar` y
 * `cerrados`, con su porcentaje sobre `total`) es del período entero; `profesoresSinRegistrar` no
 * depende del período.
 */
export type ResumenAsistencia = {
  presentes: Conteo
  ausentes: Conteo
  /** Turnos sin registrar que todavía están dentro de los 7 días del plazo. */
  sinRegistrar: Conteo
  /** Turnos que cerró el sistema porque pasaron los 7 días sin asistencia. */
  cerrados: Conteo
  /** Los cuatro juntos: la base de los porcentajes. */
  total: number
  /**
   * La clase más antigua y la más reciente entre los turnos que cerró el sistema, o `null` si no
   * cerró ninguno (por ejemplo, en un período de esta semana).
   */
  clasesCerradas: { desde: string; hasta: string } | null
  /**
   * Profesores con clases de los últimos 7 días (hoy incluido) sin la asistencia marcada: los que
   * todavía están a tiempo de registrarla. Siempre es la ventana que termina hoy.
   */
  profesoresSinRegistrar: number
}

export type TableroAsistencia = {
  periodo: { desde: string; hasta: string }
  /** La fecha con la que la API calculó todo: separa los cerrados de los que están en plazo. */
  hoy: string
  resumen: ResumenAsistencia
  /** De a 10 filas, con su propia página. El filtro "Sólo sin registrar" afecta sólo a esta. */
  profesores: PaginatedResponse<FilaProfesorAsistencia>
  /** De a 10 filas, con su propia página y orden fijo. */
  materias: PaginatedResponse<FilaMateriaAsistencia>
}

/** Lo que recibe `GET /tablero/asistencia`: el período y el estado de las dos tablas. */
export type ParamsAsistencia = PeriodoTablero & {
  paginaProfesores: number
  paginaMaterias: number
  orden: OrdenProfesores
  direccion: DireccionOrden
  soloSinRegistrar: boolean
}

// ---------------------------------------------------------------------------------------------
// Sección "Finanzas" (`GET /tablero/finanzas`, HU-47)
// ---------------------------------------------------------------------------------------------

/** Columnas por las que la API ordena la tabla por profesor. */
export const ORDENES_FINANZAS = [
  'profesor',
  'turnosCobrados',
  'totalCobrado',
  'parteCentro',
  'parteProfesor',
  'pagado',
  'saldoPendiente',
] as const

export type OrdenFinanzas = (typeof ORDENES_FINANZAS)[number]

/**
 * Lo cobrado de un profesor en el período y su reparto. Un turno cobrado que el sistema cerró sin
 * registrar va **entero** a `parteCentro` (no se le debe al profesor), así que en cada fila
 * `parteCentro + parteProfesor` es `totalCobrado`. Los calcula el motor de liquidaciones: acá sólo
 * se muestran.
 */
export type FilaProfesorFinanzas = {
  profesor: { id: number; nombre: string; apellido: string }
  /** Turnos de sus horas cobrados en el período (por fecha de pago). */
  turnosCobrados: number
  totalCobrado: number
  parteCentro: number
  parteProfesor: number
  /** Sus liquidaciones pagadas con fecha de transferencia en el período. */
  pagado: number
  /** Lo que se le debe a `hoy`, no del período: **puede ser negativo** (un saldo a descontar). */
  saldoPendiente: number
}

/** Los cuatro números principales de la sección. */
export type ResumenFinanzas = {
  /** Pagos vigentes con fecha de pago en el período: el mismo `pagos.totalCobrado` de "General". */
  totalCobrado: number
  /** La parte del centro de lo cobrado en el período, con su porcentaje sobre `totalCobrado`. */
  margenCentro: { importe: number; porcentaje: number }
  /**
   * Cuánto de `margenCentro.importe` son turnos que el sistema cerró sin asistencia registrada (su
   * importe completo); `0` si no hay, y entonces el detalle no se muestra.
   */
  incluyeSinRegistrar: number
  /** Liquidaciones pagadas con fecha de transferencia en el período. */
  pagadoAProfesores: number
  /** Lo que se les debe **a hoy**, sin período: la suma de los saldos positivos. */
  saldoAPagarAProfesores: number
}

/** Un mes de la evolución: el último llega hasta `hasta`, no hasta fin de mes. */
export type EvolucionMes = {
  /** `YYYY-MM`. */
  mes: string
  totalCobrado: number
  margenCentro: number
  pagadoAProfesores: number
}

export type TableroFinanzas = {
  periodo: { desde: string; hasta: string }
  /** La fecha con la que la API calculó todo: la del saldo a pagar a los profesores. */
  hoy: string
  resumen: ResumenFinanzas
  /** De a 10 filas, con su propia página y su orden. */
  profesores: PaginatedResponse<FilaProfesorFinanzas>
  /** Siempre 6 meses, del más viejo al más nuevo: no se pagina ni se reordena. */
  evolucion: EvolucionMes[]
}

/** Lo que recibe `GET /tablero/finanzas`: el período y el estado de la tabla por profesor. */
export type ParamsFinanzas = PeriodoTablero & {
  page: number
  orden: OrdenFinanzas
  direccion: DireccionOrden
}
