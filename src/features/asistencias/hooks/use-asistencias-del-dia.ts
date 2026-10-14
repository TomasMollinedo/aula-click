import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerAsistenciasDelDia } from '../api/asistencias.api'
import { asistenciasKeys } from '../api/asistencias.keys'
import type { AsistenciasDelDia } from '../asistencias.types'

/** Las clases del profesor en `fecha` (`GET /asistencias?fecha`). */
export function useAsistenciasDelDia(fecha: string) {
  return useQuery<AsistenciasDelDia, ApiError>({
    queryKey: asistenciasKeys.dia(fecha),
    queryFn: () => obtenerAsistenciasDelDia(fecha),
  })
}
