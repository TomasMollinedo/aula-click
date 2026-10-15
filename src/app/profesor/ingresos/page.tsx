import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { MisIngresos } from '@/features/liquidaciones/components/MisIngresos'

// "Mis ingresos" del profesor (HU-45). Suspense: lee la liquidación abierta y las páginas con
// useSearchParams.
export default function IngresosPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Mis ingresos" />
      <Suspense>
        <MisIngresos hrefAsistencia="/profesor/asistencia" />
      </Suspense>
    </div>
  )
}
