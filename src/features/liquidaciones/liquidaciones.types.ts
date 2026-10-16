import type { PaginatedResponse, UsuarioAuditoria } from '@/types'

// Tipos de lo que devuelve la API de liquidaciones (docs/contrato-api.md → Liquidaciones).

/** Los estados de la liquidación de un profesor en un mes, en el orden en que se ofrecen. */
export const ESTADOS_LIQUIDACION = [
  'EN_CURSO',
  'PENDIENTE_DE_PAGO',
  'SALDO_A_DESCONTAR',
  'PAGADA',
  'DESCONTADA',
] as const

/** El estado de la liquidación de un profesor en un mes. */
export type EstadoLiquidacion = (typeof ESTADOS_LIQUIDACION)[number]

export type ProfesorLiquidacion = {
  id: number
  nombre: string
  apellido: string
}

/** Importes en pesos: `parteProfesor + totalAjustes = total`; los ajustes son negativos. */
export type TotalesLiquidacion = {
  cantidadTurnos: number
  totalCobrado: number
  parteCentro: number
  parteProfesor: number
  totalAjustes: number
  total: number
}

/** Una fila del listado del mes: la liquidación de un profesor. */
export type FilaLiquidacion = TotalesLiquidacion & {
  profesor: ProfesorLiquidacion
  estado: EstadoLiquidacion
  /** `YYYY-MM-DD`, solo en una `PAGADA`. */
  fechaTransferencia: string | null
  /** `YYYY-MM`, solo en una `DESCONTADA`: el mes de la liquidación que absorbió el saldo. */
  descontadaEnMes: string | null
}

/** `GET /liquidaciones`: las del mes, paginadas, con los totales de todo el listado. */
export type LiquidacionesDelMes = PaginatedResponse<FilaLiquidacion> & {
  /** `YYYY-MM`: el pedido o, sin `mes`, el último terminado. */
  mes: string
  totales: TotalesLiquidacion & {
    /** Lo que hay que transferir: la suma de los totales mayores a 0 (un saldo negativo no se paga). */
    totalAPagar: number
  }
}

export type ListarLiquidacionesDelMesParams = {
  /** `YYYY-MM`; sin mes, el por defecto de la API. */
  mes?: string
  /** Sólo las liquidaciones de este profesor; sin él, las de todos. */
  profesorId?: number
  /** Sólo las liquidaciones en este estado; sin él, todas. */
  estado?: EstadoLiquidacion
  page: number
}

/** Un turno liquidado, en el orden de la API. */
export type TurnoDeLiquidacion = {
  /** `YYYY-MM-DD`. */
  fecha: string
  horaInicio: string
  horaFin: string
  alumno: { id: number; nombre: string; apellido: string }
  materia: { id: number; nombre: string }
  /** Del cobro del turno. */
  numeroComprobante: number
  importe: number
  /** El porcentaje del centro de ese cobro (15 = 15 %). */
  porcentaje: number
  parteProfesor: number
}

/** Un ajuste (negativo); el `texto` lo arma la API. */
export type AjusteDeLiquidacion = {
  tipo: 'ANULACION' | 'SALDO_ANTERIOR'
  texto: string
  importe: number
}

/** El comprobante de la transferencia, como viene en el detalle: sin URL. */
export type ComprobanteDeTransferencia = {
  id: number
  nombre: string
  tipo: 'image/jpeg' | 'image/png' | 'application/pdf'
  bytes: number
  adjuntadoPor: UsuarioAuditoria
  /** Instante ISO 8601 en UTC. */
  adjuntadoEl: string
}

/** El cierre de una `PAGADA` o una `DESCONTADA`. */
export type LiquidacionCerrada = {
  liquidacionId: number
  /** `YYYY-MM-DD`; `null` en una `DESCONTADA`. */
  fechaTransferencia: string | null
  numeroOperacion: string | null
  observaciones: string | null
  /** `YYYY-MM`, solo en una `DESCONTADA`. */
  descontadaEnMes: string | null
  comprobanteAdjunto: ComprobanteDeTransferencia | null
  registradaPor: UsuarioAuditoria
  /** Instante ISO 8601 en UTC. */
  registradaEl: string
}

/** `GET /liquidaciones/profesores/{profesorId}/{mes}`. Sin movimientos, `estado: null`. */
export type LiquidacionDetalle = TotalesLiquidacion & {
  profesor: ProfesorLiquidacion
  /** `YYYY-MM`. */
  mes: string
  estado: EstadoLiquidacion | null
  turnos: TurnoDeLiquidacion[]
  ajustes: AjusteDeLiquidacion[]
  cerrada: LiquidacionCerrada | null
  acciones: { registrarPago: boolean }
}

/**
 * `GET /liquidaciones/mis-liquidaciones/{mes}` (T-126): el mismo detalle, sin el comprobante, las
 * observaciones ni quién registró el pago.
 */
export type MiLiquidacionDetalle = Omit<LiquidacionDetalle, 'cerrada'> & {
  cerrada: Omit<
    LiquidacionCerrada,
    'comprobanteAdjunto' | 'observaciones' | 'registradaPor' | 'registradaEl'
  > | null
}

/**
 * `GET /adjuntos/liquidaciones/{liquidacionId}`: el comprobante con la URL para abrirlo. La URL
 * vence a los 15 minutos: se usa como enlace y no se guarda.
 */
export type AdjuntoDeLiquidacion = ComprobanteDeTransferencia & { url: string }

/**
 * Body de `POST /liquidaciones/profesores/{profesorId}/{mes}/pago` (T-132). El monto no se manda:
 * `totalConfirmado` es el `total` que mostró el detalle, para que la API rechace si cambió.
 */
export type RegistrarPagoLiquidacion = {
  /** `YYYY-MM-DD`. */
  fechaTransferencia: string
  numeroOperacion: string
  comprobanteAdjuntoId: number | null
  observaciones: string | null
  totalConfirmado: number
}

/** Respuesta 201 del pago de una liquidación. */
export type PagoLiquidacionRegistrado = {
  liquidacionId: number
  profesor: ProfesorLiquidacion
  /** `YYYY-MM`. */
  mes: string
  total: number
  /** `YYYY-MM-DD`. */
  fechaTransferencia: string
}
