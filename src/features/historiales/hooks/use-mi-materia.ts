import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerMiMateria } from '../api/historiales.api'
import { historialesKeys } from '../api/historiales.keys'
import type { MiHistorialDeMateria } from '../historiales.types'

/**
 * El historial del alumno de la sesión en una materia con un profesor, en un mes (HU-33). Al cambiar
 * de mes deja en pantalla el anterior mientras llega el nuevo. Un 4xx (materia que no cursa, mes
 * inválido) no cambia al reintentar.
 */
export function useMiMateria(materiaId: number, profesorId: number, mes: string) {
  return useQuery<MiHistorialDeMateria, ApiError>({
    queryKey: historialesKeys.miMateria(materiaId, profesorId, mes),
    queryFn: () => obtenerMiMateria(materiaId, profesorId, mes),
    placeholderData: keepPreviousData,
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
