'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, Pencil } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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

import type { ProfesorListadoItem } from '../profesores.types'

type ProfesoresTableProps = {
  /** URL del listado de profesores en el segmento del rol (por ejemplo `/mesa/profesores`). */
  rutaBase: string
  /** URL que abre la edición de un profesor como modal encima del listado. */
  hrefEditar: (id: number) => string
  /** Se llama al abrir la edición con el lápiz en esta pestaña (no con Cmd/Ctrl+clic). */
  onEditar: () => void
  data?: ProfesorListadoItem[]
  isLoading: boolean
  /** Hay datos en pantalla y se está pidiendo otra página o búsqueda. */
  isFetching: boolean
  /** Lo que se muestra debajo del encabezado si no hay filas. */
  vacio: ReactNode
}

/** Acciones de cada fila (ver detalle, editar): ícono sin relleno; el color lo pone cada una. */
const accionDeFila =
  'focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2'

export function ProfesoresTable({
  rutaBase,
  hrefEditar,
  onEditar,
  data,
  isLoading,
  isFetching,
  vacio,
}: ProfesoresTableProps) {
  const router = useRouter()

  return (
    <Table aria-busy={isFetching} className={cn(isFetching && !isLoading && 'opacity-60')}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-2/5">Apellido</TableHead>
          <TableHead>Nombre</TableHead>
          <TableHead className="w-36">DNI</TableHead>
          <TableHead className="w-32">Estado</TableHead>
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
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell />
            </TableRow>
          ))
        ) : data?.length ? (
          data.map((profesor) => {
            const href = `${rutaBase}/${profesor.id}`
            return (
              // La fila entera abre el detalle con el mouse. Los links del ojo y del lápiz son el
              // acceso de teclado y los que permiten abrir en otra pestaña.
              <TableRow
                key={profesor.id}
                className="cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a')) return
                  router.push(href)
                }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {profesor.fotoUrl && <AvatarImage src={profesor.fotoUrl} alt="" />}
                      <AvatarFallback className="bg-cobalto/10 text-cobalto text-xs font-semibold">
                        {getInitials(profesor.nombre, profesor.apellido)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold">{profesor.apellido}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{profesor.nombre}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{profesor.dni}</TableCell>
                <TableCell>
                  <Badge variant={profesor.estado === 'ACTIVO' ? 'confirmado' : 'secondary'}>
                    {profesor.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={href}
                      aria-label={`Ver detalle de ${profesor.nombre} ${profesor.apellido}`}
                      title="Ver detalle"
                      className={cn(accionDeFila, 'text-cobalto hover:bg-cobalto/10')}
                    >
                      <Eye className="size-5" />
                    </Link>
                    <Link
                      href={hrefEditar(profesor.id)}
                      scroll={false}
                      onClick={(e) => {
                        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) onEditar()
                      }}
                      aria-label={`Editar a ${profesor.nombre} ${profesor.apellido}`}
                      title="Editar"
                      className={cn(accionDeFila, 'text-urgente hover:bg-dorado/15')}
                    >
                      <Pencil className="size-5" />
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
