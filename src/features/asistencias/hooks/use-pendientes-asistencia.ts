import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerPendientes } from '../api/asistencias.api'
import { asistenciasKeys } from '../api/asistencias.keys'
import type { AsistenciasPendientes } from '../asistencias.types'

/** Turnos de días anteriores sin registrar y en plazo (`GET /asistencias/pendientes`). */
export function usePendientesAsistencia() {
  return useQuery<AsistenciasPendientes, ApiError>({
    queryKey: asistenciasKeys.pendientes(),
    queryFn: obtenerPendientes,
  })
}
