import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { ProfesorDetalle } from '../profesores.types'
import { obtenerProfesor } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'

export function useProfesor(id: number) {
  return useQuery<ProfesorDetalle, ApiError>({
    queryKey: profesoresKeys.detail(id),
    queryFn: () => obtenerProfesor(id),
    enabled: id > 0,
  })
}
