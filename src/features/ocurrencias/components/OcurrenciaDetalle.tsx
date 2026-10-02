'use client'

import type { ReactNode } from 'react'
import { Ban, Banknote, History, NotebookPen, type LucideIcon } from 'lucide-react'

import { EstadoPagoBadge } from '@/components/turno/estado-pago-badge'
import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { PrioridadIndicador } from '@/components/turno/prioridad-indicador'
import { Card } from '@/components/ui/card'
import { Dato, Datos } from '@/components/ui/datos'
import { DetalleModal } from '@/components/ui/detalle-modal'
import type {
  OcurrenciaDetalle as OcurrenciaDetalleDatos,
  PagoDeOcurrencia,
} from '@/types/ocurrencia'
import { formatoInstante, nombreUsuarioAuditoria } from '@/utils/auditoria'
import { fechaConDia, fechaCorta } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'
import { formatearPesos } from '@/utils/moneda'

import { useOcurrencia } from '../hooks/use-ocurrencia'
import { etiquetaMotivoCancelacion } from '../motivo-cancelacion'

export type OcurrenciaDetalleProps = {
  turnoId: number
  fecha: string
  onCerrar: () => void
  /**
   * Las acciones del pie. Las compone `app/` (`app/<segmento>/_componentes/detalle-turno.tsx`)
   * porque cada una es de otra feature, y cada una decide si se muestra con `ocurrencia.acciones`.
   */
  renderAcciones: (ocurrencia: OcurrenciaDetalleDatos) => ReactNode
  /**
   * Las acciones del encabezado, al lado de la cruz de cerrar ("Generar PDF"). También las compone
   * `app/`; sin esta prop, el encabezado solo lleva la cruz.
   */
  renderAccionesEncabezado?: (ocurrencia: OcurrenciaDetalleDatos) => ReactNode
  /**
   * El enlace al comprobante de un turno pagado. Lo compone `app/` (la URL del comprobante es de
   * `features/pagos` y solo de mesa de entradas); sin esta prop, la sección de pago no lo muestra.
   */
  renderComprobante?: (pago: PagoRegistrado) => ReactNode
}

/** El pago de una ocurrencia ya pagada. */
type PagoRegistrado = Extract<PagoDeOcurrencia, { estado: 'PAGADO' }>

function Seccion({
  icon: Icon,
  titulo,
  className,
  children,
}: {
  icon: LucideIcon
  titulo: string
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={className}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="text-cobalto size-4" />
        {titulo}
      </h3>
      {children}
    </Card>
  )
}

/**
 * El pago de la ocurrencia (HU-15), tal como lo manda la API: pendiente con lo que costaría cobrarla
 * hoy, o pagada con el importe cobrado, la forma de pago, la fecha, el número de comprobante y quién
 * lo registró. No calcula nada.
 */
function SeccionPago({
  pago,
  renderComprobante,
}: {
  pago: PagoDeOcurrencia
  renderComprobante?: (pago: PagoRegistrado) => ReactNode
}) {
  if (pago.estado === 'PENDIENTE') {
    return (
      <Seccion icon={Banknote} titulo="Pago">
        <Datos>
          <Dato label="Estado" valor={<EstadoPagoBadge estado={pago.estado} />} />
          <Dato
            label="Importe a cobrar"
            valor={
              pago.importeVigente === null ? 'Sin precio' : formatearPesos(pago.importeVigente)
            }
          />
        </Datos>
      </Seccion>
    )
  }

  return (
    <Seccion icon={Banknote} titulo="Pago">
      <Datos>
        <Dato label="Estado" valor={<EstadoPagoBadge estado={pago.estado} />} />
        <Dato label="Importe" valor={formatearPesos(pago.importe)} />
        <Dato label="Forma de pago" valor={pago.formaPago.nombre} />
        <Dato label="Fecha de pago" valor={fechaCorta(pago.fechaPago)} />
        <Dato label="Comprobante" valor={`N° ${pago.numeroComprobante}`} />
      </Datos>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <History className="size-3.5" />
          {nombreUsuarioAuditoria(pago.registradoPor)}, {formatoInstante(pago.registradoEl)}
        </p>
        {renderComprobante?.(pago)}
      </div>
    </Seccion>
  )
}

/**
 * Detalle de un turno en una fecha (T-43/T-44, HU-13 a HU-20): datos del turno (con el período de
 * la serie si es recurrente), prioridad, pago, cancelación y las acciones del pie. Se cierra solo
 * con la cruz del encabezado (no hay "Cerrar" en el pie). La sección de pago no se muestra en una
 * cancelada (nunca se cobró: la API manda "Pendiente" y confundiría) ni cuando la API no manda
 * `pago` (el profesor).
 */
