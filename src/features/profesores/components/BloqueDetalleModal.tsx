'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { Pencil } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dato, Datos } from '@/components/ui/datos'
import { DetalleModal } from '@/components/ui/detalle-modal'
import { nombreDiaSemana } from '@/utils/dias-semana'
import { ApiError } from '@/utils/fetch-json'
import { rangoHoras } from '@/utils/horas'

import { etiquetaProximaFecha } from '../horario'
import { useBloque } from '../hooks/use-bloque'

type BloqueDetalleModalProps = {
  bloqueId: number
  /** Profesor de la ficha: una hora de otro profesor se muestra como no encontrada. */
  profesorId: number
  onCerrar: () => void
  /**
   * Link a la edición de esta hora, o `undefined` si la sección no la ofrece (profesor inactivo).
   * Además, una hora dada de baja no se edita.
   */
  hrefEditar?: string
  onEditar?: () => void
}

// Detalle de una hora del horario como modal (no tiene página propia): sus datos y la trazabilidad.
export function BloqueDetalleModal({
  bloqueId,
  profesorId,
  onCerrar,
  hrefEditar,
  onEditar,
}: BloqueDetalleModalProps) {
  const { data, isLoading, error, refetch } = useBloque(bloqueId)
  // La URL es de la ficha de un profesor: una hora de otro no es de esta ficha (mismo estado que un 404).
  const ajena = data !== undefined && data.profesor.id !== profesorId
  const bloque = ajena ? undefined : data
  const activo = bloque?.estado === 'ACTIVO'

  return (
    <DetalleModal
      titulo="Detalle de la hora"
      descripcion={
        bloque && (
          <span className="flex flex-wrap items-center gap-2">
            {nombreDiaSemana(bloque.diaSemana)} de {rangoHoras(bloque.horaInicio, bloque.horaFin)}
            <Badge variant={activo ? 'confirmado' : 'secondary'}>
              {activo ? 'Activa' : 'Dada de baja'}
            </Badge>
          </span>
        )
      }
      onCerrar={onCerrar}
      cargando={isLoading}
      error={ajena ? HORA_AJENA : error}
      onReintentar={() => refetch()}
      textoNoEncontrado="Hora no encontrada"
      auditoria={bloque}
      acciones={
        activo &&
        hrefEditar && (
          <Button size="lg" variant="accent" asChild>
            <Link href={hrefEditar} onClick={onEditar} scroll={false}>
              <Pencil />
              Editar
            </Link>
          </Button>
        )
      }
    >
      {bloque && (
        <Datos>
          <Dato label="Día" valor={nombreDiaSemana(bloque.diaSemana)} />
          <Dato label="Horario" valor={rangoHoras(bloque.horaInicio, bloque.horaFin)} />
          <Dato label="Aula" valor={`${bloque.aula.nombre} · capacidad ${bloque.aula.capacidad}`} />
          <Dato label="Profesor" valor={`${bloque.profesor.nombre} ${bloque.profesor.apellido}`} />
          <Dato label="Capacidad efectiva" valor={`${bloque.capacidadEfectiva} alumnos`} />
          {activo && (
            <Dato
              label="Ocupación"
              valor={
                <>
                  <span className="font-medium tabular-nums">
                    {bloque.ocupacion} / {bloque.capacidadEfectiva}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    · {etiquetaProximaFecha(bloque.proximaFecha, bloque.diaSemana, hoyLocal())}
                  </span>
                </>
              }
            />
          )}
        </Datos>
      )}
    </DetalleModal>
  )
}

const HORA_AJENA = new ApiError(404, 'NO_ENCONTRADO', 'Hora no encontrada')

// La fecha local solo decide si la próxima ocurrencia se muestra como "hoy".
function hoyLocal(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
