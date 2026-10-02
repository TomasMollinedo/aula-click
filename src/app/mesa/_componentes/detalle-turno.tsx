'use client'

import { AccionCancelarTurno } from '@/features/cancelaciones/components/AccionCancelarTurno'
import { AccionPdfTurno } from '@/features/documentos/components/AccionPdfTurno'
import { AccionFinalizarTurno } from '@/features/finalizaciones/components/AccionFinalizarTurno'
import { OcurrenciaDetalle } from '@/features/ocurrencias/components/OcurrenciaDetalle'
import { AccionRegistrarPago } from '@/features/pagos/components/AccionRegistrarPago'
import { EnlaceComprobante } from '@/features/pagos/components/EnlaceComprobante'
import { AccionReprogramarTurno } from '@/features/turnos/components/AccionReprogramarTurno'
import type { SolicitudDetalleOcurrencia } from '@/types/ocurrencia'

type DetalleTurnoProps = SolicitudDetalleOcurrencia & {
  /**
   * El detalle abierto desde una vista de pagos (la vista global o la pestaña "Pagos" de la ficha
   * del alumno): en el pie solo va "Registrar pago". Reprogramar, cancelar y finalizar se hacen
   * desde las agendas y la pestaña "Turnos".
   */
  soloPago?: boolean
}

// El detalle de un turno para mesa de entradas (`?detalle=<turnoId>&fecha=<fechaOriginal>`), con las
// acciones que cada feature aporta. Se compone acá porque una feature no importa componentes de
// otra: cada pantalla que lo muestra (agendas, ficha del alumno, alta de turno, pagos) recibe
// `renderDetalle={(d) => <DetalleTurno {...d} />}`. Cada acción decide si se muestra con
// `ocurrencia.acciones`, que calcula la API (docs/arquitectura-frontend.md → Acciones sobre una
// ocurrencia). El enlace al comprobante de un turno pagado también es de otra feature (`pagos`).
export function DetalleTurno({ turnoId, fecha, onCerrar, soloPago = false }: DetalleTurnoProps) {
  return (
    <OcurrenciaDetalle
      turnoId={turnoId}
      fecha={fecha}
      onCerrar={onCerrar}
      renderComprobante={(pago) => (
        <EnlaceComprobante pagoId={pago.pagoId} numeroComprobante={pago.numeroComprobante} />
      )}
      renderAccionesEncabezado={(ocurrencia) => (
        <AccionPdfTurno turnoId={ocurrencia.turnoId} fecha={ocurrencia.fecha} />
      )}
      renderAcciones={(ocurrencia) => (
        <>
          {!soloPago && (
            <>
              <AccionReprogramarTurno ocurrencia={ocurrencia} />
              <AccionCancelarTurno ocurrencia={ocurrencia} />
              <AccionFinalizarTurno ocurrencia={ocurrencia} />
            </>
          )}
          <AccionRegistrarPago ocurrencia={ocurrencia} />
        </>
      )}
    />
  )
}
