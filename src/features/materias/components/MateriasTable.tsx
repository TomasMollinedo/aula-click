'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, Pencil, Trash2, Undo2 } from 'lucide-react'

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
import { PrecioMateria } from './PrecioMateria'

type MateriasTableProps = {
  /** URL que abre el detalle de una materia como modal encima del listado. */
  hrefDetalle: (id: number) => string
  /** Se llama al abrir el detalle con el ojo en esta pestaña (no con Cmd/Ctrl+clic). */
  onVerDetalle: () => void
  /** Muestra los íconos de edición, baja y reactivación (solo el gerente; la seguridad es la API). */
  puedeEscribir: boolean
  /** URL que abre la edición de una materia como modal encima del listado (`?editar=<id>`). */
  hrefEditar: (id: number) => string
  /** Se llama al abrir la edición con el lápiz en esta pestaña (no con Cmd/Ctrl+clic). */
  onEditar: () => void
  /** Abre la confirmación de la baja. Solo se ofrece en las materias activas. */
  onDarDeBaja: (materia: MateriaListadoItem) => void
  /** Abre la confirmación de la reactivación. Solo se ofrece en las materias inactivas. */
  onReactivar: (materia: MateriaListadoItem) => void
  data?: MateriaListadoItem[]
  isLoading: boolean
  /** Hay datos en pantalla y se está pidiendo otra página o búsqueda. */
  isFetching: boolean
  /** Lo que se muestra debajo del encabezado si no hay filas. */
  vacio: ReactNode
}

/** Acciones de cada fila (ver, editar, baja, reactivar): ícono sin relleno; el color lo pone cada una. */
const accionDeFila =
  'focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2'

export function MateriasTable({
  hrefDetalle,
  onVerDetalle,
  puedeEscribir,
  hrefEditar,
  onEditar,
  onDarDeBaja,
  onReactivar,
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
          {/* La descripción no viene en el listado (`GET /materias` trae id, nombre, estado y
              precio): se ve en el detalle. */}
          <TableHead>Nombre</TableHead>
          <TableHead className="w-40 text-right">Precio por hora</TableHead>
          <TableHead className="w-32">Estado</TableHead>
          <TableHead className="w-32 text-right">Acciones</TableHead>
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
                <Skeleton className="ml-auto h-4 w-24" />
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
            const activa = materia.estado === 'ACTIVO'
            return (
              // La fila entera abre el detalle con el mouse. El link del ojo es el acceso de
              // teclado y el que permite abrirlo en otra pestaña; los botones de baja y
              // reactivación abren su confirmación y por eso también quedan excluidos del clic.
              <TableRow
                key={materia.id}
                className="cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a, button')) return
                  onVerDetalle()
                  router.push(href, { scroll: false })
                }}
              >
                <TableCell className="font-semibold">{materia.nombre}</TableCell>
                <TableCell className="text-right">
                  <PrecioMateria materia={materia} />
                </TableCell>
                <TableCell>
                  <Badge variant={activa ? 'confirmado' : 'secondary'}>
                    {activa ? 'Activa' : 'Inactiva'}
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
                    {puedeEscribir && (
                      <Link
                        href={hrefEditar(materia.id)}
                        scroll={false}
                        onClick={(e) => {
                          if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) onEditar()
                        }}
                        aria-label={`Editar ${materia.nombre}`}
                        title="Editar"
                        className={cn(accionDeFila, 'text-urgente hover:bg-dorado/15')}
                      >
                        <Pencil className="size-5" />
                      </Link>
                    )}
                    {puedeEscribir &&
                      (activa ? (
                        <button
                          type="button"
                          onClick={() => onDarDeBaja(materia)}
                          aria-label={`Dar de baja ${materia.nombre}`}
                          title="Dar de baja"
                          className={cn(accionDeFila, 'text-cancelado hover:bg-cancelado/10')}
                        >
                          <Trash2 className="size-5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onReactivar(materia)}
                          aria-label={`Reactivar ${materia.nombre}`}
                          title="Reactivar"
                          className={cn(accionDeFila, 'text-confirmado hover:bg-confirmado/10')}
                        >
                          <Undo2 className="size-5" />
                        </button>
                      ))}
                  </div>
                </TableCell>
              </TableRow>
            )
          })
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
