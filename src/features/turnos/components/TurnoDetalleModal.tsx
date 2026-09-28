'use client'

import { Badge } from '@/components/ui/badge'
import { Dato, Datos } from '@/components/ui/datos'
import { DetalleModal } from '@/components/ui/detalle-modal'
import { nombreDiaSemana } from '@/utils/dias-semana'

import { textoHorario, textoRangoTurno } from '../formato-turnos'
import { useTurno } from '../hooks/use-turno'
import { ESTADO_TURNO_LABEL, TIPO_TURNO_LABEL } from '../turnos.types'

type TurnoDetalleModalProps = {
  turnoId: number
  onCerrar: () => void
}

/**
 * Detalle de un turno como modal de solo lectura (decisión T-34: entidad sencilla, sin página
 * propia), con la trazabilidad. Es un tramo: una hora y un rango de fechas (no hay fechas
 * exceptuadas). Lo abre quien lo muestra con `?detalle=<id>` en su URL: la pantalla de registrar
 * turno y, a futuro, la agenda (T-24).
 */
export function TurnoDetalleModal({ turnoId, onCerrar }: TurnoDetalleModalProps) {
  const { data: turno, isLoading, error, refetch } = useTurno(turnoId)
  const activo = turno?.estado === 'ACTIVO'

  return (
    <DetalleModal
      titulo="Detalle del turno"
      descripcion={
        turno && (
          <span className="flex flex-wrap items-center gap-2">
            {TIPO_TURNO_LABEL[turno.tipo]}
            <Badge variant={activo ? 'confirmado' : 'cancelado'}>
              {ESTADO_TURNO_LABEL[turno.estado]}
            </Badge>
          </span>
        )
      }
      onCerrar={onCerrar}
      cargando={isLoading}
      error={error}
      onReintentar={() => refetch()}
      textoNoEncontrado="Turno no encontrado"
      auditoria={turno}
    >
      {turno && (
        <Datos>
          <Dato label="Tipo" valor={TIPO_TURNO_LABEL[turno.tipo]} />
          <Dato label="Estado" valor={ESTADO_TURNO_LABEL[turno.estado]} />
          <Dato label="Fechas" valor={textoRangoTurno(turno)} />
          <Dato
            label="Día y hora"
            valor={`${nombreDiaSemana(turno.diaSemana)} ${textoHorario(turno.horaInicio, turno.horaFin)}`}
          />
          <Dato label="Aula" valor={turno.aula.nombre} />
          <Dato
            label="Alumno"
            valor={`${turno.alumno.apellido}, ${turno.alumno.nombre} (DNI ${turno.alumno.dni})`}
          />
          <Dato label="Profesor" valor={`${turno.profesor.apellido}, ${turno.profesor.nombre}`} />
          <Dato label="Materia" valor={turno.materia.nombre} />
          <Dato
            label="Motivo de consulta"
            valor={
              turno.motivoConsulta ?? <span className="text-muted-foreground">Sin motivo</span>
            }
            className="sm:col-span-2"
          />
        </Datos>
      )}
    </DetalleModal>
  )
}
