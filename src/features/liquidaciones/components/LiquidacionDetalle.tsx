import { HandCoins } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

export type LiquidacionDetalleProps =
  | {
      vista: 'gerente'
      /** El profesor, tal como viene en la URL (como en `ProfesorDetalle`). */
      profesorId: string
      /** El mes de la liquidación, `YYYY-MM`. */
      mes: string
      /** URL del listado de liquidaciones en el segmento ("Volver a liquidaciones" → `${rutaBase}?mes=${mes}`). */
      rutaBase: string
    }
  | {
      /** Dentro de "Mis ingresos": los endpoints `mis-liquidaciones/{mes}` toman el profesor de la sesión. */
      vista: 'profesor'
      /** El mes de la liquidación, `YYYY-MM`. */
      mes: string
    }

/**
 * Detalle de la liquidación de un profesor en un mes (HU-44): en
 * `/gerente/liquidaciones/[profesorId]/[mes]` y, con `vista="profesor"`, dentro de "Mis ingresos"
 * (HU-45). La completa T-131.
 */
export function LiquidacionDetalle(props: LiquidacionDetalleProps) {
  void props
  return (
    <Card className="p-0">
      <EmptyState icon={HandCoins} title="Próximamente" />
    </Card>
  )
}
