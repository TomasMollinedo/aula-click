// Tipos de `GET /api/v1/tablero` y `GET /api/v1/tablero/asistencia` (HU-21 y HU-39), según
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
  'clasesRealizadas',
  'ausencias',
  'porcentajeAsistencia',
  'cerradosSinRegistrar',
  'dentroDelPlazo',
  'porcentajeSinRegistrar',
] as const

export type OrdenProfesores = (typeof ORDENES_PROFESORES)[number]

export const DIRECCIONES_ORDEN = ['asc', 'desc'] as const

export type DireccionOrden = (typeof DIRECCIONES_ORDEN)[number]

/** Las cifras de asistencia de una fila (un profesor o una materia) en el período. */
export type CifrasDeAsistencia = {
  /** Turnos con asistencia "Presente" (cada hora de un alumno cuenta como un turno). */
  clasesRealizadas: number
  /** Turnos con asistencia "Ausente". */
  ausencias: number
  /** Realizadas sobre realizadas más ausencias. */
  porcentajeAsistencia: number
  /** Turnos que cerró el sistema sin asistencia registrada. */
  cerradosSinRegistrar: number
  /** "Sin registrar" que todavía están en plazo. */
  dentroDelPlazo: number
  /** Cerrados sin registrar sobre los turnos no cancelados de la fila. */
  porcentajeSinRegistrar: number
}

export type FilaProfesorAsistencia = CifrasDeAsistencia & {
  profesor: { id: number; nombre: string; apellido: string }
  /** Tiene al menos un turno cerrado sin registrar: lleva el distintivo de la pantalla. */
  noRegistraAsistencia: boolean
}

export type FilaMateriaAsistencia = CifrasDeAsistencia & {
  materia: { id: number; nombre: string }
}

/** Los números principales de la sección, siempre del período entero. */
export type ResumenAsistencia = {
  /** Asistencia del centro: realizados sobre los que tienen asistencia registrada. */
  porcentajeAsistencia: number
  cerradosSinRegistrar: number
  /** Profesores con al menos un turno cerrado sin registrar. */
  profesoresSinRegistrar: number
  /** Cantidad de alumnos con menos de 75 % de asistencia. **Solo la cantidad.** */
  alumnosBajoElUmbral: number
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
