import { Receipt } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

/** Los pagos realizados del alumno, en "Mis pagos" del portal (HU-37). La completa T-103. */
export function MisPagosRealizados() {
  return (
    <Card className="p-0">
      <EmptyState icon={Receipt} title="Próximamente" />
    </Card>
  )
}
