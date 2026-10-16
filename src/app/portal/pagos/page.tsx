import { Info } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MisPendientes } from '@/features/cuentas/components/MisPendientes'
import { MisPagosRealizados } from '@/features/pagos/components/MisPagosRealizados'

// "Mis pagos" del portal del alumno (HU-37, T-103): lo pendiente (`cuentas`) y lo pagado (`pagos`),
// de sólo lectura. Cada feature pide lo suyo; esta página solo los compone.
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

      <section aria-labelledby="mis-pagos-pendientes" className="space-y-4">
        <h2 id="mis-pagos-pendientes" className="text-xl font-semibold">
          Pendiente de pago
        </h2>
        <MisPendientes />
      </section>

      <section aria-labelledby="mis-pagos-realizados" className="space-y-4">
        <h2 id="mis-pagos-realizados" className="text-xl font-semibold">
          Pagos realizados
        </h2>
        <MisPagosRealizados />
      </section>
    </div>
  )
}
