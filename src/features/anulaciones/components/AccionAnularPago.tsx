import type { PagoParaAcciones } from '@/types/pago'

export type AccionAnularPagoProps = {
  pago: PagoParaAcciones
}

/**
 * "Anular pago" en el pie del detalle del pago (HU-42), si `pago.acciones.anular`. La compone
 * `app/` (`renderAcciones` de `PagoDetalle`, de `features/pagos`). La completa T-105.
 */
export function AccionAnularPago(props: AccionAnularPagoProps) {
  void props
  return null
}
