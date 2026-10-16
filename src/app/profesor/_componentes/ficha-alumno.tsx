'use client'

import { Suspense } from 'react'

import { AlumnoDetalle } from '@/features/alumnos/components/AlumnoDetalle'
import { ExamenesDelAlumno } from '@/features/examenes/components/ExamenesDelAlumno'
import { HistorialAcademico } from '@/features/historiales/components/HistorialAcademico'

import { DetalleTurno } from './detalle-turno'

// La ficha del alumno para el profesor: Datos, Historial académico y Exámenes, sin "Editar". Los turnos y los pagos del
// alumno son de mesa de entradas.
export function FichaAlumno({ alumnoId }: { alumnoId: string }) {
  // Suspense: el detalle lee el tab de la URL con useSearchParams.
  return (
    <Suspense>
      <AlumnoDetalle
        alumnoId={alumnoId}
        rutaBase="/profesor/alumnos"
        puedeEditar={false}
        renderHistorial={(alumno) => (
          <HistorialAcademico
            alumnoId={alumno.id}
            renderDetalle={(detalle) => <DetalleTurno {...detalle} />}
          />
        )}
        renderExamenes={(alumno) => <ExamenesDelAlumno alumnoId={alumno.id} rol="PROFESOR" />}
      />
    </Suspense>
  )
}
