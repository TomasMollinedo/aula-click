'use client'

import { Suspense } from 'react'

import { DetalleTurno } from '@/app/mesa/_componentes/detalle-turno'
import { PagosConVistas } from '@/app/mesa/_componentes/pagos-con-vistas'
import { PageHeader } from '@/components/layout/page-header'
import { PagosGlobal } from '@/features/cuentas/components/PagosGlobal'
import { PagosRealizados } from '@/features/pagos/components/PagosRealizados'
import { RegistrarPagoDialog } from '@/features/pagos/components/RegistrarPagoDialog'
import { useDetallePagoEnUrl } from '@/features/pagos/hooks/use-detalle-pago-en-url'

// Vista global de pagos: "Por cobrar" (turnos adeudados y próximos, HU-16) y "Pagos realizados"
// (HU-36), en subpestañas (`?vista=`). Client Component: le pasa funciones (el diálogo de registrar
// el pago de varios turnos y el detalle del turno, desde donde se cobra uno solo; los dos de otras
// features) y abre el detalle del pago, que muestra el layout de mesa. Suspense: lee los filtros, la
// subpestaña y los detalles de la URL con useSearchParams.
export default function PagosPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Pagos" description="Turnos por cobrar y pagos realizados de los alumnos" />
      <Suspense>
        <PagosDeMesa />
      </Suspense>
    </div>
  )
}

function PagosDeMesa() {
  const { abrir } = useDetallePagoEnUrl()

  return (
    <PagosConVistas
      porCobrar={
        <PagosGlobal
          renderRegistrarPago={(pago) => <RegistrarPagoDialog {...pago} />}
          renderDetalle={(detalle) => <DetalleTurno {...detalle} soloPago />}
        />
      }
      realizados={<PagosRealizados onAbrirPago={abrir} />}
    />
  )
}
