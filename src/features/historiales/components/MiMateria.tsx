import type { ReactNode } from 'react'
import { BookOpen } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

export type MiMateriaProps = {
  materiaId: number
  profesorId: number
  /** Los exámenes del alumno en la materia, que compone `app/portal` (`MisExamenes`, HU-35). */
  renderExamenes: (solicitud: { materiaId: number }) => ReactNode
}

/** Una materia de "Mis materias": su historial con ese profesor (HU-33). La completa T-111. */
export function MiMateria(props: MiMateriaProps) {
  void props
  return (
    <Card className="p-0">
      <EmptyState icon={BookOpen} title="Próximamente" />
    </Card>
  )
}
