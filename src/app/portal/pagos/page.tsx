import { Suspense } from 'react'
import { Info } from 'lucide-react'

import { MisPagosConVistas } from '@/app/portal/_componentes/mis-pagos-con-vistas'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'

// "Mis pagos" del portal del alumno (HU-37, T-103): lo pendiente (`cuentas`) y lo pagado (`pagos`),
// de sólo lectura, en subpestañas (`?vista=`). Cada feature pide lo suyo; esta página solo los
// compone. Suspense: la subpestaña se lee de la URL con useSearchParams.
export default function MisPagosPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <PageHeader title="Mis pagos" />
        <Alert>
          <Info className="size-4" />
          <AlertDescription className="text-foreground">
            Los pagos se realizan en la mesa de entrada, en efectivo, por transferencia o con
            tarjeta de débito.
          </AlertDescription>
        </Alert>
      </div>

      <Suspense>
        <MisPagosConVistas />
      </Suspense>
    </div>
  )
}
