import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'

import { AlumnosListado } from './AlumnosListado'
import { BotonNuevoAlumno } from './BotonNuevoAlumno'
import { TotalAlumnos } from './TotalAlumnos'

// Pantalla del listado: la página del listado y, de fondo, la del alta cuando se entra por URL (el
// modal lo pone el slot @modal). docs/arquitectura-frontend.md → Modales con URL propia.
export function AlumnosPantalla({
  rutaBase,
}: {
  /** URL del listado de alumnos en el segmento del rol (por ejemplo `/mesa/alumnos`). */
  rutaBase: string
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Alumnos"
        description={
          <>
            Nexo Académico · <TotalAlumnos />
          </>
        }
        actions={<BotonNuevoAlumno rutaBase={rutaBase} />}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <AlumnosListado rutaBase={rutaBase} />
      </Suspense>
    </div>
  )
}
