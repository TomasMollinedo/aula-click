import { PageHeader } from '@/components/layout/page-header'
import { SacarTurno } from '@/features/turnos/components/SacarTurno'

export default function SacarTurnoPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Sacar turno" />
      <SacarTurno hrefMisPagos="/portal/pagos" hrefMiCalendario="/portal/calendario" />
    </div>
  )
}
