import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'

import { BotonNuevoProfesor } from './BotonNuevoProfesor'
import { ProfesoresListado } from './ProfesoresListado'
import { TotalProfesores } from './TotalProfesores'

// Pantalla del listado: la página del listado y, de fondo, la del alta cuando se entra por URL (el
// modal lo pone el slot @modal). docs/arquitectura-frontend.md → Modales con URL propia.
export function ProfesoresPantalla({
  rutaBase,
}: {
  /** URL del listado de profesores en el segmento del rol (por ejemplo `/mesa/profesores`). */
  rutaBase: string
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Profesores"
        description={
          <>
            Nexo Académico · <TotalProfesores />
          </>
        }
        actions={<BotonNuevoProfesor rutaBase={rutaBase} />}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <ProfesoresListado rutaBase={rutaBase} />
      </Suspense>
    </div>
  )
}
