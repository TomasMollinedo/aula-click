'use client'

import { Skeleton } from '@/components/ui/skeleton'

import { useProfesores } from '../hooks/use-profesores'

// "128 profesores registrados": el total sin filtros (activos e inactivos), independiente de la
// búsqueda y los filtros del listado. Pide una página de un solo profesor: alcanza con meta.total.
export function TotalProfesores() {
  const { data, isLoading, isError } = useProfesores({ page: 1, pageSize: 1, estado: 'TODOS' })

  if (isLoading) return <Skeleton className="inline-block h-3.5 w-40 align-middle" />
  if (isError || !data) return null

  const { total } = data.meta
  return <>{total === 1 ? '1 profesor registrado' : `${total} profesores registrados`}</>
}
