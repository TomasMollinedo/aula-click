'use client'

import { Suspense } from 'react'

import { AlumnoDetalle } from '@/features/alumnos/components/AlumnoDetalle'
import { ExamenesDelAlumno } from '@/features/examenes/components/ExamenesDelAlumno'

// La ficha del alumno para el profesor: Datos y Exámenes, sin "Editar". Los turnos y los pagos del
// alumno son de mesa de entradas.
export function FichaAlumno({ alumnoId }: { alumnoId: string }) {
  // Suspense: el detalle lee el tab de la URL con useSearchParams.
  return (
    <Suspense>
      <AlumnoDetalle
        alumnoId={alumnoId}
        rutaBase="/profesor/alumnos"
        puedeEditar={false}
        renderExamenes={(alumno) => <ExamenesDelAlumno alumnoId={alumno.id} rol="PROFESOR" />}
      />
    </Suspense>
  )
}
