'use client'

import { AlertCircle, CalendarX, Lock } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CalendarioFecha } from '@/components/ui/calendario-fecha'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'

import { mensajeErrorCarga } from '../errores-asistencias'
import { useAsistenciasDelDia } from '../hooks/use-asistencias-del-dia'
import { useFechaAsistencia } from '../hooks/use-fecha-asistencia'
import { clasesPorHora } from '../registro-asistencia'
import { AvisoPendientes } from './AvisoPendientes'
import { TarjetaClase } from './TarjetaClase'

/**
 * El día elegido (en la URL, por defecto hoy, sin fechas futuras), el aviso de pendientes y una
 * tarjeta por clase. Si el plazo del día venció (`editable: false`, de la API), todo en sólo
 * lectura.
 */
export function AsistenciaDelDia() {
  const { fecha, hoy, cambiar } = useFechaAsistencia()
  const { data, isLoading, isError, error, refetch } = useAsistenciasDelDia(fecha)

  return (
    <div className="space-y-6">
      <Field label="Día" htmlFor="asistencia-fecha" className="max-w-xs">
        <CalendarioFecha
          id="asistencia-fecha"
          value={fecha}
          max={hoy}
          onChange={(nueva) => nueva && cambiar(nueva)}
        />
      </Field>

      <AvisoPendientes fechaActual={fecha} onIrA={cambiar} />

      {isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
            {mensajeErrorCarga(error)}
            {error?.status !== 403 && error?.status !== 404 && (
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Reintentar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : isLoading || !data ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : data.clases.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon={CalendarX} title="No tenés turnos este día" />
        </Card>
      ) : (
        <div className="space-y-6">
          {!data.editable && (
            <Alert>
              <Lock />
              <AlertDescription>
                El plazo para registrar la asistencia de este día venció: se ve en sólo lectura.
              </AlertDescription>
            </Alert>
          )}
          {/* Cada clase lista a todos los alumnos de esa hora (los de varias horas seguidas
              aparecen en cada una). */}
          {clasesPorHora(data)
            .filter((clase) => clase.filas.length > 0)
            .map((clase) => (
              <TarjetaClase
                key={clase.bloqueAgendaId}
                clase={clase}
                plazo={data.plazo}
                editable={data.editable}
              />
            ))}
        </div>
      )}
    </div>
  )
}
