'use client'

import { use } from 'react'

import { FichaAlumno } from '@/app/mesa/_componentes/ficha-alumno'

// Edición entrando por URL: el detalle de fondo; el modal lo pone [alumnoId]/@modal/editar.
export default function EditarAlumnoPage({ params }: PageProps<'/mesa/alumnos/[alumnoId]/editar'>) {
  const { alumnoId } = use(params)
  return <FichaAlumno alumnoId={alumnoId} />
}
