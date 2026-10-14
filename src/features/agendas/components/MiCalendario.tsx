import { CalendarDays } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'

export type MiCalendarioProps = {
  /** El detalle del turno del alumno, que compone `app/portal` (`DetalleTurnoPortal`, T-85). */
  renderDetalle: RenderDetalleOcurrencia
}

/** "Mi calendario" del portal del alumno (HU-30). La completa T-87. */
export function MiCalendario(props: MiCalendarioProps) {
  void props
  return (
    <Card className="p-0">
      <EmptyState icon={CalendarDays} title="Próximamente" />
    </Card>
  )
}
