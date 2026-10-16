import type { ListarLiquidacionesDelMesParams } from '../liquidaciones.types'

// Todo cuelga de `all`: registrar un pago (T-132) lo invalida y refresca el listado, el detalle y
// el comprobante.
export const liquidacionesKeys = {
  /** Prefijo de todo: invalidarlo refresca el listado y el detalle. */
  all: ['liquidaciones'] as const,
  delMes: ({ mes, profesorId, estado, page }: ListarLiquidacionesDelMesParams) =>
    [...liquidacionesKeys.all, 'del-mes', { mes, profesorId, estado, page }] as const,
  detalle: (profesorId: string, mes: string) =>
    [...liquidacionesKeys.all, 'detalle', profesorId, mes] as const,
  miDetalle: (mes: string) => [...liquidacionesKeys.all, 'mi-detalle', mes] as const,
  comprobante: (liquidacionId: number) =>
    [...liquidacionesKeys.all, 'comprobante', liquidacionId] as const,
}
