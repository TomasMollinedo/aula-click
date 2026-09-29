'use client'

import { DetalleTurno } from '@/app/mesa/_componentes/detalle-turno'
import { AgendaDiariaPantalla } from '@/features/agendas/components/AgendaDiariaPantalla'
import { BotonPdfAgenda } from '@/features/documentos/components/BotonPdfAgenda'

// Client Component: le pasa funciones (el detalle del turno y el botón del PDF, de otras features).
export default function AgendaPage() {
  return (
    <AgendaDiariaPantalla
      renderDetalle={(detalle) => <DetalleTurno {...detalle} />}
      renderPdf={(pdf) => <BotonPdfAgenda {...pdf} />}
    />
  )
}
