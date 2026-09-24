import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { AlumnosListado } from '@/features/alumnos/components/AlumnosListado'
import { BotonNuevoAlumno } from '@/features/alumnos/components/BotonNuevoAlumno'
import { TotalAlumnos } from '@/features/alumnos/components/TotalAlumnos'

export default function AlumnosPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Alumnos"
        description={
          <>
            Nexo Académico · <TotalAlumnos />
          </>
        }
        actions={<BotonNuevoAlumno rutaBase="/mesa/alumnos" />}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <AlumnosListado rutaBase="/mesa/alumnos" />
      </Suspense>
    </div>
  )
}
