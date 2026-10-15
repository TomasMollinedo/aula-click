import { useQuery } from '@tanstack/react-query'

import type { OcurrenciaDetallePortal } from '@/types/ocurrencia'
import type { ApiError } from '@/utils/fetch-json'

import { obtenerMiTurno } from '../api/ocurrencias.api'
import { ocurrenciasKeys } from '../api/ocurrencias.keys'
import type { ObtenerOcurrenciaParams } from '../ocurrencias.types'

/** Detalle de un turno del alumno de la sesión en el portal (`?detalle=<turnoId>&fecha=`). */
export function useMiTurno(params: ObtenerOcurrenciaParams) {
  return useQuery<OcurrenciaDetallePortal, ApiError>({
    queryKey: ocurrenciasKeys.miTurno(params),
    queryFn: () => obtenerMiTurno(params),
  })
}
