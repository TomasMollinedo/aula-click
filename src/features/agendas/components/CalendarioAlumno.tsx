'use client'

import { useMemo } from 'react'
import { AlertCircle, CalendarX2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { BarraFiltros } from '@/components/ui/barra-filtros'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useOcurrenciasDelAlumno } from '@/features/ocurrencias/hooks/use-ocurrencias-del-alumno'
import type { FiltrosAgenda } from '@/types/agenda'

import { esRangoActual, moverRango } from '../agenda-propia'
import { tituloDeSemana } from '../calendario'
import { armarSemanaDelAlumno, filtrarTurnosDelAlumno } from '../calendario-alumno'
import { hayFiltrosActivos } from '../filtros-agenda'
import { useFechaInicialAlumno } from '../hooks/use-fecha-inicial-alumno'
import { useFiltrosAgenda } from '../hooks/use-filtros-agenda'
import { useSemanaEnUrl } from '../hooks/use-semana-en-url'
import { BloqueTurnoAlumno } from './BloqueTurnoAlumno'
import { FiltroCancelados, FiltroPrioridad } from './FiltrosCanceladosPrioridad'
import { GrillaSemanal } from './GrillaSemanal'
import { NavegacionFecha } from './NavegacionFecha'

type CalendarioAlumnoProps = {
  alumnoId: number
  /** Los filtros de la URL (`useFiltrosAgenda`): valen igual que en las agendas. */
  filtros: FiltrosAgenda
}

/**
 * El calendario semanal de la pestaña "Turnos" de la ficha del alumno: navegación por semana
 * (anterior, siguiente, "Hoy" o una fecha), los filtros de cancelados y prioridad de las agendas y la
 * grilla con sus turnos. Pide los turnos de la semana a `GET /ocurrencias?alumnoId` (la misma lista de
 * la vista "Lista", acotada a la semana, que va en la URL con `useSemanaEnUrl`). Como la lista de
 * turnos del alumno trae todos los estados, los filtros se aplican acá sobre lo que llegó. Un clic en
 * un turno abre su detalle (`?detalle=&fecha=`), que monta la ficha.
 *
 * Sin `?fecha=`, abre en la semana de su próximo turno (`useFechaInicialAlumno`) y no en la de hoy:
 * es lo que el alumno tiene para mirar. "Hoy" vuelve a la semana actual.
 */
export function CalendarioAlumno(props: CalendarioAlumnoProps) {
  const inicial = useFechaInicialAlumno(props.alumnoId)

  // Hasta saber la semana de abertura no se pide ninguna: así no se ve la de hoy un instante.
  if (!inicial.listo) {
    return (
      <Card className="gap-0 overflow-hidden p-0">
        <GrillaCargando />
      </Card>
    )
  }
  return <CalendarioAlumnoSemanal {...props} fechaPorDefecto={inicial.fecha ?? undefined} />
}

function CalendarioAlumnoSemanal({
  alumnoId,
  filtros,
  fechaPorDefecto,
}: CalendarioAlumnoProps & { fechaPorDefecto?: string }) {
  const { fecha, rango, hoy, cambiar } = useSemanaEnUrl({ fechaPorDefecto })
  const { cambiar: cambiarFiltros } = useFiltrosAgenda()
  const query = useOcurrenciasDelAlumno({ alumnoId, ...rango }, { conservarAnteriores: true })
  const turnos = useMemo(
    () => filtrarTurnosDelAlumno(query.data ?? [], filtros),
    [query.data, filtros],
  )
  const semana = useMemo(() => armarSemanaDelAlumno(turnos, hoy), [turnos, hoy])
  // El filtro de profesor no existe en este calendario: no cuenta como filtro puesto.
  const hayFiltros = hayFiltrosActivos({ ...filtros, profesorId: null })
  const status = query.error?.status

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="border-border flex flex-col gap-4 border-b p-6 min-[1700px]:flex-row min-[1700px]:items-end">
        <NavegacionFecha
          fecha={fecha}
          esActual={esRangoActual('semana', fecha, hoy)}
          onAnterior={() => cambiar(moverRango('semana', fecha, -1))}
          onSiguiente={() => cambiar(moverRango('semana', fecha, 1))}
          onActual={() => cambiar(hoy)}
          onCambiarFecha={cambiar}
          textos={{
            etiqueta: tituloDeSemana(fecha),
            anterior: 'Semana anterior',
            siguiente: 'Semana siguiente',
            actual: 'Hoy',
          }}
        />
        <BarraFiltros
          hayFiltros={hayFiltros}
          onLimpiar={() => cambiarFiltros({ incluirCancelados: false, prioridad: null })}
          limpiarEnFila="lg"
          limpiarSoloIcono
          className="min-w-0 min-[1700px]:flex-1 sm:grid-cols-2 lg:grid-cols-[8rem_auto_auto] lg:gap-2"
        >
          <FiltroPrioridad />
          <FiltroCancelados />
        </BarraFiltros>
      </div>

      {query.isError ? (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
              {status === 403
                ? 'No tenés permiso para ver los turnos de este alumno'
                : (query.error?.message ?? 'Ocurrió un error inesperado')}
              {status !== 403 && (
                <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                  Reintentar
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      ) : query.isLoading ? (
        <GrillaCargando />
      ) : semana.totalTurnos === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title={hayFiltros ? 'Sin resultados con estos filtros' : 'Sin turnos esta semana'}
          description={
            hayFiltros
              ? 'Probá con otros filtros u otra semana.'
              : 'Este alumno no tiene turnos esta semana. Elegí otra para ver su agenda.'
          }
        />
      ) : (
        <GrillaSemanal
          grilla={semana}
          isFetching={query.isFetching}
          renderCelda={(turnosDeLaCelda, dia) =>
            turnosDeLaCelda.map((turno) => (
              <BloqueTurnoAlumno key={turno.turnoId} turno={turno} esPasado={dia.esPasado} />
            ))
          }
        />
      )}

      {!query.isError && semana.totalTurnos > 0 && (
        <div className="border-border text-muted-foreground border-t px-6 py-4 text-sm">
          {semana.totalTurnos === 1 ? '1 turno' : `${semana.totalTurnos} turnos`} esta semana. Hacé
          clic en un turno para ver su detalle.
        </div>
      )}
    </Card>
  )
}

// Un esqueleto con la forma de la grilla (horas a la izquierda y columnas de días), para que la
// pantalla no salte cuando llegan los datos.
function GrillaCargando() {
  return (
    <div role="status" aria-label="Cargando el calendario" className="flex gap-3 p-6">
      <Skeleton className="h-64 w-12 shrink-0" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  )
}
