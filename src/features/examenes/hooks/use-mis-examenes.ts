import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerMisExamenes } from '../api/examenes.api'
import { examenesKeys } from '../api/examenes.keys'
import type { MisExamenesDeMateria } from '../examenes.types'

/** Los exámenes del alumno de la sesión en una materia (portal, HU-35). */
export function useMisExamenes(materiaId: number) {
  return useQuery<MisExamenesDeMateria, ApiError>({
    queryKey: examenesKeys.mios(materiaId),
    queryFn: () => obtenerMisExamenes(materiaId),
  })
}
