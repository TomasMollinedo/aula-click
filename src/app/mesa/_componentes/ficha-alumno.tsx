'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { AgendaDelAlumno } from '@/features/agendas/components/AgendaDelAlumno'
import { AlumnoDetalle } from '@/features/alumnos/components/AlumnoDetalle'
import { AccionCancelarVarios } from '@/features/cancelaciones/components/AccionCancelarVarios'
import { PagosDelAlumno } from '@/features/cuentas/components/PagosDelAlumno'
import { AccionPdfTurnosAlumno } from '@/features/documentos/components/AccionPdfTurnosAlumno'
import { ExamenesDelAlumno } from '@/features/examenes/components/ExamenesDelAlumno'
import { useDetalleEnUrl } from '@/features/ocurrencias/hooks/use-detalle-en-url'
import { TurnosDelAlumno } from '@/features/ocurrencias/components/TurnosDelAlumno'
import { RegistrarPagoDialog } from '@/features/pagos/components/RegistrarPagoDialog'

import { DetalleTurno } from './detalle-turno'

// La ficha del alumno para mesa de entradas: las cuatro pestañas (Datos, Turnos, Exámenes y Pagos).
// La usan el detalle (`/mesa/alumnos/[alumnoId]`) y `editar`, que lo monta de fondo del modal.
// Cada pestaña de otra feature se compone acá (docs/arquitectura-frontend.md → Quién importa a
// quién).
export function FichaAlumno({ alumnoId }: { alumnoId: string }) {
  // Suspense: el detalle lee el tab y el turno de la URL con useSearchParams.
  return (
    <Suspense>
      <FichaAlumnoConDetalle alumnoId={alumnoId} />
    </Suspense>
  )
}

function FichaAlumnoConDetalle({ alumnoId }: { alumnoId: string }) {
  // El detalle de un turno abierto desde "Turnos" o "Pagos" (`?detalle=&fecha=`): mismo patrón que las
  // agendas (docs/arquitectura-frontend.md → Acciones sobre una ocurrencia). En el calendario de
  // "Turnos" `?fecha=` es la semana que se ve: al cerrar el detalle se conserva.
  const { detalle, cerrar } = useDetalleEnUrl({ fechaEsDeLaPantalla: true })
  // Abierto desde "Pagos" (`?tab=pagos`), el detalle solo ofrece "Registrar pago".
  const enPagos = useSearchParams().get('tab') === 'pagos'

  return (
    <>
      <AlumnoDetalle
        alumnoId={alumnoId}
        rutaBase="/mesa/alumnos"
        renderTurnos={(alumno) => (
          // Calendario por defecto y la lista de turnos como segunda vista.
          <AgendaDelAlumno alumnoId={alumno.id}>
            <TurnosDelAlumno
              alumnoId={alumno.id}
              renderAccionesSeleccion={(seleccion) => <AccionCancelarVarios {...seleccion} />}
              renderPdf={({ alumnoId, desde, hasta, estado, seleccionadas }) => (
                <AccionPdfTurnosAlumno
                  alumnoId={alumnoId}
                  desde={desde}
                  hasta={hasta}
                  estado={estado}
                  seleccionadas={seleccionadas}
                />
              )}
            />
          </AgendaDelAlumno>
        )}
        renderExamenes={(alumno) => <ExamenesDelAlumno alumnoId={alumno.id} rol="MESA_ENTRADAS" />}
        renderPagos={(alumno) => (
          <PagosDelAlumno
            alumnoId={alumno.id}
            renderRegistrarPago={(pago) => <RegistrarPagoDialog {...pago} />}
          />
        )}
      />
      {detalle && <DetalleTurno {...detalle} onCerrar={cerrar} soloPago={enPagos} />}
    </>
  )
}
