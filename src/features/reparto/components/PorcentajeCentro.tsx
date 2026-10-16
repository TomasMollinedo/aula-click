import { Percent } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * Porcentaje del centro (HU-43), en `/gerente/configuracion`: el vigente, el cambio con
 * confirmación y el historial. La completa T-130.
 */
export function PorcentajeCentro() {
  return (
    <Card className="p-0">
      <EmptyState icon={Percent} title="Próximamente" />
    </Card>
  )
}
