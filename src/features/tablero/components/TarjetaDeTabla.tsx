'use client'

import type { ReactNode } from 'react'
import { ClipboardList } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationControls } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import type { PaginatedResponse } from '@/types'
import { cn } from '@/utils/cn'

import { textoMostrando } from '../formato-tablero'

// La tarjeta de una tabla paginada del tablero: el título, la tabla y el pie con el paginador, más
// los tres estados que no son la tabla (la primera carga, el vacío y una página pasada del final).
// La usan las tablas de "Asistencia" (HU-39) y la de "Finanzas" (HU-47).

export type TablaProps = {
  titulo: string
  /** Lo que explica qué mide la tabla, debajo del título. */
  descripcion: string
  /** El pie de la tabla y el vacío hablan de profesores o de materias. */
  nombres: { singular: string; plural: string }
  textoVacio: string
  /** Lo que va a la derecha del título (por ejemplo, el filtro de la tabla de profesores). */
  acciones?: ReactNode
  page: number
  onPageChange: (page: number) => void
  /** Mientras llega la página nueva se ve la anterior, atenuada. */
  enEspera: boolean
  /** Las filas que llegaron: con 0 y `total` mayor a 0, la página quedó pasada del final. */
  filas: number
  children: ReactNode
}

/** La tarjeta de una tabla: título, su contenido y el pie con el paginador. */
export function TarjetaDeTabla({
  titulo,
  descripcion,
  nombres,
  textoVacio,
  acciones,
  page,
  onPageChange,
  enEspera,
  filas,
  meta,
  children,
}: TablaProps & { meta: PaginatedResponse<unknown>['meta'] | null }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b p-6">
        <div className="min-w-0">
          <h3 className="text-sm leading-tight font-semibold">{titulo}</h3>
          <p className="text-muted-foreground mt-1 text-xs">{descripcion}</p>
        </div>
        {acciones}
      </div>

      {meta === null ? (
        <div className="space-y-2 p-6" aria-busy aria-label={`Cargando: ${titulo}`}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : meta.total === 0 ? (
        <EmptyState icon={ClipboardList} title={textoVacio} className="py-12" />
      ) : filas === 0 ? (
        // Página fuera de rango: `useCorregirPagina` ya está volviendo a la última que existe.
        <div className="p-6" aria-busy>
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          <div className={cn('transition-opacity', enEspera && 'pointer-events-none opacity-50')}>
            {children}
          </div>
          <div className="border-border flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">{textoMostrando(meta, nombres)}</p>
            <PaginationControls
              page={page}
              totalPages={meta.totalPages}
              onPageChange={onPageChange}
            />
          </div>
        </>
      )}
    </Card>
  )
}
