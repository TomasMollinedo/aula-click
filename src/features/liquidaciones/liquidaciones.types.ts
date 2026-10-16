import type { PaginatedResponse } from '@/types'

// Tipos de lo que devuelve la API de liquidaciones (docs/contrato-api.md → Liquidaciones).

/** El estado de la liquidación de un profesor en un mes. */
export type EstadoLiquidacion =
  'EN_CURSO' | 'PENDIENTE_DE_PAGO' | 'SALDO_A_DESCONTAR' | 'PAGADA' | 'DESCONTADA'

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
  totales: TotalesLiquidacion
}

export type ListarLiquidacionesDelMesParams = {
  /** `YYYY-MM`; sin mes, el por defecto de la API. */
  mes?: string
  page: number
}
