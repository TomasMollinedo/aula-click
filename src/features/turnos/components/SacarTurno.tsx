import { CalendarPlus } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

/** "Sacar turno" desde el portal del alumno (HU-29). La completa T-94. */
export function SacarTurno() {
  return (
    <Card className="p-0">
      <EmptyState icon={CalendarPlus} title="Próximamente" />
    </Card>
  )
}
