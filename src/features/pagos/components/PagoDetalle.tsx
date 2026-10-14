import type { ReactNode } from 'react'

import type { PagoParaAcciones } from '@/types/pago'

export type PagoDetalleProps = {
  pagoId: number
  onCerrar: () => void
  /**
   * Las acciones del pie. Las compone `app/` con componentes de otras features (`anulaciones`:
   * `AccionAnularPago`) y recibe el pago con lo que la API permite hacer (`pago.acciones`). Sin
   * esta prop el detalle es de solo lectura (el gerente).
   */
  renderAcciones?: (pago: PagoParaAcciones) => ReactNode
}

/**
 * El detalle de un pago como modal (`?pago=<pagoId>`, `useDetallePagoEnUrl`): lo abren "Pagos
 * realizados" y el detalle de un turno pagado (HU-24, HU-36). La completa T-99.
 */
export function PagoDetalle(props: PagoDetalleProps) {
  void props
  return null
}
