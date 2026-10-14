import { PageHeader } from '@/components/layout/page-header'
import { MisMaterias } from '@/features/historiales/components/MisMaterias'

// La completa T-111.
export default function MisMateriasPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Mis materias" />
      <MisMaterias rutaBase="/portal/materias" />
    </div>
  )
}
