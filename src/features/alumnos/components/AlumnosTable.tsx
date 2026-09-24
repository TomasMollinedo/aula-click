'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, Pencil } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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

import type { AlumnoListadoItem } from '../alumnos.types'

type AlumnosTableProps = {
  /** URL del listado de alumnos en el segmento del rol (por ejemplo `/mesa/alumnos`). */
  rutaBase: string
  data?: AlumnoListadoItem[]
  isLoading: boolean
  /** Hay datos en pantalla y se está pidiendo otra página o búsqueda. */
  isFetching: boolean
  /** Lo que se muestra debajo del encabezado si no hay filas. */
  vacio: ReactNode
}

export function AlumnosTable({ rutaBase, data, isLoading, isFetching, vacio }: AlumnosTableProps) {
  const router = useRouter()

  return (
    <Table aria-busy={isFetching} className={cn(isFetching && !isLoading && 'opacity-60')}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-2/5">Apellido</TableHead>
          <TableHead>Nombre</TableHead>
          <TableHead className="w-32 text-right">Acciones</TableHead>
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
              <TableCell />
            </TableRow>
          ))
        ) : data?.length ? (
          data.map((alumno) => {
            const href = `${rutaBase}/${alumno.id}`
            return (
              // La fila entera abre el detalle con el mouse. Los links del ojo y del lápiz son el acceso de teclado
              // y los que permiten abrir en otra pestaña. No se "estira" el link sobre la fila con
              // after:absolute: un <tr> no es containing block en todos los navegadores y el ::after
              // de la última fila terminaba cubriendo toda la tabla.
              <TableRow
                key={alumno.id}
                className="cursor-pointer"
                onClick={(e) => {
                  // El clic sobre el link ya navega (y respeta Cmd/Ctrl+clic): no duplicarlo.
                  if ((e.target as HTMLElement).closest('a')) return
                  router.push(href)
                }}
              >
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
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={href}
                      aria-label={`Ver detalle de ${alumno.nombre} ${alumno.apellido}`}
                      title="Ver detalle"
                      className="text-cobalto hover:bg-cobalto/10 focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
                    >
                      <Eye className="size-5" />
                    </Link>
                    {/* Dorado, como el "Editar" del detalle: la acción de editar. */}
                    <Button variant="accent" size="icon" className="rounded-lg" asChild>
                      <Link
                        href={`${href}/editar`}
                        aria-label={`Editar a ${alumno.nombre} ${alumno.apellido}`}
                        title="Editar"
                      >
                        <Pencil />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={3} className="p-0">
              {vacio}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
