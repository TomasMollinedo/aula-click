import { PageHeader } from '@/components/layout/page-header'
import { MisPendientes } from '@/features/cuentas/components/MisPendientes'
import { MisPagosRealizados } from '@/features/pagos/components/MisPagosRealizados'

// La completa T-103.
export default function MisPagosPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Mis pagos" />
      <MisPendientes />
      <MisPagosRealizados />
    </div>
  )
}
