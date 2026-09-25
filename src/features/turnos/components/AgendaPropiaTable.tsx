'use client'

import { Fragment } from 'react'
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

import type { DiaDeAgenda, VistaAgenda } from '../agenda-propia'
import { fechaConDia } from '../formato-turnos'

const COLUMNAS = 5

type AgendaPropiaTableProps = {
  dias?: DiaDeAgenda[]
  isLoading: boolean
  /** Hay datos en pantalla y se está pidiendo otro día o semana. */
  isFetching: boolean
  /** Cambia el encabezado por día y los textos del estado vacío. */
  vista: VistaAgenda
}

/**
 * Turnos propios del profesor, de sólo lectura (HU-10): no hay acciones por fila, porque la API no
 * soporta editar ni cancelar en este incremento. En la vista por semana, cada día lleva su
 * encabezado; los días sin turnos no aparecen.
 */
export function AgendaPropiaTable({ dias, isLoading, isFetching, vista }: AgendaPropiaTableProps) {
  const hayTurnos = dias?.some((dia) => dia.turnos.length > 0)

  return (
    <Table aria-busy={isFetching} className={cn(isFetching && !isLoading && 'opacity-60')}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-32">Horario</TableHead>
          <TableHead>Alumno</TableHead>
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
        ) : hayTurnos ? (
          dias?.map((dia) => (
            <Fragment key={dia.fecha}>
              {vista === 'semana' && (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={COLUMNAS}
                    className="bg-canvas text-muted-foreground py-2 text-xs font-semibold tracking-wide capitalize"
                  >
                    {fechaConDia(dia.fecha)}
                  </TableCell>
                </TableRow>
              )}
              {dia.turnos.map((turno) => (
                // Un recurrente repite su `turnoId` en cada fecha: la clave es el par.
                <TableRow key={`${turno.turnoId}-${turno.fecha}`} className="hover:bg-transparent">
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {turno.horaInicio}–{turno.horaFin}
                  </TableCell>
                  <TableCell className="font-medium">
                    {turno.alumno.apellido}, {turno.alumno.nombre}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{turno.materia.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{turno.aula.nombre}</TableCell>
                  <TableCell>
                    {/* ACTIVO se muestra como "Agendado": es el texto de la pantalla, no el valor del enum. */}
                    <Badge variant="confirmado">Agendado</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={COLUMNAS} className="p-0">
              <EmptyState
                icon={CalendarX2}
                title={vista === 'dia' ? 'No tenés turnos este día' : 'No tenés turnos esta semana'}
                description={
                  vista === 'dia'
                    ? 'Elegí otro día para ver tu agenda.'
                    : 'Elegí otra semana para ver tu agenda.'
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
