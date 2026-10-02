import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'

import { AgendaDiariaListado } from './AgendaDiariaListado'

type AgendaDiariaPantallaProps = Parameters<typeof AgendaDiariaListado>[0]

// Pantalla de la agenda diaria del centro (HU-09, T-24): un Client Component (AgendaDiariaListado)
// lee la fecha, el profesor y la página desde la URL con useSearchParams, así que va en <Suspense>
// (docs/arquitectura-frontend.md → Datos: Server y Client Components). El detalle del turno y el
// botón del PDF los compone `app/` (`renderDetalle`, `renderPdf`).
export function AgendaDiariaPantalla(props: AgendaDiariaPantallaProps) {
  return (
    <div className="relative space-y-8">
      <PageHeader title="Agenda diaria" description="Turnos agendados en todo el centro" />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <AgendaDiariaListado {...props} />
      </Suspense>
    </div>
  )
}
