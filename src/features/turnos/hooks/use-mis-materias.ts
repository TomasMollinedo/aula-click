import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { MateriaOfertada } from '../mis-turnos.types'
import { listarMisMaterias } from '../api/mis-turnos.api'
import { misTurnosKeys } from '../api/mis-turnos.keys'

/** Paso 1 de "Sacar turno": las materias que se pueden elegir (las decide la API). */
export function useMisMaterias(enabled = true) {
  return useQuery<MateriaOfertada[], ApiError>({
    queryKey: misTurnosKeys.materias(),
    queryFn: listarMisMaterias,
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
    enabled,
  })
}
