import type { ListarLiquidacionesDelMesParams } from '../liquidaciones.types'

export const liquidacionesKeys = {
  /** Prefijo de todo: invalidarlo refresca el listado y el detalle. */
  all: ['liquidaciones'] as const,
  delMes: ({ mes, page }: ListarLiquidacionesDelMesParams) =>
    [...liquidacionesKeys.all, 'del-mes', { mes, page }] as const,
}
