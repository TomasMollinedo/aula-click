'use client'

import { Skeleton } from '@/components/ui/skeleton'

import { useMisAlumnos } from '../hooks/use-mis-alumnos'

// "5 alumnos con turnos vigentes": el total sin filtros, independiente de la búsqueda del listado.
// Pide una página de un solo alumno: alcanza con el `meta.total` (mismo truco que TotalAlumnos).
export function TotalMisAlumnos() {
  const { data, isLoading, isError } = useMisAlumnos({ page: 1, pageSize: 1 })

  if (isLoading) return <Skeleton className="inline-block h-3.5 w-48 align-middle" />
  if (isError || !data) return null

  const { total } = data.meta
  return (
    <>{total === 1 ? '1 alumno con turnos vigentes' : `${total} alumnos con turnos vigentes`}</>
  )
}
