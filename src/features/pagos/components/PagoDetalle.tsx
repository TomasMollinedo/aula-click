'use client'

import { useId, type ReactNode } from 'react'
import { Ban, CreditCard, History, ListChecks, NotebookPen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Dato, Datos } from '@/components/ui/datos'
import { DetalleModal } from '@/components/ui/detalle-modal'
import type { PagoParaAcciones } from '@/types/pago'
import { fechaConDia, fechaCorta } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'
import { formatearPesos } from '@/utils/moneda'

import {
  datosDelMedio,
  textoAnuladoEl,
  textoCantidad,
  textoMotivoAnulacion,
  textoRegistradoPor,
  textoTituloComprobante,
} from '../formato-pagos'
import { usePago } from '../hooks/use-pago'
import { pagoParaAcciones } from '../pago-detalle'
import type { DetallePago } from '../pago-detalle.types'
import { ComprobanteAdjuntoDelPago } from './ComprobanteAdjuntoDelPago'
import { EnlaceComprobante } from './EnlaceComprobante'

export type PagoDetalleProps = {
  pagoId: number
  onCerrar: () => void
  /**
   * Las acciones del pie. Las compone `app/` con componentes de otras features (`anulaciones`:
   * `AccionAnularPago`) y recibe el pago con lo que la API permite hacer (`pago.acciones`). Sin
   * esta prop el detalle es de solo lectura (el gerente).
   */
  renderAcciones?: (pago: PagoParaAcciones) => ReactNode
}

/** Una sección del detalle: tarjeta con título e ícono, como las del detalle del turno. */
function Seccion({
  icon: Icon,
  titulo,
  children,
}: {
  icon: LucideIcon
  titulo: string
  children: ReactNode
}) {
  return (
    <Card>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="text-cobalto size-4" />
        {titulo}
      </h3>
      {children}
    </Card>
  )
}

/** El aviso de un pago anulado (HU-42): motivo, detalle, quién y cuándo. */
function AvisoAnulado({ anulacion }: { anulacion: NonNullable<DetallePago['anulacion']> }) {
  return (
    <div
      role="note"
      className="border-cancelado/40 bg-cancelado/5 space-y-1 rounded-md border px-4 py-3"
    >
      <p className="text-cancelado flex items-center gap-2 text-sm font-semibold">
        <Ban className="size-4" />
        Anulado
      </p>
      <p className="text-sm">{textoMotivoAnulacion(anulacion)}</p>
      <p className="text-muted-foreground text-xs">{textoAnuladoEl(anulacion)}</p>
    </div>
  )
}

/**
 * Los turnos del pago con su importe y el total, tal como vienen de la API: nada se suma acá. Una
 * lista y no una tabla: el modal es angosto.
 */
function TurnosDelPago({ pago }: { pago: DetallePago }) {
  return (
    <Seccion icon={ListChecks} titulo={`Turnos (${textoCantidad(pago.cantidad)})`}>
      <ul className="divide-border divide-y">
        {pago.turnos.map((turno) => (
          <li
            key={`${turno.turnoId}|${turno.fecha}`}
            className="flex items-start justify-between gap-4 py-2 first:pt-0"
          >
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                {fechaConDia(turno.fecha)} · {rangoHoras(turno.horaInicio, turno.horaFin)}
              </p>
              <p className="text-muted-foreground">
                {turno.materia.nombre} · {turno.profesor.nombre} {turno.profesor.apellido}
              </p>
            </div>
            <p className="shrink-0 text-sm tabular-nums">{formatearPesos(turno.importe)}</p>
          </li>
        ))}
      </ul>
      <p className="border-border flex justify-between border-t pt-3 text-sm font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatearPesos(pago.total)}</span>
      </p>
    </Seccion>
  )
}

/**
 * El detalle de un pago como modal (`?pago=<pagoId>`, `useDetallePagoEnUrl`): lo abren "Pagos
 * realizados", la caja del gerente y el detalle de un turno pagado (HU-24, HU-36). Muestra el pago
 * tal como lo manda la API: número y estado (con el aviso "Anulado"), alumno, fecha, la forma de pago
 * con sus datos, los turnos con su importe y el total, las observaciones, el comprobante adjunto y
 * quién lo registró. "Ver comprobante" (el PDF del centro) va en el encabezado.
 *
 * Las acciones del pie las compone `app/` (`renderAcciones`, con el pago como `PagoParaAcciones`);
 * las del comprobante adjunto son de esta feature y van en su sección. Todas se muestran según
 * `acciones`, que decide la API: el gerente las recibe en `false`. La carga, el 404, el 403 y el
 * error con reintentar los resuelve `DetalleModal`.
 *
 * La trazabilidad es propia: un pago tiene quién lo registró y cuándo, pero no "Última
 * modificación" (`Trazabilidad` pide los cuatro campos de auditoría).
 */
export function PagoDetalle({ pagoId, onCerrar, renderAcciones }: PagoDetalleProps) {
  const { data: pago, isLoading, error, refetch } = usePago(pagoId)
  const idTrazabilidad = useId()

  return (
    <DetalleModal
      titulo={pago ? textoTituloComprobante(pago.numeroComprobante) : 'Comprobante de pago'}
      descripcion={
        pago && (
          <span className="flex flex-wrap items-center gap-2">
            {pago.alumno.nombre} {pago.alumno.apellido}
            {pago.estado === 'ANULADO' ? (
              <Badge variant="cancelado">Anulado</Badge>
            ) : (
              <Badge variant="confirmado">Vigente</Badge>
            )}
          </span>
        )
      }
      onCerrar={onCerrar}
      cargando={isLoading}
      error={error}
      onReintentar={() => refetch()}
      textoNoEncontrado="No se encontró el pago"
      accionesEncabezado={
        pago && <EnlaceComprobante pagoId={pago.id} numeroComprobante={pago.numeroComprobante} />
      }
      acciones={pago && renderAcciones?.(pagoParaAcciones(pago))}
    >
      {pago && (
        <div className="space-y-6">
          {pago.anulacion && <AvisoAnulado anulacion={pago.anulacion} />}

          <Datos>
            <Dato label="Alumno" valor={`${pago.alumno.nombre} ${pago.alumno.apellido}`} />
            <Dato label="DNI" valor={pago.alumno.dni} />
            <Dato label="Fecha de pago" valor={fechaCorta(pago.fechaPago)} />
            <Dato label="Total" valor={formatearPesos(pago.total)} />
          </Datos>

          <Seccion icon={CreditCard} titulo="Forma de pago">
            <Datos>
              <Dato label="Forma de pago" valor={pago.formaPago.nombre} />
              {datosDelMedio(pago).map(({ label, valor }) => (
                <Dato key={label} label={label} valor={valor} />
              ))}
            </Datos>
          </Seccion>

          <TurnosDelPago pago={pago} />

          {pago.observaciones && (
            <Seccion icon={NotebookPen} titulo="Observaciones">
              <p className="text-sm whitespace-pre-line">{pago.observaciones}</p>
            </Seccion>
          )}

          <ComprobanteAdjuntoDelPago
            pagoId={pago.id}
            adjunto={pago.adjunto}
            acciones={pago.acciones}
          />

          <section aria-labelledby={idTrazabilidad} className="border-border border-t pt-5">
            <h3 id={idTrazabilidad} className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <History className="text-cobalto size-4" />
              Trazabilidad
            </h3>
            <p className="text-muted-foreground text-xs">
              {textoRegistradoPor(pago.registradoPor, pago.registradoEl)}
            </p>
          </section>
        </div>
      )}
    </DetalleModal>
  )
}
