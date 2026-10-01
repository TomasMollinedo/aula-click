import type { MotivoCancelacion } from '@/types/ocurrencia'

// Tipos de la API de finalizaciones (docs/contrato-api.md → Finalizaciones).

export type { MotivoCancelacion }

/** Un turno pagado desde la fecha elegida: impide finalizar desde esa fecha. */
export type TurnoPagado = {
  fecha: string
  horaInicio: string
  horaFin: string
  /** Lo cobrado. */
  importe: number
}

/** Un tramo posterior del mismo alumno, materia y hora: se finaliza desde su propio detalle. */
export type TramoPosterior = {
  turnoId: number
  fechaInicio: string
  /** `null` en un tramo sin fin. */
  fechaFin: string | null
}

/** Respuesta de `GET /finalizaciones/previa`. */
export type PreviaFinalizacion = {
  /** Turnos no cancelados que se liberan; `null` si la serie no tiene fin. */
  cantidad: number | null
  desde: string
  /** La última ocurrencia de la serie; `null` si no tiene fin. */
  hasta: string | null
  pagadas: TurnoPagado[]
  /** `null` si no hay pagados. */
  ultimaFechaPagada: string | null
  /** La primera fecha que se puede elegir; `null` sin pagados o si llegan hasta el final. */
  fechaDesdeMinima: string | null
  otrosTramos: TramoPosterior[]
}

export type PreviaFinalizacionParams = {
  turnoId: number
  fechaDesde: string
}

/** Body de `POST /finalizaciones`. */
export type FinalizarTurnoBody = {
  turnoId: number
  fechaDesde: string
  motivo: MotivoCancelacion
  /** Se omite si no hay detalle. */
  detalle?: string
}

/** Respuesta 201 de `POST /finalizaciones`: `cantidad`, `desde` y `hasta` como en la previa. */
export type FinalizacionCreada = {
  turnoId: number
  cantidad: number | null
  desde: string
  hasta: string | null
}
