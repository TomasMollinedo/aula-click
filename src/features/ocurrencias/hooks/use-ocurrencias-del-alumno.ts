import { useQuery } from '@tanstack/react-query'

import type { OcurrenciaDeAlumno } from '@/types/ocurrencia'
import type { ApiError } from '@/utils/fetch-json'

import { listarOcurrenciasDelAlumno } from '../api/ocurrencias.api'
import { ocurrenciasKeys } from '../api/ocurrencias.keys'
import type { OcurrenciasDelAlumnoParams } from '../ocurrencias.types'

/**
 * Turnos del alumno en `[desde, hasta]` (pestaña "Turnos" de la ficha). `enabled` en `false`
 * frena el pedido (por ejemplo, con un rango invertido que la API igual rechazaría con 400).
 */
export function useOcurrenciasDelAlumno(
  params: OcurrenciasDelAlumnoParams,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery<OcurrenciaDeAlumno[], ApiError>({
    queryKey: ocurrenciasKeys.delAlumno(params),
    queryFn: () => listarOcurrenciasDelAlumno(params),
    enabled,
  })
}
