'use client'

import { use } from 'react'

import { FichaAlumno } from '@/app/mesa/_componentes/ficha-alumno'

// El detalle es una página (no un modal): "Editar" abre la edición como modal encima de ella. Las
// cuatro pestañas de la ficha las compone FichaAlumno.
export default function DetalleAlumnoPage({ params }: PageProps<'/mesa/alumnos/[alumnoId]'>) {
  const { alumnoId } = use(params)
  return <FichaAlumno alumnoId={alumnoId} />
}
