'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye } from 'lucide-react'

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
  /** URL del listado de "Mis alumnos" (`/profesor/alumnos`), para armar el link de cada fila. */
  rutaBase: string
  data?: AlumnoDeProfesorItem[]
  isLoading: boolean
  /** Hay datos en pantalla y se está pidiendo otra página o búsqueda. */
  isFetching: boolean
  /** Lo que se muestra debajo del encabezado si no hay filas. */
  vacio: ReactNode
}

/** Acciones de cada fila: ícono sin relleno, calcado de `AlumnosTable` (mesa). */
const accionDeFila =
  'focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2'

// Fila clickeable con el mismo detalle que mesa (GET /alumnos/{id} ahora también admite PROFESOR),
// pero sin lápiz de edición: PATCH /alumnos/{id} sigue siendo solo de MESA_ENTRADAS.
export function MisAlumnosTable({
  rutaBase,
  data,
  isLoading,
  isFetching,
  vacio,
}: MisAlumnosTableProps) {
  const router = useRouter()

  return (
    <Table aria-busy={isFetching} className={cn(isFetching && !isLoading && 'opacity-60')}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-2/5">Apellido</TableHead>
          <TableHead>Nombre</TableHead>
          <TableHead className="w-32">DNI</TableHead>
          <TableHead>Materias</TableHead>
          <TableHead className="w-16 text-right">Ver</TableHead>
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
              <TableCell />
            </TableRow>
          ))
        ) : data?.length ? (
          data.map((alumno) => {
            const href = `${rutaBase}/${alumno.id}`
            return (
              // La fila entera abre el detalle con el mouse; el ojo es el acceso de teclado y el
              // que permite abrir en otra pestaña. Mismo patrón que AlumnosTable (mesa).
              <TableRow
                key={alumno.id}
                className="cursor-pointer"
                onClick={(e) => {
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
                <TableCell>
                  <div className="flex items-center justify-end">
                    <Link
                      href={href}
                      aria-label={`Ver detalle de ${alumno.nombre} ${alumno.apellido}`}
                      title="Ver detalle"
                      className={cn(accionDeFila, 'text-cobalto hover:bg-cobalto/10')}
                    >
                      <Eye className="size-5" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            )
          })
        ) : (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={5} className="p-0">
              {vacio}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
