import { Wallet } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

/** Los turnos pendientes de pago del alumno, en "Mis pagos" del portal (HU-37). La completa T-103. */
export function MisPendientes() {
  return (
    <Card className="p-0">
      <EmptyState icon={Wallet} title="Próximamente" />
    </Card>
  )
}
