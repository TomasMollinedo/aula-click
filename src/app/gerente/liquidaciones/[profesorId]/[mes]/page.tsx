'use client'

import { Suspense, use } from 'react'

import { LiquidacionDetalle } from '@/features/liquidaciones/components/LiquidacionDetalle'

// Detalle de la liquidación de un profesor en un mes (HU-44). Sin PageHeader: el título es el
// profesor, que llega con los datos. Los parámetros no se validan acá: los rechaza la API.
export default function DetalleLiquidacionPage({
  params,
}: PageProps<'/gerente/liquidaciones/[profesorId]/[mes]'>) {
  const { profesorId, mes } = use(params)
  // Suspense: el detalle lee la URL con useSearchParams.
  return (
    <Suspense>
      <LiquidacionDetalle
        vista="gerente"
        profesorId={profesorId}
        mes={mes}
        rutaBase="/gerente/liquidaciones"
      />
    </Suspense>
  )
}
