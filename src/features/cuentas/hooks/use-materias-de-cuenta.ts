import { useMemo } from 'react'

import { useMaterias } from '@/features/materias/hooks/use-materias'

/** El `pageSize` máximo de la API (docs/contrato-api.md → Listados paginados). */
const PAGE_SIZE_MAXIMO = 100

export type MateriaDeCuenta = { id: number; nombre: string; inactiva: boolean }

/**
 * Las materias para el filtro de `cuentas`: **todas**, también las dadas de baja (un turno
 * adeudado puede ser de una materia que ya no se dicta), en una sola página del listado de
 * `materias` (su hook, con `estado: 'TODOS'` y el `pageSize` máximo). `completa` es `false` si
 * hubiera más de una página: en ese caso el filtro muestra solo las primeras.
 */
export function useMateriasDeCuenta() {
  const query = useMaterias({ estado: 'TODOS', pageSize: PAGE_SIZE_MAXIMO })
  const materias = useMemo<MateriaDeCuenta[]>(
    () =>
      (query.data?.data ?? []).map((materia) => ({
        id: materia.id,
        nombre: materia.nombre,
        inactiva: materia.estado === 'INACTIVO',
      })),
    [query.data],
  )

  return {
    materias,
    completa: query.data ? query.data.meta.totalPages <= 1 : true,
    isLoading: query.isLoading,
    isError: query.isError,
    isSuccess: query.isSuccess,
  }
}
