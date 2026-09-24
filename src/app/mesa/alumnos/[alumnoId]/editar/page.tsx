'use client'

import { use } from 'react'

import { AlumnoDetalle } from '@/features/alumnos/components/AlumnoDetalle'

// Edición entrando por URL: el detalle de fondo; el modal lo pone [alumnoId]/@modal/editar.
export default function EditarAlumnoPage({ params }: PageProps<'/mesa/alumnos/[alumnoId]/editar'>) {
  const { alumnoId } = use(params)
  return <AlumnoDetalle alumnoId={alumnoId} rutaBase="/mesa/alumnos" />
}
