import { Banknote } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

export type CajaDiariaProps = {
  /** Abre el detalle de un cobro o una anulación; lo conecta `app/` con `useDetallePagoEnUrl().abrir`. */
  onAbrirPago: (pagoId: number) => void
  /**
   * URL del listado de liquidaciones en el segmento: un pago a profesor abre
   * `${rutaLiquidaciones}/${profesorId}/${mes}`.
   */
  rutaLiquidaciones: string
}

/**
 * "Caja diaria" (HU-46), en `/gerente/caja`: la fecha va en la URL (`?fecha=`). La completa T-134.
 */
export function CajaDiaria(props: CajaDiariaProps) {
  void props
  return (
    <Card className="p-0">
      <EmptyState icon={Banknote} title="Próximamente" />
    </Card>
  )
}
