import { PageHeader } from '@/components/layout/page-header'
import { AvisoMesaDeEntrada } from '@/features/centro/components/AvisoMesaDeEntrada'
import { SacarTurno } from '@/features/turnos/components/SacarTurno'

export default function SacarTurnoPage() {
  return (
    <div className="space-y-6">
      {/* Cancelar o reprogramar lo hace la mesa de entrada: el aviso va donde se saca el turno. */}
      <AvisoMesaDeEntrada />
      <PageHeader title="Sacar turno" />
      <SacarTurno hrefMisPagos="/portal/pagos" hrefMiCalendario="/portal/calendario" />
    </div>
  )
}
