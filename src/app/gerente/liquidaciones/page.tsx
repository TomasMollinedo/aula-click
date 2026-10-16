import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { LiquidacionesDelMes } from '@/features/liquidaciones/components/LiquidacionesDelMes'

// Liquidaciones del mes (HU-44). Suspense: el listado lee `?mes=` y la página con useSearchParams.
export default function LiquidacionesPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Liquidaciones" description="Pagos a profesores por mes" />
      <Suspense>
        <LiquidacionesDelMes rutaBase="/gerente/liquidaciones" />
      </Suspense>
    </div>
  )
}
