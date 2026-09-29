'use client'

import { DetalleTurno } from '@/app/profesor/_componentes/detalle-turno'
import { AgendaPropiaPantalla } from '@/features/agendas/components/AgendaPropiaPantalla'

// Client Component: le pasa una función (el detalle del turno, de otra feature).
export default function AgendaPage() {
  return <AgendaPropiaPantalla renderDetalle={(detalle) => <DetalleTurno {...detalle} />} />
}
