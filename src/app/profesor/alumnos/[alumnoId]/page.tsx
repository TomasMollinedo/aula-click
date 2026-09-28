'use client'

import { use } from 'react'

import { AlumnoDetalle } from '@/features/alumnos/components/AlumnoDetalle'

// Mismo detalle que mesa de entradas (GET /alumnos/{id} ahora también admite PROFESOR), sin
// "Editar": PATCH /alumnos/{id} sigue siendo solo de MESA_ENTRADAS.
export default function DetalleAlumnoDelProfesorPage({
  params,
}: PageProps<'/profesor/alumnos/[alumnoId]'>) {
  const { alumnoId } = use(params)
  return <AlumnoDetalle alumnoId={alumnoId} rutaBase="/profesor/alumnos" puedeEditar={false} />
}
