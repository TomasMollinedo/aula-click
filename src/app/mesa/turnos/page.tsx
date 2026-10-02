'use client'

import { DetalleTurno } from '@/app/mesa/_componentes/detalle-turno'
import { hrefAltaConVuelta } from '@/features/alumnos/volver-a'
import { BotonPdfTurno } from '@/features/documentos/components/AccionPdfTurno'
import { RegistrarTurnoPantalla } from '@/features/turnos/components/RegistrarTurnoPantalla'

// Client Component: le pasa funciones (el detalle del turno y el PDF, de otras features).
export default function TurnosPage() {
  return (
    <RegistrarTurnoPantalla
      rutaBase="/mesa/turnos"
      hrefAltaAlumno={hrefAltaConVuelta('/mesa/alumnos', 'turnos')}
      renderDetalle={(detalle) => <DetalleTurno {...detalle} />}
      renderPdf={(tramo) => <BotonPdfTurno {...tramo} />}
    />
  )
}
