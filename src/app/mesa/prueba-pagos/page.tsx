'use client'

import { PageHeader } from '@/components/layout/page-header'
import { AccionRegistrarPago } from '@/features/pagos/components/AccionRegistrarPago'
import { RegistrarPagoDialog } from '@/features/pagos/components/RegistrarPagoDialog'
import { PruebaPagos } from '@/features/prueba-pagos/components/PruebaPagos'

// TEMPORAL (T-52): arnés de prueba del registro de pagos (`/mesa/prueba-pagos`, sin link en el
// Sidebar). Se borra junto con `src/features/prueba-pagos/` cuando T-44 y T-54 permitan probar el
// pago desde la app. Client Component: le pasa funciones (componentes de `features/pagos`).
export default function PruebaPagosPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Prueba de pagos" description="Temporal: registro de pagos y comprobante" />
      <PruebaPagos
        renderRegistrarPago={(solicitud) => <RegistrarPagoDialog {...solicitud} />}
        renderAccionRegistrarPago={(props) => <AccionRegistrarPago {...props} />}
      />
    </div>
  )
}
