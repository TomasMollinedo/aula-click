'use client'

import { RegistrarAsistenciaTurno } from '@/features/asistencias/components/RegistrarAsistenciaTurno'
import { AccionPdfTurno } from '@/features/documentos/components/AccionPdfTurno'
import { OcurrenciaDetalle } from '@/features/ocurrencias/components/OcurrenciaDetalle'
import type { SolicitudDetalleOcurrencia } from '@/types/ocurrencia'

// El detalle de un turno para el profesor (`?detalle=<turnoId>&fecha=<fechaOriginal>`): sin
// acciones en el pie (el profesor no cancela, finaliza, reprograma ni cobra). El profesor del turno
// registra o corrige la asistencia desde la sección "Asistencia" (`RegistrarAsistenciaTurno`, de otra
// feature), que se muestra solo si la API lo permite (`acciones.registrarAsistencia`).
//
// "Generar PDF" en el encabezado, igual que en mesa de entradas: `GET /ocurrencias/{turnoId}/{fecha}/pdf`
// ya es de los dos roles, con las mismas reglas de acceso que el detalle (sólo los turnos de sus
// alumnos; si no, 403). **El documento no lleva datos de pago** para ningún rol, así que el profesor
// no ve si el turno está cobrado: en pantalla tampoco (la API le manda `pago: null`).
export function DetalleTurno({ turnoId, fecha, onCerrar }: SolicitudDetalleOcurrencia) {
  return (
    <OcurrenciaDetalle
      turnoId={turnoId}
      fecha={fecha}
      onCerrar={onCerrar}
      renderAccionesEncabezado={(ocurrencia) => (
        <AccionPdfTurno turnoId={ocurrencia.turnoId} fecha={ocurrencia.fecha} />
      )}
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
