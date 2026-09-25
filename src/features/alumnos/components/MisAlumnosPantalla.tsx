import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'

import { MisAlumnosListado } from './MisAlumnosListado'
import { TotalMisAlumnos } from './TotalMisAlumnos'

// Pantalla de "Mis alumnos" (HU-08, rol PROFESOR): solo lectura, sin alta (eso es de mesa de
// entradas). Alumnos con al menos un turno vigente (activo y no vencido) con el profesor de la
// sesión.
export function MisAlumnosPantalla() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Mis alumnos"
        description={
          <>
            Nexo Académico · <TotalMisAlumnos />
          </>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <MisAlumnosListado />
      </Suspense>
    </div>
  )
}
