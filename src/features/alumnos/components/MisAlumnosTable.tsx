'use client'

import type { ReactNode } from 'react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
import { getInitials } from '@/utils/initials'

import type { AlumnoDeProfesorItem } from '../alumnos.types'

type MisAlumnosTableProps = {
  data?: AlumnoDeProfesorItem[]
  isLoading: boolean
  /** Hay datos en pantalla y se está pidiendo otra página o búsqueda. */
  isFetching: boolean
  /** Lo que se muestra debajo del encabezado si no hay filas. */
  vacio: ReactNode
}

// Solo lectura: sin acciones ni fila clickeable. GET /alumnos/{id} sigue siendo de mesa de
// entradas, así que un profesor no tiene adónde navegar desde acá (docs/contrato-api.md → Roles).
export function MisAlumnosTable({ data, isLoading, isFetching, vacio }: MisAlumnosTableProps) {
  return (
    <Table aria-busy={isFetching} className={cn(isFetching && !isLoading && 'opacity-60')}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-2/5">Apellido</TableHead>
          <TableHead>Nombre</TableHead>
          <TableHead className="w-32">DNI</TableHead>
          <TableHead>Materias</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
            </TableRow>
          ))
        ) : data?.length ? (
          data.map((alumno) => (
            <TableRow key={alumno.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-cobalto/10 text-cobalto text-xs font-semibold">
                      {getInitials(alumno.nombre, alumno.apellido)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold">{alumno.apellido}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{alumno.nombre}</TableCell>
              <TableCell className="text-muted-foreground tabular-nums">{alumno.dni}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {alumno.materias.map((materia) => (
                    <Badge key={materia.id} variant="secondary">
                      {materia.nombre}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={4} className="p-0">
              {vacio}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
