import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'

import { AsistenciaDelDia } from './AsistenciaDelDia'

export type AsistenciaPantallaProps = {
  /** El detalle del turno, que compone `app/` (es de `features/ocurrencias`). */
  renderDetalle: RenderDetalleOcurrencia
}

// Pantalla "Asistencia" del profesor (HU-22, T-82). `AsistenciaDelDia` lee el día de la URL con
// useSearchParams, así que va en <Suspense>. `renderDetalle` es la prop definitiva de T-79: el
// alcance de T-82 no abre el detalle del turno desde esta pantalla.
export function AsistenciaPantalla(props: AsistenciaPantallaProps) {
  void props
  return (
    <div className="space-y-8">
      <PageHeader
        title="Asistencia"
        description="Registrá la asistencia de los alumnos a sus turnos"
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <AsistenciaDelDia />
      </Suspense>
    </div>
  )
}
