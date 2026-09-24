'use client'

import { Skeleton } from '@/components/ui/skeleton'

import { useAlumnos } from '../hooks/use-alumnos'

// "128 alumnos registrados": el total sin filtros, independiente de la búsqueda del listado.
// Pide una página de un solo alumno: alcanza con el `meta.total`.
export function TotalAlumnos() {
  const { data, isLoading, isError } = useAlumnos({ page: 1, pageSize: 1 })

  if (isLoading) return <Skeleton className="inline-block h-3.5 w-32 align-middle" />
  if (isError || !data) return null

  const { total } = data.meta
  return <>{total === 1 ? '1 alumno registrado' : `${total} alumnos registrados`}</>
}
