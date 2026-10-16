import type { ListarLiquidacionesDelMesParams } from '../liquidaciones.types'

// Todo cuelga de `all`: registrar un pago (T-132) lo invalida y refresca el listado, el detalle y
// el comprobante.
export const liquidacionesKeys = {
  /** Prefijo de todo: invalidarlo refresca el listado y el detalle. */
  all: ['liquidaciones'] as const,
  delMes: ({ mes, page }: ListarLiquidacionesDelMesParams) =>
    [...liquidacionesKeys.all, 'del-mes', { mes, page }] as const,
  detalle: (profesorId: string, mes: string) =>
    [...liquidacionesKeys.all, 'detalle', profesorId, mes] as const,
  miDetalle: (mes: string) => [...liquidacionesKeys.all, 'mi-detalle', mes] as const,
  misIngresos: () => [...liquidacionesKeys.all, 'mis-ingresos'] as const,
  misLiquidaciones: (page: number) =>
    [...liquidacionesKeys.all, 'mis-liquidaciones', page] as const,
  comprobante: (liquidacionId: number) =>
    [...liquidacionesKeys.all, 'comprobante', liquidacionId] as const,
}
