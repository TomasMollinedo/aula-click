import { Badge } from '@/components/ui/badge'

import { distintivoTurno, type EstadoTurno, type PlazoAsistencia } from './indicadores-turno'

// Estado de un turno en una fecha ("Agendado", "Cancelado", "Sin registrar", "Realizado",
// "Ausente"), tal como lo manda la API. La etiqueta, el color y el ícono salen de ESTADO_TURNO
// (indicadores-turno.ts), el único lugar con ese mapeo. El ícono es decorativo (`aria-hidden`): la
// palabra siempre está.
//
// - `plazo` (el `plazoAsistencia` de la API): con "Sin registrar" agrega cuándo vence el registro
//   o que lo cerró el sistema. El componente no calcula nada.
// - `sinAsistencia`: para los calendarios y las listas, que no muestran la asistencia (solo se ve
//   en el detalle del turno, la pantalla "Asistencia" y el historial). Deja "Agendado" y
//   "Cancelado" como siempre y no monta nada para un turno pasado no cancelado.
export function EstadoTurnoBadge({
  estado,
  plazo,
  sinAsistencia,
  className,
}: {
  estado: EstadoTurno
  plazo?: PlazoAsistencia | null
  sinAsistencia?: boolean
  className?: string
}) {
  const distintivo = distintivoTurno(estado, { plazo, sinAsistencia })
  if (!distintivo) return null
  const Icono = distintivo.icono
  return (
    <Badge variant={distintivo.variante} className={className}>
      <Icono aria-hidden className="size-3.5 shrink-0" />
      {distintivo.etiqueta}
    </Badge>
  )
}
