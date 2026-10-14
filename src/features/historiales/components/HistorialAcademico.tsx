import { GraduationCap } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'
import type { Role } from '@/types'

export type HistorialAcademicoProps = {
  alumnoId: number
  /** Rol de quien mira: mesa de entradas y profesor ven la pestaña con distinto alcance. */
  rol: Role
  /** El detalle del turno, que compone `app/` (es de `features/ocurrencias`). */
  renderDetalle: RenderDetalleOcurrencia
}

/** Pestaña "Historial académico" de la ficha del alumno (HU-31). La completa T-109. */
export function HistorialAcademico(props: HistorialAcademicoProps) {
  void props
  return (
    <Card className="p-0">
      <EmptyState icon={GraduationCap} title="Próximamente" />
    </Card>
  )
}
