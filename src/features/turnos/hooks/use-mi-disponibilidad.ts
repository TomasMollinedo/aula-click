import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { BloqueOfertado, MiDisponibilidadParams } from '../mis-turnos.types'
import { buscarMiDisponibilidad } from '../api/mis-turnos.api'
import { misTurnosKeys } from '../api/mis-turnos.keys'

/**
 * Horarios de una materia para el portal (y, opcionalmente, de un profesor y un día): cada hora
 * dice sólo si está disponible. Sin `materiaId` la query queda deshabilitada.
 */
export function useMiDisponibilidad(filtros: Partial<MiDisponibilidadParams>, enabled = true) {
  const { materiaId } = filtros
  const params: MiDisponibilidadParams = {
    materiaId: materiaId ?? 0,
    diaSemana: filtros.diaSemana,
    profesorId: filtros.profesorId,
    fecha: filtros.fecha || undefined,
  }
  return useQuery<BloqueOfertado[], ApiError>({
    queryKey: misTurnosKeys.disponibilidad(params),
    queryFn: () => buscarMiDisponibilidad(params),
    // Un 4xx (materia inactiva o inexistente, fecha inválida) no cambia reintentando.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
    enabled: enabled && materiaId != null && materiaId > 0,
  })
}
