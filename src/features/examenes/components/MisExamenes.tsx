import { FileText } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

export type MisExamenesProps = {
  materiaId: number
}

/** Los exámenes del alumno en una materia, en el portal (HU-35). La completa T-111. */
export function MisExamenes(props: MisExamenesProps) {
  void props
  return (
    <Card className="p-0">
      <EmptyState icon={FileText} title="Próximamente" />
    </Card>
  )
}
