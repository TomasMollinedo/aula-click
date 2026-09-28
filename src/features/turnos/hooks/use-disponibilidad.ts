import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { BloqueDisponible, DisponibilidadParams } from '../turnos.types'
import { buscarDisponibilidad } from '../api/turnos.api'
import { turnosKeys } from '../api/turnos.keys'

/** Parámetros de la búsqueda: sin `materiaId` (todavía no se eligió) la query queda deshabilitada. */
export type DisponibilidadFiltros = Omit<DisponibilidadParams, 'materiaId'> & {
  materiaId?: number
}

/**
 * Horarios disponibles para una materia (y, opcionalmente, un día, un profesor y una fecha).
 *
 * Conserva la lista anterior mientras llega la nueva (`keepPreviousData`), así cambiar un filtro no
 * deja la lista en blanco. **Mientras `isPlaceholderData` es `true`, la lista es la de los filtros
 * anteriores:** la UI la muestra atenuada y no deja elegir un bloque ni tildar horas, porque lo
 * elegido puede no estar en la respuesta nueva.
 *
 * La fecha de la ocupación que se muestra ("Ocupación del lunes 28/09") sale siempre de `fecha` de
 * cada resultado (lo que respondió la API), nunca de la fecha pedida.
 *
 * `enabled` permite frenar la consulta aunque haya materia (por ejemplo, el refresco por fecha
 * mientras la fecha no tiene formato válido o es la misma del resultado).
 */
export function useDisponibilidad(filtros: DisponibilidadFiltros, enabled = true) {
  const { materiaId } = filtros
  const params: DisponibilidadParams = {
    materiaId: materiaId ?? 0,
    diaSemana: filtros.diaSemana,
    profesorId: filtros.profesorId,
    fecha: filtros.fecha || undefined,
  }
  return useQuery<BloqueDisponible[], ApiError>({
    queryKey: turnosKeys.disponibilidad(params),
    queryFn: () => buscarDisponibilidad(params),
    placeholderData: keepPreviousData,
    // Un 4xx (fecha pasada o que no cae en el día, materia inactiva o inexistente) no cambia
    // reintentando: se muestra enseguida. Solo se reintenta un error del servidor o de red.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
    enabled: enabled && materiaId != null && materiaId > 0,
  })
}
