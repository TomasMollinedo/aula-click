import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'

import { BotonNuevaMateria } from './BotonNuevaMateria'
import { MateriasListado } from './MateriasListado'
import { TotalMaterias } from './TotalMaterias'

// Pantalla del listado: la página del listado y, de fondo, la del alta cuando se entra por URL (el
// modal lo pone el slot @modal). docs/arquitectura-frontend.md → Modales con URL propia.
export function MateriasPantalla({
  rutaBase,
  rutaProfesores,
}: {
  /** URL del listado de materias en el segmento del rol (por ejemplo `/mesa/materias`). */
  rutaBase: string
  /** URL del listado de profesores en el segmento del rol, para enlazar a sus fichas. */
  rutaProfesores: string
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Materias"
        description={
          <>
            Nexo Académico · <TotalMaterias />
          </>
        }
        actions={<BotonNuevaMateria rutaBase={rutaBase} />}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <MateriasListado rutaBase={rutaBase} rutaProfesores={rutaProfesores} />
      </Suspense>
    </div>
  )
}
