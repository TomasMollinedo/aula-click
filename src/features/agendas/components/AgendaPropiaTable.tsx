'use client'

import { Fragment } from 'react'
import { CalendarX2 } from 'lucide-react'

import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/utils/cn'

import type { DiaDeAgenda, VistaAgenda } from '../agenda-propia'
import { fechaConDia } from '@/utils/formato-fechas'
import { cantidadDeColumnas, FilaOcurrencia } from './FilaOcurrencia'

/** Título y descripción del estado vacío, por vista. */
export type TextosVacioAgenda = Record<VistaAgenda, { title: string; description: string }>

// Los de "Mi agenda" (HU-10): el profesor ve su propia agenda.
const TEXTOS_VACIO_PROPIA: TextosVacioAgenda = {
  dia: { title: 'No tenés turnos este día', description: 'Elegí otro día para ver tu agenda.' },
  semana: {
    title: 'No tenés turnos esta semana',
    description: 'Elegí otra semana para ver tu agenda.',
  },
}

type AgendaPropiaTableProps = {
  dias?: DiaDeAgenda[]
  isLoading: boolean
  /** Hay datos en pantalla y se está pidiendo otro día, semana o filtro. */
  isFetching: boolean
  /** Cambia el encabezado por día y los textos del estado vacío. */
  vista: VistaAgenda
  /** Textos del estado vacío; por defecto, los de "Mi agenda". */
  textosVacio?: TextosVacioAgenda
  /** Agrega la columna del estado de pago: la ve mesa de entradas, no el profesor. */
  mostrarPago?: boolean
  /** Hay un filtro de estado o prioridad: el vacío lo dice en vez de sugerir otro día. */
  hayFiltros?: boolean
}

/**
 * Ocurrencias de los turnos de un profesor, sin columna de profesor ("Mi agenda", HU-10, y la ficha
 * del profesor, HU-02), con su estado, su prioridad y, para mesa de entradas, su estado de pago. Un
 * clic en la fila abre el detalle del turno. En la vista por semana, cada día lleva su encabezado;
 * los días sin turnos no aparecen.
 */
export function AgendaPropiaTable({
  dias,
  isLoading,
  isFetching,
  vista,
  textosVacio = TEXTOS_VACIO_PROPIA,
  mostrarPago = false,
  hayFiltros = false,
}: AgendaPropiaTableProps) {
  const hayTurnos = dias?.some((dia) => dia.turnos.length > 0)
  const columnas = { profesor: false, pago: mostrarPago }
  const cantidadColumnas = cantidadDeColumnas(columnas)

  return (
    <Table aria-busy={isFetching} className={cn(isFetching && !isLoading && 'opacity-60')}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-40">Horario</TableHead>
          <TableHead>Alumno</TableHead>
          <TableHead>Materia</TableHead>
          <TableHead className="w-28">Aula</TableHead>
          <TableHead className="w-36">Estado</TableHead>
          {mostrarPago && <TableHead className="w-32">Pago</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              {mostrarPago && (
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
              )}
            </TableRow>
          ))
        ) : hayTurnos ? (
          dias?.map((dia) => (
            <Fragment key={dia.fecha}>
              {vista === 'semana' && (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={cantidadColumnas}
                    className="bg-canvas text-muted-foreground py-2 text-xs font-semibold tracking-wide capitalize"
                  >
                    {fechaConDia(dia.fecha)}
                  </TableCell>
                </TableRow>
              )}
              {dia.turnos.map((turno) => (
                // Un recurrente repite su `turnoId` en cada fecha: la clave es el par.
                <FilaOcurrencia
                  key={`${turno.turnoId}-${turno.fecha}`}
                  turno={turno}
                  columnas={columnas}
                />
              ))}
            </Fragment>
          ))
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={cantidadColumnas} className="p-0">
              <EmptyState
                icon={CalendarX2}
                title={hayFiltros ? 'No hay turnos con esos filtros' : textosVacio[vista].title}
                description={
                  hayFiltros
                    ? `Probá con otros filtros o con ${vista === 'dia' ? 'otro día' : 'otra semana'}.`
                    : textosVacio[vista].description
                }
                className="py-20"
              />
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
