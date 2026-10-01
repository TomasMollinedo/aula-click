'use client'

import type { ReactNode } from 'react'
import { Ban, History, NotebookPen, type LucideIcon } from 'lucide-react'

import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { PrioridadIndicador } from '@/components/turno/prioridad-indicador'
import { Card } from '@/components/ui/card'
import { Dato, Datos } from '@/components/ui/datos'
import { DetalleModal } from '@/components/ui/detalle-modal'
import type { OcurrenciaDetalle as OcurrenciaDetalleDatos } from '@/types/ocurrencia'
import { formatoInstante, nombreUsuarioAuditoria } from '@/utils/auditoria'
import { fechaConDia, fechaCorta } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'

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
}

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
 * Detalle de un turno en una fecha (T-43/T-44, HU-13 a HU-20): datos del turno (con el período de
 * la serie si es recurrente), prioridad, cancelación y las acciones del pie. Sin pago: T-43 no
 * tiene de dónde traerlo todavía (no hay sección de pago, ver docs/contrato-api.md → Ocurrencias).
 */
export function OcurrenciaDetalle({
  turnoId,
  fecha,
  onCerrar,
  renderAcciones,
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
