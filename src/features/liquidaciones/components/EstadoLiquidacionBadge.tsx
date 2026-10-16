import { Badge } from '@/components/ui/badge'

import { type EstadoAMostrar, formatoEstadoLiquidacion } from '../formato-liquidaciones'

/** El estado de una liquidación como badge ("Pendiente de pago", "Pagada el 05/10/2026"…). */
export function EstadoLiquidacionBadge({ liquidacion }: { liquidacion: EstadoAMostrar }) {
  const { texto, variante } = formatoEstadoLiquidacion(liquidacion)
  return <Badge variant={variante}>{texto}</Badge>
}
