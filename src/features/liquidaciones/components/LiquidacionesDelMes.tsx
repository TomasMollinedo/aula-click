import { HandCoins } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

export type LiquidacionesDelMesProps = {
  /**
   * URL del listado en el segmento (`/gerente/liquidaciones`); el detalle de una liquidación es
   * `${rutaBase}/${profesorId}/${mes}`.
   */
  rutaBase: string
}

/**
 * Listado de liquidaciones del mes (HU-44), en `/gerente/liquidaciones`: el mes va en la URL
 * (`?mes=`). La completa T-131.
 */
export function LiquidacionesDelMes(props: LiquidacionesDelMesProps) {
  void props
  return (
    <Card className="p-0">
      <EmptyState icon={HandCoins} title="Próximamente" />
    </Card>
  )
}
