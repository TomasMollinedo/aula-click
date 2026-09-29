import { Badge } from '@/components/ui/badge'

import { ESTADO_PAGO, type EstadoPago } from './indicadores-turno'

// Estado de pago de un turno en una fecha ("Pendiente", "Pagado"), tal como lo manda la API. La
// etiqueta y el color salen de ESTADO_PAGO (indicadores-turno.ts).
export function EstadoPagoBadge({ estado, className }: { estado: EstadoPago; className?: string }) {
  const { etiqueta, variante } = ESTADO_PAGO[estado]
  return (
    <Badge variant={variante} className={className}>
      {etiqueta}
    </Badge>
  )
}
