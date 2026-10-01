'use client'

import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { PagosGlobal } from '@/features/cuentas/components/PagosGlobal'
import { RegistrarPagoDialog } from '@/features/pagos/components/RegistrarPagoDialog'

// Vista global de turnos adeudados y próximos (HU-16). Client Component: le pasa una función (el diálogo de
// registrar un pago, de otra feature). Suspense: PagosGlobal lee los filtros de la URL con
// useSearchParams.
export default function PagosPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Pagos" description="Turnos adeudados y próximos turnos de los alumnos" />
      <Suspense>
        <PagosGlobal renderRegistrarPago={(pago) => <RegistrarPagoDialog {...pago} />} />
      </Suspense>
    </div>
  )
}
