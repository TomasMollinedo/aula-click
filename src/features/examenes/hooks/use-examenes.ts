import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { listarExamenes } from '../api/examenes.api'
import { examenesKeys } from '../api/examenes.keys'
import type { ExamenesListado } from '../examenes.types'

/** Exámenes de un alumno (`GET /examenes?alumnoId`): próximos y pasados. */
export function useExamenes(alumnoId: number) {
  return useQuery<ExamenesListado, ApiError>({
    queryKey: examenesKeys.delAlumno(alumnoId),
    queryFn: () => listarExamenes(alumnoId),
  })
}
