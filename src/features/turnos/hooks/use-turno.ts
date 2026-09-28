import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { TurnoDetalle } from '../turnos.types'
import { obtenerTurno } from '../api/turnos.api'
import { turnosKeys } from '../api/turnos.keys'

export function useTurno(id: number) {
  return useQuery<TurnoDetalle, ApiError>({
    queryKey: turnosKeys.detail(id),
    queryFn: () => obtenerTurno(id),
    enabled: id > 0,
  })
}
