'use client'

import { use } from 'react'

import { ProfesorDetalle } from '@/features/profesores/components/ProfesorDetalle'

// Edición entrando por URL: el detalle de fondo; el modal lo pone [profesorId]/@modal/editar.
export default function EditarProfesorPage({
  params,
}: PageProps<'/mesa/profesores/[profesorId]/editar'>) {
  const { profesorId } = use(params)
  return <ProfesorDetalle profesorId={profesorId} rutaBase="/mesa/profesores" />
}
