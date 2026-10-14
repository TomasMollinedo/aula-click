'use client'

import { DetalleTurno } from '@/app/profesor/_componentes/detalle-turno'
import { AsistenciaPantalla } from '@/features/asistencias/components/AsistenciaPantalla'

// Asistencia a los turnos (HU-22). Client Component: le pasa una función (el detalle del turno, de
// otra feature).
export default function AsistenciaPage() {
  return <AsistenciaPantalla renderDetalle={(detalle) => <DetalleTurno {...detalle} />} />
}
