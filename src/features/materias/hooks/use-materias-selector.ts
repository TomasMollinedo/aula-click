import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { MateriaSelectorItem } from '../materias.types'
import { listarSelectorMaterias } from '../api/materias.api'
import { materiasKeys } from '../api/materias.keys'

/** Materias activas para los dropdowns (filtros y formularios de otras features). */
export function useMateriasSelector() {
  return useQuery<MateriaSelectorItem[], ApiError>({
    queryKey: materiasKeys.selector(),
    queryFn: listarSelectorMaterias,
  })
}
