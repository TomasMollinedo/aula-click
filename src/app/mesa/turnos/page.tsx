'use client'

import { DetalleTurno } from '@/app/mesa/_componentes/detalle-turno'
import { hrefAltaConVuelta } from '@/features/alumnos/volver-a'
import { RegistrarTurnoPantalla } from '@/features/turnos/components/RegistrarTurnoPantalla'

// Client Component: le pasa una función (el detalle del turno, de otra feature).
export default function TurnosPage() {
  return (
    <RegistrarTurnoPantalla
      rutaBase="/mesa/turnos"
      hrefAltaAlumno={hrefAltaConVuelta('/mesa/alumnos', 'turnos')}
      renderDetalle={(detalle) => <DetalleTurno {...detalle} />}
    />
  )
}
