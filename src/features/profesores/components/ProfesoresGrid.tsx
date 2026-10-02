'use client'

import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'

import type { ProfesorListadoItem } from '../profesores.types'
import { ProfesorCard } from './ProfesorCard'

type ProfesoresGridProps = {
  /** URL del listado de profesores en el segmento del rol (por ejemplo `/mesa/profesores`). */
  rutaBase: string
  /** URL que abre la edición de un profesor como modal encima del listado. */
  hrefEditar: (id: number) => string
  /** Se llama al abrir la edición con el lápiz en esta pestaña (no con Cmd/Ctrl+clic). */
  onEditar: () => void
  /** Abre la confirmación de baja (profesor activo) o de reactivación (inactivo) de esa tarjeta. */
  onCambiarEstado: (profesor: ProfesorListadoItem) => void
  data?: ProfesorListadoItem[]
  isLoading: boolean
  /** Hay datos en pantalla y se está pidiendo otra página o búsqueda. */
  isFetching: boolean
  /** Lo que se muestra ocupando toda la grilla si no hay profesores. */
  vacio: ReactNode
}

export function ProfesoresGrid({
  rutaBase,
  hrefEditar,
  onEditar,
  onCambiarEstado,
  data,
  isLoading,
  isFetching,
  vacio,
}: ProfesoresGridProps) {
  return (
    <div
      aria-busy={isFetching}
      className={cn(
        'grid grid-cols-1 gap-4 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
        isFetching && !isLoading && 'opacity-60',
      )}
    >
      {isLoading ? (
        Array.from({ length: 10 }).map((_, i) => (
          <Card key={i} className="items-center gap-4 p-5">
            <Skeleton className="size-28 rounded-xl" />
            <div className="flex w-full flex-col items-center gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-5 w-16" />
            <div className="border-border mt-auto flex w-full justify-center gap-1 border-t pt-3">
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="size-9 rounded-lg" />
            </div>
          </Card>
        ))
      ) : data?.length ? (
        data.map((profesor) => (
          <ProfesorCard
            key={profesor.id}
            profesor={profesor}
            rutaBase={rutaBase}
            hrefEditar={hrefEditar}
            onEditar={onEditar}
            onCambiarEstado={onCambiarEstado}
          />
        ))
      ) : (
        <div className="col-span-full">{vacio}</div>
      )}
    </div>
  )
}
