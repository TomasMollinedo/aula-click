import { ClipboardCheck } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'

export type AsistenciaPantallaProps = {
  /** El detalle del turno, que compone `app/` (es de `features/ocurrencias`). */
  renderDetalle: RenderDetalleOcurrencia
}

/** Pantalla "Asistencia" del profesor (HU-22). La completa T-82. */
export function AsistenciaPantalla(props: AsistenciaPantallaProps) {
  void props
  return (
    <div className="space-y-8">
      <PageHeader
        title="Asistencia"
        description="Registrá la asistencia de los alumnos a sus turnos"
      />
      <Card className="p-0">
        <EmptyState icon={ClipboardCheck} title="Próximamente" />
      </Card>
    </div>
  )
}
