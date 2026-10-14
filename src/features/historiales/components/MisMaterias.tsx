import { GraduationCap } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

export type MisMateriasProps = {
  /**
   * Ruta de las materias del portal (`/portal/materias`): cada materia enlaza a
   * `${rutaBase}/${materiaId}/${profesorId}`.
   */
  rutaBase: string
}

/** "Mis materias" del portal del alumno: su historial por materia (HU-33). La completa T-111. */
export function MisMaterias(props: MisMateriasProps) {
  void props
  return (
    <Card className="p-0">
      <EmptyState icon={GraduationCap} title="Próximamente" />
    </Card>
  )
}
