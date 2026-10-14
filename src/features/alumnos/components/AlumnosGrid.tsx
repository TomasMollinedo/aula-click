'use client'

import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/utils/cn'

import type { AlumnoListadoItem } from '../alumnos.types'
import { AlumnoCard } from './AlumnoCard'

type AlumnosGridProps = {
  /** URL del listado de alumnos en el segmento del rol (por ejemplo `/mesa/alumnos`). */
  rutaBase: string
  /** URL que abre la edición de un alumno como modal encima del listado. */
  hrefEditar: (id: number) => string
  /** Se llama al abrir la edición con el lápiz en esta pestaña (no con Cmd/Ctrl+clic). */
  onEditar: () => void
  data?: AlumnoListadoItem[]
  isLoading: boolean
  /** Hay datos en pantalla y se está pidiendo otra página o búsqueda. */
  isFetching: boolean
  /** Lo que se muestra ocupando toda la grilla si no hay alumnos. */
  vacio: ReactNode
}

// Grilla de tarjetas del listado (HU-26), como ProfesoresGrid.
export function AlumnosGrid({
  rutaBase,
  hrefEditar,
  onEditar,
  data,
  isLoading,
  isFetching,
  vacio,
}: AlumnosGridProps) {
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
            <div className="border-border mt-auto flex w-full justify-center gap-1 border-t pt-3">
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="size-9 rounded-lg" />
            </div>
          </Card>
        ))
      ) : data?.length ? (
        data.map((alumno) => (
          <AlumnoCard
            key={alumno.id}
            alumno={alumno}
            rutaBase={rutaBase}
            hrefEditar={hrefEditar}
            onEditar={onEditar}
          />
        ))
      ) : (
        <div className="col-span-full">{vacio}</div>
      )}
    </div>
  )
}
