'use client'

import { EstadoPagoBadge } from '@/components/turno/estado-pago-badge'
import { EstadoTurnoBadge } from '@/components/turno/estado-turno-badge'
import { Dato, Datos } from '@/components/ui/datos'
import { DetalleModal } from '@/components/ui/detalle-modal'
import { fechaConDia } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'

import { mostrarSeccionAsistencia } from '../asistencia-detalle'
import { useDetalleEnUrl } from '../hooks/use-detalle-en-url'
import { useMiTurno } from '../hooks/use-mi-turno'
import { AsistenciaDelTurno } from './AsistenciaDelTurno'

export type OcurrenciaDetallePortalProps = {
  turnoId: number
  fecha: string
  onCerrar: () => void
}

/**
 * Detalle de un turno del alumno de la sesión en el portal (HU-30, T-85): datos del turno, temas a
 * trabajar, estado con su plazo, estado de pago y la asistencia de esa hora con sus horas seguidas
 * (las mismas piezas que el detalle del personal: `AsistenciaDelTurno`). De solo lectura: sin
 * acciones, prioridad, observaciones del turno ni auditoría, que la API no manda. Las otras horas del
 * grupo abren su propio detalle del portal. El pago no se muestra en una cancelada (nunca se cobró).
 * En el celular ocupa toda la pantalla (`pantallaCompletaEnCelular`).
 */
export function OcurrenciaDetallePortal({
  turnoId,
  fecha,
  onCerrar,
}: OcurrenciaDetallePortalProps) {
  const { data: turno, isLoading, error, refetch } = useMiTurno({ turnoId, fecha })
  const { hrefDetalle } = useDetalleEnUrl()

  return (
    <DetalleModal
      titulo="Detalle del turno"
      descripcion={
        turno && (
          <span className="flex flex-wrap items-center gap-2">
            {turno.materia.nombre}
            <EstadoTurnoBadge estado={turno.estado} plazo={turno.plazoAsistencia} />
          </span>
        )
      }
      onCerrar={onCerrar}
      cargando={isLoading}
      error={error}
      onReintentar={() => refetch()}
      textoNoEncontrado="Turno no encontrado"
      soloCruz
      pantallaCompletaEnCelular
    >
      {turno && (
        <div className="space-y-6">
          <Datos>
            <Dato label="Fecha" valor={fechaConDia(turno.fecha)} />
            <Dato label="Horario" valor={rangoHoras(turno.horaInicio, turno.horaFin)} />
            <Dato label="Materia" valor={turno.materia.nombre} />
            <Dato label="Profesor" valor={`${turno.profesor.nombre} ${turno.profesor.apellido}`} />
            <Dato label="Aula" valor={turno.aula.nombre} />
            <Dato
              label="Tipo"
              valor={turno.tipo === 'RECURRENTE' ? 'Recurrente' : 'Sesión única'}
            />
            {turno.estado !== 'CANCELADO' && (
              <Dato label="Pago" valor={<EstadoPagoBadge estado={turno.estadoPago} />} />
            )}
            <Dato label="Temas a trabajar" valor={turno.temas} className="sm:col-span-2" />
          </Datos>

          {mostrarSeccionAsistencia(turno) && (
            <AsistenciaDelTurno
              estado={turno.estado}
              plazo={turno.plazoAsistencia}
              asistencia={turno.asistencia}
              horasSeguidas={turno.horasSeguidas}
              hrefHora={hrefDetalle}
            />
          )}
        </div>
      )}
    </DetalleModal>
  )
}
