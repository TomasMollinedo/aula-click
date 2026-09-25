'use client'

import { Skeleton } from '@/components/ui/skeleton'

import { useMaterias } from '../hooks/use-materias'

// "24 materias registradas": el total sin filtros (activas e inactivas), independiente de la
// búsqueda y del filtro del listado. Pide una página de una sola materia: alcanza con meta.total.
export function TotalMaterias() {
  const { data, isLoading, isError } = useMaterias({ page: 1, pageSize: 1, estado: 'TODOS' })

  if (isLoading) return <Skeleton className="inline-block h-3.5 w-40 align-middle" />
  if (isError || !data) return null

  const { total } = data.meta
  return <>{total === 1 ? '1 materia registrada' : `${total} materias registradas`}</>
}
