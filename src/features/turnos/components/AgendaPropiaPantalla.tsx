import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'

import { AgendaPropiaListado } from './AgendaPropiaListado'

// Pantalla "Mi agenda" del profesor (HU-10, T-26): un Client Component (AgendaPropiaListado) lee
// la vista y la fecha desde la URL con useSearchParams, así que va en <Suspense>
// (docs/arquitectura-frontend.md → Datos: Server y Client Components).
export function AgendaPropiaPantalla() {
  return (
    <div className="space-y-8">
      <PageHeader title="Mi agenda" description="Tus turnos por día o por semana" />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <AgendaPropiaListado />
      </Suspense>
    </div>
  )
}
