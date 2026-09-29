'use client'

import { Suspense } from 'react'

import { AlumnoDetalle } from '@/features/alumnos/components/AlumnoDetalle'
import { AccionCancelarVarios } from '@/features/cancelaciones/components/AccionCancelarVarios'
import { PagosDelAlumno } from '@/features/cuentas/components/PagosDelAlumno'
import { ExamenesDelAlumno } from '@/features/examenes/components/ExamenesDelAlumno'
import { TurnosDelAlumno } from '@/features/ocurrencias/components/TurnosDelAlumno'
import { RegistrarPagoDialog } from '@/features/pagos/components/RegistrarPagoDialog'

// La ficha del alumno para mesa de entradas: las cuatro pestañas (Datos, Turnos, Exámenes y Pagos).
// La usan el detalle (`/mesa/alumnos/[alumnoId]`) y `editar`, que lo monta de fondo del modal.
// Cada pestaña de otra feature se compone acá (docs/arquitectura-frontend.md → Quién importa a
// quién).
export function FichaAlumno({ alumnoId }: { alumnoId: string }) {
  // Suspense: el detalle lee el tab de la URL con useSearchParams.
  return (
    <Suspense>
      <AlumnoDetalle
        alumnoId={alumnoId}
        rutaBase="/mesa/alumnos"
        renderTurnos={(alumno) => (
          <TurnosDelAlumno
            alumnoId={alumno.id}
            renderAccionesSeleccion={(seleccion) => <AccionCancelarVarios {...seleccion} />}
          />
        )}
        renderExamenes={(alumno) => <ExamenesDelAlumno alumnoId={alumno.id} rol="MESA_ENTRADAS" />}
        renderPagos={(alumno) => (
          <PagosDelAlumno
            alumnoId={alumno.id}
            renderRegistrarPago={(pago) => <RegistrarPagoDialog {...pago} />}
          />
        )}
      />
    </Suspense>
  )
}
