import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { TableroPantalla } from '@/features/tablero/components/TableroPantalla'

// Tablero del gerente (HU-21, solo lectura). Suspense: TableroPantalla lee el período de la URL con
// useSearchParams.
export default function TableroPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Tablero" description="Indicadores del centro por período" />
      <Suspense>
        <TableroPantalla />
      </Suspense>
    </div>
  )
}
