'use client'

import { DetalleTurnoPortal } from '@/app/portal/_componentes/detalle-turno'
import { PageHeader } from '@/components/layout/page-header'
import { MiCalendario } from '@/features/agendas/components/MiCalendario'

// Client Component: le pasa una función (el detalle del turno, de otra feature). La completa T-87.
export default function MiCalendarioPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Mi calendario" />
      <MiCalendario renderDetalle={(detalle) => <DetalleTurnoPortal {...detalle} />} />
    </div>
  )
}
