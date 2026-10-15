import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerHistorialDelAlumno } from '../api/historiales.api'
import { historialesKeys } from '../api/historiales.keys'
import type { HistorialDelAlumno, HistorialParams } from '../historiales.types'

/**
 * El historial académico del alumno en el período y con los filtros que se ven (HU-31). Conserva el
 * historial anterior mientras llega el nuevo (`keepPreviousData`), así los selects de materia y
 * profesor no se vacían al cambiar de período; la pantalla atenúa lo que se ve mientras
 * `isPlaceholderData` y rotula el período con el `desde`/`hasta` **de la respuesta**.
 *
 * Los datos anteriores se conservan sólo si son del mismo alumno: en la ficha el alumno no cambia,
 * pero la query es de un recurso y no debe mostrar el historial de otro.
 */
export function useHistorialDelAlumno(alumnoId: number, params: HistorialParams) {
  return useQuery<HistorialDelAlumno, ApiError>({
    queryKey: historialesKeys.delAlumno(alumnoId, params),
    queryFn: () => obtenerHistorialDelAlumno(alumnoId, params),
    placeholderData: (anterior) => (anterior?.alumno.id === alumnoId ? anterior : undefined),
    // Un 4xx (período inválido, sin permiso, alumno inexistente) no cambia al reintentar.
    retry: (intentos, error) => intentos < 3 && !(error.status >= 400 && error.status < 500),
  })
}
