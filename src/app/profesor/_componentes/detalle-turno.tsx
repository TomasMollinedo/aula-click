'use client'

import { RegistrarAsistenciaTurno } from '@/features/asistencias/components/RegistrarAsistenciaTurno'
import { OcurrenciaDetalle } from '@/features/ocurrencias/components/OcurrenciaDetalle'
import type { SolicitudDetalleOcurrencia } from '@/types/ocurrencia'

// El detalle de un turno para el profesor (`?detalle=<turnoId>&fecha=<fechaOriginal>`): sin
// acciones en el pie (el profesor no cancela, finaliza, reprograma ni cobra). El profesor del turno
// registra o corrige la asistencia desde la sección "Asistencia" (`RegistrarAsistenciaTurno`, de otra
// feature), que se muestra solo si la API lo permite (`acciones.registrarAsistencia`).
export function DetalleTurno({ turnoId, fecha, onCerrar }: SolicitudDetalleOcurrencia) {
  return (
    <OcurrenciaDetalle
      turnoId={turnoId}
      fecha={fecha}
      onCerrar={onCerrar}
      renderAcciones={() => null}
      renderRegistrarAsistencia={(ocurrencia) => (
        <RegistrarAsistenciaTurno
          ocurrencia={ocurrencia}
          horasSeguidas={ocurrencia.horasSeguidas}
        />
      )}
    />
  )
}
