'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { AgendaDelAlumno } from '@/features/agendas/components/AgendaDelAlumno'
import { AlumnoDetalle } from '@/features/alumnos/components/AlumnoDetalle'
import { AccionCancelarVarios } from '@/features/cancelaciones/components/AccionCancelarVarios'
import { PagosDelAlumno } from '@/features/cuentas/components/PagosDelAlumno'
import { AccionPdfTurnosAlumno } from '@/features/documentos/components/AccionPdfTurnosAlumno'
import { ExamenesDelAlumno } from '@/features/examenes/components/ExamenesDelAlumno'
import { HistorialAcademico } from '@/features/historiales/components/HistorialAcademico'
import { useDetalleEnUrl } from '@/features/ocurrencias/hooks/use-detalle-en-url'
import { TurnosDelAlumno } from '@/features/ocurrencias/components/TurnosDelAlumno'
import { PagosRealizados } from '@/features/pagos/components/PagosRealizados'
import { RegistrarPagoDialog } from '@/features/pagos/components/RegistrarPagoDialog'
import { useDetallePagoEnUrl } from '@/features/pagos/hooks/use-detalle-pago-en-url'

import { DetallePago } from './detalle-pago'
import { DetalleTurno } from './detalle-turno'
import { PagosConVistas } from './pagos-con-vistas'

// La ficha del alumno para mesa de entradas: las cinco pestañas (Datos, Turnos, Historial académico,
// Exámenes y Pagos, que a su vez tiene las subpestañas "Por cobrar" y "Pagos realizados").
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
  // El detalle de un pago abierto desde "Pagos realizados" (`?pago=<pagoId>`): se monta una sola vez,
  // para todas las pestañas.
  const { pagoId, abrir: abrirPago, cerrar: cerrarPago } = useDetallePagoEnUrl()
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
        renderHistorial={(alumno) => (
          <HistorialAcademico
            alumnoId={alumno.id}
            rol="MESA_ENTRADAS"
            renderDetalle={(detalle) => <DetalleTurno {...detalle} />}
          />
        )}
        renderExamenes={(alumno) => <ExamenesDelAlumno alumnoId={alumno.id} rol="MESA_ENTRADAS" />}
        renderPagos={(alumno) => (
          <PagosConVistas
            enFicha
            porCobrar={
              <PagosDelAlumno
                alumnoId={alumno.id}
                renderRegistrarPago={(pago) => <RegistrarPagoDialog {...pago} />}
              />
            }
            realizados={<PagosRealizados alumnoId={alumno.id} onAbrirPago={abrirPago} />}
          />
        )}
      />
      {detalle && <DetalleTurno {...detalle} onCerrar={cerrar} soloPago={enPagos} />}
      {pagoId !== null && <DetallePago pagoId={pagoId} onCerrar={cerrarPago} />}
    </>
  )
}
