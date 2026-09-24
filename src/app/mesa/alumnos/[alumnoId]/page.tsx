'use client'

import { use } from 'react'

import { AlumnoDetalle } from '@/features/alumnos/components/AlumnoDetalle'

// El detalle es una página (no un modal): "Editar" abre la edición como modal encima de ella.
export default function DetalleAlumnoPage({ params }: PageProps<'/mesa/alumnos/[alumnoId]'>) {
  const { alumnoId } = use(params)
  return <AlumnoDetalle alumnoId={alumnoId} rutaBase="/mesa/alumnos" />
}
