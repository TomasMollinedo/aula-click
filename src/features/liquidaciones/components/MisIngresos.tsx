import { Wallet } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

export type MisIngresosProps = {
  /** URL de "Asistencia" del profesor, el acceso de "Clases cobradas sin asistencia". */
  hrefAsistencia: string
}

/**
 * "Mis ingresos" del profesor (HU-45), en `/profesor/ingresos`: este mes, clases sin cobrar, clases
 * cobradas sin asistencia y sus liquidaciones. La completa T-133.
 */
export function MisIngresos(props: MisIngresosProps) {
  void props
  return (
    <Card className="p-0">
      <EmptyState icon={Wallet} title="Próximamente" />
    </Card>
  )
}
