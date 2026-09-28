import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { MateriaDetalle } from '../materias.types'
import { obtenerMateria } from '../api/materias.api'
import { materiasKeys } from '../api/materias.keys'

export function useMateria(id: number) {
  return useQuery<MateriaDetalle, ApiError>({
    queryKey: materiasKeys.detail(id),
    queryFn: () => obtenerMateria(id),
    enabled: id > 0,
  })
}
