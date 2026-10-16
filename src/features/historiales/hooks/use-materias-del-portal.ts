import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { listarMisMaterias } from '../api/historiales.api'
import { historialesKeys } from '../api/historiales.keys'
import type { MateriaDelPortal } from '../historiales.types'

/** "Mis materias" del alumno de la sesión (HU-33). */
export function useMateriasDelPortal() {
  return useQuery<MateriaDelPortal[], ApiError>({
    queryKey: historialesKeys.misMaterias(),
    queryFn: listarMisMaterias,
  })
}
