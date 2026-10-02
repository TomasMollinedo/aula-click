import { Suspense, type ReactNode } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'

import { RegistrarTurno } from './RegistrarTurno'

type RegistrarTurnoPantallaProps = {
  /** URL de esta pantalla en el segmento del rol (por ejemplo `/mesa/turnos`). */
  rutaBase: string
  /** URL del alta de alumno con vuelta a esta pantalla (`/mesa/alumnos/nuevo?volverA=turnos`). */
  hrefAltaAlumno: string
  /** Compone `app/` el detalle de un turno (`?detalle=&fecha=`), que abre la confirmación del alta. */
  renderDetalle: RenderDetalleOcurrencia
  /** Compone `app/` el "Generar PDF" de cada tramo creado, en la confirmación del alta (T-69). */
  renderPdf?: (tramo: { turnoId: number; fecha: string }) => ReactNode
}

// Encabezado + la pantalla, que lee la URL (`?alumnoId=`, `?detalle=`, `?fecha=`) con useSearchParams: por
// eso va dentro de un límite de Suspense (docs/arquitectura-frontend.md → Datos).
export function RegistrarTurnoPantalla({
  rutaBase,
  hrefAltaAlumno,
  renderDetalle,
  renderPdf,
}: RegistrarTurnoPantallaProps) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Registrar turno"
        description="Buscá al alumno, elegí un horario con lugar y confirmá el turno."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <RegistrarTurno
          rutaBase={rutaBase}
          hrefAltaAlumno={hrefAltaAlumno}
          renderDetalle={renderDetalle}
          renderPdf={renderPdf}
        />
      </Suspense>
    </div>
  )
}
