'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { AlertCircle, CalendarPlus, CalendarX2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useMisTurnos } from '@/features/ocurrencias/hooks/use-mis-turnos'
import type { RenderDetalleOcurrencia } from '@/types/ocurrencia'
import { cn } from '@/utils/cn'
import { fechaConDia } from '@/utils/formato-fechas'

import { esRangoActual, moverRango } from '../agenda-propia'
import { tituloDeSemana } from '../calendario'
import { armarSemanaDelAlumno } from '../calendario-alumno'
import { useEsCelular } from '../hooks/use-es-celular'
import { useFiltrosAgenda } from '../hooks/use-filtros-agenda'
import { useSemanaEnUrl } from '../hooks/use-semana-en-url'
import {
  agruparMisTurnosPorDia,
  filtrarMisTurnos,
  modoPorDefectoDeMiCalendario,
} from '../mi-calendario'
import type { ModoAgenda } from '../modo-agenda'
import { AgendaConModo } from './AgendaConModo'
import { BloqueMiTurno } from './BloqueMiTurno'
import { FiltroCancelados } from './FiltrosCanceladosPrioridad'
import { GrillaSemanal } from './GrillaSemanal'
import { NavegacionFecha } from './NavegacionFecha'

export type MiCalendarioProps = {
  renderDetalle: RenderDetalleOcurrencia
}

const HREF_SACAR_TURNO = '/portal/turnos/nuevo'

/**
 * "Mi calendario" del portal del alumno (HU-30): sus turnos de la semana (`GET /ocurrencias/mis-turnos`,
 * con las canceladas) como calendario o como lista. Las canceladas se ven con "Incluir cancelados",
 * como en las agendas (`?incluirCancelados=true`). Abre en la semana de hoy; en el celular, en la
 * lista. La semana y el modo van en la URL, y un turno abre su detalle (`?detalle=&fecha=`), que
 * compone `app/` con `renderDetalle`, como en las agendas.
 */
export function MiCalendario({ renderDetalle }: MiCalendarioProps) {
  const esCelular = useEsCelular()

  return (
    <AgendaConModo
      modoPorDefecto={modoPorDefectoDeMiCalendario(esCelular)}
      renderDetalle={renderDetalle}
      renderCalendario={() => <MiSemana modo="calendario" />}
    >
      <MiSemana modo="lista" />
    </AgendaConModo>
  )
}

// La semana en cualquiera de los dos modos: los dos piden lo mismo (y comparten la caché), solo
// cambia cómo se ven los turnos.
function MiSemana({ modo }: { modo: ModoAgenda }) {
  const { fecha, rango, hoy, cambiar } = useSemanaEnUrl()
  const query = useMisTurnos(rango)
  const { filtros } = useFiltrosAgenda()
  const turnos = useMemo(
    () => filtrarMisTurnos(query.data ?? [], filtros.incluirCancelados),
    [query.data, filtros.incluirCancelados],
  )
  const canceladosOcultos = (query.data?.length ?? 0) - turnos.length
  const semana = useMemo(() => armarSemanaDelAlumno(turnos, hoy), [turnos, hoy])
  const dias = useMemo(() => agruparMisTurnosPorDia(turnos, hoy), [turnos, hoy])

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="border-border flex flex-col gap-4 border-b p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
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
        <FiltroCancelados />
      </div>

      {query.isError ? (
        <div className="p-4 sm:p-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-destructive flex flex-wrap items-center justify-between gap-3">
              {query.error?.message ?? 'Ocurrió un error inesperado'}
              <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : query.isLoading ? (
        <Cargando />
      ) : turnos.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No tenés turnos esta semana"
          description={
            canceladosOcultos > 0
              ? canceladosOcultos === 1
                ? 'Tenés 1 turno cancelado: marcá "Incluir cancelados" para verlo.'
                : `Tenés ${canceladosOcultos} turnos cancelados: marcá "Incluir cancelados" para verlos.`
              : undefined
          }
        >
          <Button asChild>
            <Link href={HREF_SACAR_TURNO}>
              <CalendarPlus />
              Sacar turno
            </Link>
          </Button>
        </EmptyState>
      ) : modo === 'calendario' ? (
        <GrillaSemanal
          grilla={semana}
          isFetching={query.isFetching}
          renderCelda={(turnosDeLaCelda, dia) =>
            turnosDeLaCelda.map((turno) => (
              <BloqueMiTurno key={turno.turnoId} turno={turno} esPasado={dia.esPasado} />
            ))
          }
        />
      ) : (
        <ul
          aria-busy={query.isFetching}
          className={cn('divide-border divide-y', query.isFetching && 'opacity-60')}
        >
          {dias.map((dia) => (
            <li
              key={dia.fecha}
              aria-current={dia.esHoy ? 'date' : undefined}
              className={cn('space-y-2 p-4 sm:px-6', dia.esHoy && 'bg-primary/5')}
            >
              <h3
                className={cn(
                  'flex items-center gap-2 text-sm font-semibold capitalize',
                  dia.esHoy ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {fechaConDia(dia.fecha)}
                {dia.esHoy && (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs normal-case">
                    Hoy
                  </span>
                )}
              </h3>
              <ul className="space-y-2">
                {dia.turnos.map((turno) => (
                  <li key={turno.turnoId}>
                    <BloqueMiTurno turno={turno} esPasado={dia.esPasado} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Cargando() {
  return (
    <div role="status" aria-label="Cargando tus turnos" className="space-y-3 p-4 sm:p-6">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}
