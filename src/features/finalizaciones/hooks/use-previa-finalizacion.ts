import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerPrevia } from '../api/finalizaciones.api'
import { finalizacionesKeys } from '../api/finalizaciones.keys'
import { esFechaConFormato } from '../finalizaciones.schema'
import type { PreviaFinalizacion } from '../finalizaciones.types'

/**
 * Qué pasa si el turno se finaliza desde `fechaDesde` (`GET /finalizaciones/previa`): cuántos
 * turnos se liberan, los pagados que lo impiden y las otras horas de la clase. Sin una fecha con formato
 * válido la query queda deshabilitada.
 *
 * Conserva la previa anterior mientras llega la nueva (`keepPreviousData`), así cambiar la fecha no
 * deja el resumen en blanco. **Mientras `isPlaceholderData` es `true`, la previa es la de la fecha
 * anterior:** la UI la muestra atenuada y no deja confirmar.
 */
export function usePreviaFinalizacion(turnoId: number, fechaDesde: string) {
  return useQuery<PreviaFinalizacion, ApiError>({
    queryKey: finalizacionesKeys.previa(turnoId, fechaDesde),
    queryFn: () => obtenerPrevia({ turnoId, fechaDesde }),
    placeholderData: keepPreviousData,
    // Un 4xx (fecha que no cae en el día, turno ya finalizado) no cambia reintentando: se muestra
    // enseguida. Solo se reintenta un error del servidor o de red.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
    enabled: esFechaConFormato(fechaDesde),
  })
}
