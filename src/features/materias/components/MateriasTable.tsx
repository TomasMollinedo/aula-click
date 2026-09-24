'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye } from 'lucide-react'

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

import type { MateriaListadoItem } from '../materias.types'

type MateriasTableProps = {
  /** URL que abre el detalle de una materia como modal encima del listado. */
  hrefDetalle: (id: number) => string
  /** Se llama al abrir el detalle con el ojo en esta pestaña (no con Cmd/Ctrl+clic). */
  onVerDetalle: () => void
  data?: MateriaListadoItem[]
  isLoading: boolean
  /** Hay datos en pantalla y se está pidiendo otra página o búsqueda. */
  isFetching: boolean
  /** Lo que se muestra debajo del encabezado si no hay filas. */
  vacio: ReactNode
}

/** Acción de cada fila (ver detalle): ícono sin relleno; el color lo pone cada una. */
const accionDeFila =
  'focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2'

export function MateriasTable({
  hrefDetalle,
  onVerDetalle,
  data,
  isLoading,
  isFetching,
  vacio,
}: MateriasTableProps) {
  const router = useRouter()

  return (
    <Table aria-busy={isFetching} className={cn(isFetching && !isLoading && 'opacity-60')}>
      <TableHeader>
        <TableRow>
          {/* La descripción no viene en el listado (`GET /materias` trae id, nombre y estado):
              se ve en el detalle. */}
          <TableHead>Nombre</TableHead>
          <TableHead className="w-32">Estado</TableHead>
          <TableHead className="w-24 text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-56" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell />
            </TableRow>
          ))
        ) : data?.length ? (
          data.map((materia) => {
            const href = hrefDetalle(materia.id)
            return (
              // La fila entera abre el detalle con el mouse. El link del ojo es el acceso de
              // teclado y el que permite abrirlo en otra pestaña.
              <TableRow
                key={materia.id}
                className="cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a')) return
                  onVerDetalle()
                  router.push(href, { scroll: false })
                }}
              >
                <TableCell className="font-semibold">{materia.nombre}</TableCell>
                <TableCell>
                  <Badge variant={materia.estado === 'ACTIVO' ? 'confirmado' : 'secondary'}>
                    {materia.estado === 'ACTIVO' ? 'Activa' : 'Inactiva'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={href}
                      scroll={false}
                      onClick={(e) => {
                        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey)
                          onVerDetalle()
                      }}
                      aria-label={`Ver detalle de ${materia.nombre}`}
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
            <TableCell colSpan={3} className="p-0">
              {vacio}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
