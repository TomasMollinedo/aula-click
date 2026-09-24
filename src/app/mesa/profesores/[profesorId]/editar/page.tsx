'use client'

import { Suspense, use } from 'react'

import { ProfesorDetalle } from '@/features/profesores/components/ProfesorDetalle'

// Edición entrando por URL: el detalle de fondo; el modal lo pone [profesorId]/@modal/editar.
export default function EditarProfesorPage({
  params,
}: PageProps<'/mesa/profesores/[profesorId]/editar'>) {
  const { profesorId } = use(params)
  // Suspense: el detalle lee el tab de la URL con useSearchParams.
  return (
    <Suspense>
      <ProfesorDetalle profesorId={profesorId} rutaBase="/mesa/profesores" />
    </Suspense>
  )
}