export function OcurrenciaDetalle({
  turnoId,
  fecha,
  onCerrar,
  renderAcciones,
  renderAccionesEncabezado,
  renderComprobante,
}: OcurrenciaDetalleProps) {
  const { data: ocurrencia, isLoading, error, refetch } = useOcurrencia({ turnoId, fecha })

  return (
    <DetalleModal
      titulo="Detalle del turno"
      descripcion={
        ocurrencia && (
          <span className="flex flex-wrap items-center gap-2">
            {ocurrencia.materia.nombre}
            <EstadoTurnoBadge estado={ocurrencia.estado} />
          </span>
        )
      }
      onCerrar={onCerrar}
      cargando={isLoading}
      error={error}
      onReintentar={() => refetch()}
      textoNoEncontrado="Turno no encontrado"
      auditoria={ocurrencia}
      acciones={ocurrencia && renderAcciones(ocurrencia)}
      accionesEncabezado={ocurrencia && renderAccionesEncabezado?.(ocurrencia)}
      soloCruz
    >
      {ocurrencia && (
        <div className="space-y-6">
          <Datos>
            <Dato
              label="Alumno"
              valor={`${ocurrencia.alumno.nombre} ${ocurrencia.alumno.apellido}`}
            />
            <Dato
              label="Profesor"
              valor={`${ocurrencia.profesor.nombre} ${ocurrencia.profesor.apellido}`}
            />
            <Dato label="Materia" valor={ocurrencia.materia.nombre} />
            <Dato label="Aula" valor={ocurrencia.aula.nombre} />
            <Dato label="Fecha" valor={fechaConDia(ocurrencia.fecha)} />
            <Dato label="Horario" valor={rangoHoras(ocurrencia.horaInicio, ocurrencia.horaFin)} />
            <Dato
              label="Tipo"
              valor={ocurrencia.tipo === 'RECURRENTE' ? 'Recurrente' : 'Sesión única'}
            />
            {ocurrencia.tipo === 'RECURRENTE' && (
              <Dato
                label="Período"
                valor={`${fechaCorta(ocurrencia.serie.fechaInicio)} – ${
                  ocurrencia.serie.fechaFin ? fechaCorta(ocurrencia.serie.fechaFin) : 'sin fin'
                }`}
              />
            )}
          </Datos>

          {ocurrencia.tipo === 'RECURRENTE' && ocurrencia.serie.finalizacion && (
            <p className="text-muted-foreground text-sm">
              Finalizada el {fechaConDia(ocurrencia.serie.finalizacion.fechaDesde)} ·{' '}
              {etiquetaMotivoCancelacion(ocurrencia.serie.finalizacion.motivo)}
              {ocurrencia.serie.finalizacion.detalle &&
                `: ${ocurrencia.serie.finalizacion.detalle}`}{' '}
              · {nombreUsuarioAuditoria(ocurrencia.serie.finalizacion.createdBy)},{' '}
              {formatoInstante(ocurrencia.serie.finalizacion.createdAt)}
            </p>
          )}

          {ocurrencia.prioridad && (
            <PrioridadIndicador
              prioridad={ocurrencia.prioridad}
              examen={ocurrencia.examen ?? undefined}
              variante="detalle"
            />
          )}

          {(ocurrencia.observaciones || ocurrencia.temas) && (
            <Seccion icon={NotebookPen} titulo="Observaciones y temas">
              <Datos>
                <Dato label="Observaciones" valor={ocurrencia.observaciones} />
                <Dato label="Temas a trabajar" valor={ocurrencia.temas} />
              </Datos>
            </Seccion>
          )}

          {ocurrencia.pago && ocurrencia.estado !== 'CANCELADO' && (
            <SeccionPago pago={ocurrencia.pago} renderComprobante={renderComprobante} />
          )}

          {ocurrencia.cancelacion && (
            <Seccion icon={Ban} titulo="Cancelación">
              <p className="text-sm">{etiquetaMotivoCancelacion(ocurrencia.cancelacion.motivo)}</p>
              {ocurrencia.cancelacion.detalle && (
                <p className="text-muted-foreground mt-1 text-sm">
                  {ocurrencia.cancelacion.detalle}
                </p>
              )}
              <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
                <History className="size-3.5" />
                {nombreUsuarioAuditoria(ocurrencia.cancelacion.createdBy)},{' '}
                {formatoInstante(ocurrencia.cancelacion.createdAt)}
              </p>
            </Seccion>
          )}
        </div>
      )}
    </DetalleModal>
  )
}
