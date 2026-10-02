'use client'

import { Suspense } from 'react'

import { DetalleTurno } from '@/app/mesa/_componentes/detalle-turno'
import { PageHeader } from '@/components/layout/page-header'
import { PagosGlobal } from '@/features/cuentas/components/PagosGlobal'
import { RegistrarPagoDialog } from '@/features/pagos/components/RegistrarPagoDialog'

// Vista global de turnos adeudados y próximos (HU-16). Client Component: le pasa funciones (el
// diálogo de registrar el pago de varios turnos y el detalle del turno, desde donde se cobra uno
// solo; los dos de otras features). Suspense: PagosGlobal lee los filtros y el detalle de la URL
// con useSearchParams.
export default function PagosPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Pagos" description="Turnos adeudados y próximos turnos de los alumnos" />
      <Suspense>
        <PagosGlobal
          renderRegistrarPago={(pago) => <RegistrarPagoDialog {...pago} />}
          renderDetalle={(detalle) => <DetalleTurno {...detalle} />}
        />
      </Suspense>
    </div>
  )
}
