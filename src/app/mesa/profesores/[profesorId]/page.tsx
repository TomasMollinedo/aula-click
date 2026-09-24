'use client'

import { Suspense, use } from 'react'

import { ProfesorDetalle } from '@/features/profesores/components/ProfesorDetalle'

// El detalle es una página (no un modal): "Editar" abre la edición como modal encima de ella.
export default function DetalleProfesorPage({
  params,
}: PageProps<'/mesa/profesores/[profesorId]'>) {
  const { profesorId } = use(params)
  // Suspense: el detalle lee el tab de la URL con useSearchParams.
  return (
    <Suspense>
      <ProfesorDetalle profesorId={profesorId} rutaBase="/mesa/profesores" />
    </Suspense>
  )
}
