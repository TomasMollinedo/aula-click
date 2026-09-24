'use client'

import { use } from 'react'

import { ProfesorDetalle } from '@/features/profesores/components/ProfesorDetalle'

// El detalle es una página (no un modal): "Editar" abre la edición como modal encima de ella.
export default function DetalleProfesorPage({
  params,
}: PageProps<'/mesa/profesores/[profesorId]'>) {
  const { profesorId } = use(params)
  return <ProfesorDetalle profesorId={profesorId} rutaBase="/mesa/profesores" />
}
