'use client'

import { use } from 'react'

import { FichaAlumno } from '@/app/profesor/_componentes/ficha-alumno'

// Mismo detalle que mesa de entradas (GET /alumnos/{id} ahora también admite PROFESOR), sin
// "Editar" (PATCH /alumnos/{id} sigue siendo solo de MESA_ENTRADAS) y solo con Datos y Exámenes.
export default function DetalleAlumnoDelProfesorPage({
  params,
}: PageProps<'/profesor/alumnos/[alumnoId]'>) {
  const { alumnoId } = use(params)
  return <FichaAlumno alumnoId={alumnoId} />
}
