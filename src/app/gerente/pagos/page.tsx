'use client'

import { Suspense } from 'react'

import { DetallePago } from '@/app/gerente/_componentes/detalle-pago'
import { PageHeader } from '@/components/layout/page-header'
import { PagosRealizados } from '@/features/pagos/components/PagosRealizados'
import { useDetallePagoEnUrl } from '@/features/pagos/hooks/use-detalle-pago-en-url'

// Pagos realizados del centro, de solo lectura (HU-36). Client Component: arma el detalle del pago
// (de la misma feature, con su composición de `app/`) desde la URL. Suspense: lee `?pago=` y los
// filtros con useSearchParams.
export default function PagosPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Pagos" description="Pagos realizados en el centro" />
      <Suspense>
        <PagosRealizadosGerente />
      </Suspense>
    </div>
  )
}

function PagosRealizadosGerente() {
  const { pagoId, abrir, cerrar } = useDetallePagoEnUrl()

  return (
    <>
      <PagosRealizados soloLectura onAbrirPago={abrir} />
      {pagoId !== null && <DetallePago pagoId={pagoId} onCerrar={cerrar} />}
    </>
  )
}
