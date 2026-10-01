'use client'

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

import type { AgendaItem } from '../agendas.types'
import { cantidadDeColumnas, type ColumnasAgenda, FilaOcurrencia } from './FilaOcurrencia'

// La agenda diaria es de mesa de entradas: muestra el profesor y el estado de pago.
const COLUMNAS: ColumnasAgenda = { profesor: true, pago: true }

type AgendaTableProps = {
  data?: AgendaItem[]
  isLoading: boolean
  /** Hay datos en pantalla y se está pidiendo otra página, fecha, profesor o filtro. */
  isFetching: boolean
  /** true si hay algún filtro (profesor, estado o prioridad), para el mensaje del estado vacío. */
  hayFiltros: boolean
}

export function AgendaTable({ data, isLoading, isFetching, hayFiltros }: AgendaTableProps) {
  return (
    <Table aria-busy={isFetching} className={cn(isFetching && !isLoading && 'opacity-60')}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-40">Horario</TableHead>
          <TableHead>Alumno</TableHead>
          <TableHead>Profesor</TableHead>
          <TableHead>Materia</TableHead>
          <TableHead className="w-28">Aula</TableHead>
          <TableHead className="w-36">Estado</TableHead>
          <TableHead className="w-32">Pago</TableHead>
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
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
            </TableRow>
          ))
        ) : data?.length ? (
          data.map((turno) => (
            // Un recurrente repite su `turnoId` en cada fecha: la clave es el par.
            <FilaOcurrencia
              key={`${turno.turnoId}-${turno.fecha}`}
              turno={turno}
              columnas={COLUMNAS}
            />
          ))
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={cantidadDeColumnas(COLUMNAS)} className="p-0">
              <EmptyState
                icon={CalendarX2}
                title={
                  hayFiltros ? 'No hay turnos con esos filtros' : 'No hay turnos para este día'
                }
                description={
                  hayFiltros
                    ? 'Probá con otros filtros o cambiá de fecha.'
                    : 'Elegí otro día para ver la agenda.'
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
