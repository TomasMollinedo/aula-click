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
  puedeEscribir = false,
}: {
  /** URL del listado de materias en el segmento del rol (por ejemplo `/mesa/materias`). */
  rutaBase: string
  /**
   * URL del listado de profesores en el segmento del rol, para enlazar a sus fichas. Sin ella (el
   * menú del gerente no tiene "Profesores") se listan sin enlace.
   */
  rutaProfesores?: string
  /**
   * Ofrece "+ Nueva materia", "Editar", "Dar de baja" y "Reactivar". Lo pasa la página según el
   * segmento: solo el del gerente (HU-12). Por defecto, solo lectura. Es ayuda visual: la
   * seguridad la da la API con su 403.
   */
  puedeEscribir?: boolean
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
        actions={puedeEscribir ? <BotonNuevaMateria rutaBase={rutaBase} /> : undefined}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <MateriasListado
          rutaBase={rutaBase}
          rutaProfesores={rutaProfesores}
          puedeEscribir={puedeEscribir}
        />
      </Suspense>
    </div>
  )
}
