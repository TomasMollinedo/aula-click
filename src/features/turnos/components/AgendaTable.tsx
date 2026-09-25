'use client'

import { CalendarX2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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

import type { AgendaItem } from '../turnos.types'

type AgendaTableProps = {
  data?: AgendaItem[]
  isLoading: boolean
  /** Hay datos en pantalla y se está pidiendo otra página, fecha o profesor. */
  isFetching: boolean
  /** true si hay un profesor elegido en el filtro, para el mensaje del estado vacío. */
  hayFiltroProfesor: boolean
}

export function AgendaTable({ data, isLoading, isFetching, hayFiltroProfesor }: AgendaTableProps) {
  return (
    <Table aria-busy={isFetching} className={cn(isFetching && !isLoading && 'opacity-60')}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">Horario</TableHead>
          <TableHead>Alumno</TableHead>
          <TableHead>Profesor</TableHead>
          <TableHead>Materia</TableHead>
          <TableHead className="w-28">Aula</TableHead>
          <TableHead className="w-32">Estado</TableHead>
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
            </TableRow>
          ))
        ) : data?.length ? (
          data.map((turno) => (
            <TableRow key={turno.id} className="hover:bg-transparent">
              <TableCell className="tabular-nums">
                {turno.horaInicio}–{turno.horaFin}
              </TableCell>
              <TableCell className="font-medium">
                {turno.alumno.apellido}, {turno.alumno.nombre}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {turno.profesor.apellido}, {turno.profesor.nombre}
              </TableCell>
              <TableCell className="text-muted-foreground">{turno.materia.nombre}</TableCell>
              <TableCell className="text-muted-foreground">{turno.aula.nombre}</TableCell>
              <TableCell>
                {/* ACTIVO se muestra como "Agendado": es el texto de la pantalla, no el valor del enum. */}
                <Badge variant="confirmado">Agendado</Badge>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6} className="p-0">
              <EmptyState
                icon={CalendarX2}
                title="No hay turnos para este día"
                description={
                  hayFiltroProfesor
                    ? 'Probá con otro profesor o cambiá de fecha.'
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
