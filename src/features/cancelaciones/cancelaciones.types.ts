import type { MotivoCancelacion } from '@/types/ocurrencia'

// Tipos de la API de cancelaciones (docs/contrato-api.md → Cancelaciones).

export type { MotivoCancelacion }

/** Lo que el diálogo necesita de una ocurrencia para identificarla y describirla. */
export type OcurrenciaACancelar = {
  turnoId: number
  /** Fecha de la ocurrencia (`YYYY-MM-DD`): con `turnoId` la identifica. */
  fecha: string
  horaInicio: string
  horaFin: string
  materia: { nombre: string }
}

/** Body de `POST /cancelaciones`. */
export type CancelarTurnosBody = {
  ocurrencias: { turnoId: number; fecha: string }[]
  motivo: MotivoCancelacion
  /** Se omite si no hay detalle. */
  detalle?: string
}

export type CancelacionesCreadas = { cantidad: number }
