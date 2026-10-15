import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { PorcentajeCentro } from '@/features/reparto/components/PorcentajeCentro'

// Configuración del gerente: el porcentaje del centro (HU-43). El título va a la izquierda; la
// tarjeta, angosta y centrada, como en `portal/configuracion`. Suspense: lee la página del
// historial con useSearchParams.
export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" />
      <div className="mx-auto max-w-lg">
        <Suspense>
          <PorcentajeCentro />
        </Suspense>
      </div>
    </div>
  )
}
