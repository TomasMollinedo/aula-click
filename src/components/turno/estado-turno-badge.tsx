import { Badge } from '@/components/ui/badge'

import { ESTADO_TURNO, type EstadoTurno } from './indicadores-turno'

// Estado de un turno en una fecha ("Agendado", "Cancelado", "Sin registrar"), tal como lo manda la
// API. La etiqueta y el color salen de ESTADO_TURNO (indicadores-turno.ts), el único lugar con ese
// mapeo.
export function EstadoTurnoBadge({
  estado,
  className,
}: {
  estado: EstadoTurno
  className?: string
}) {
  const { etiqueta, variante } = ESTADO_TURNO[estado]
  return (
    <Badge variant={variante} className={className}>
      {etiqueta}
    </Badge>
  )
}
