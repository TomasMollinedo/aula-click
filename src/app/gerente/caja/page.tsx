'use client'

import { Suspense } from 'react'

import { DetallePago } from '@/app/gerente/_componentes/detalle-pago'
import { PageHeader } from '@/components/layout/page-header'
import { CajaDiaria } from '@/features/caja/components/CajaDiaria'
import { useDetallePagoEnUrl } from '@/features/pagos/hooks/use-detalle-pago-en-url'

// Caja diaria (HU-46). Client Component: arma el detalle del pago (de la feature pagos, con su
// composición de `app/`) desde la URL. Suspense: lee `?pago=`, `?fecha=` y los filtros con
// useSearchParams.
export default function CajaPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Caja diaria" description="Movimientos de caja del día" />
      <Suspense>
        <CajaDiariaGerente />
      </Suspense>
    </div>
  )
}

function CajaDiariaGerente() {
  const { pagoId, abrir, cerrar } = useDetallePagoEnUrl()

  return (
    <>
      <CajaDiaria onAbrirPago={abrir} rutaLiquidaciones="/gerente/liquidaciones" />
      {pagoId !== null && <DetallePago pagoId={pagoId} onCerrar={cerrar} />}
    </>
  )
}
