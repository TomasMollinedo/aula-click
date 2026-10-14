import { PageHeader } from '@/components/layout/page-header'
import { SacarTurno } from '@/features/turnos/components/SacarTurno'

// La completa T-94.
export default function SacarTurnoPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Sacar turno" />
      <SacarTurno />
    </div>
  )
}
