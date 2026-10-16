import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { buscarAlumnosDePagos, buscarProfesoresDePagos } from '../api/pagos-realizados.api'
import { pagosKeys } from '../api/pagos.keys'
import type { BuscadorPagosParams, OpcionBuscadorPagos } from '../pagos-realizados.types'

// Los buscadores de los filtros de pagos realizados (decisión T-169): son de `pagos` y los usan
// mesa de entradas y el gerente, que no puede usar `GET /alumnos` ni `GET /profesores`. Con `q`, las
// opciones del menú (`enabled` = menú abierto); con `id`, el nombre del filtro que vino en la URL
// (`[]` = no encontrado).

/** Alumnos con algún pago, vigente o anulado. */
export function useAlumnosDePagos(params: BuscadorPagosParams, enabled = true) {
  return useQuery<OpcionBuscadorPagos[], ApiError>({
    queryKey: pagosKeys.buscadorAlumnos(params),
    queryFn: () => buscarAlumnosDePagos(params),
    enabled,
  })
}

/** Profesores con algún turno pagado, incluidos los dados de baja. */
export function useProfesoresDePagos(params: BuscadorPagosParams, enabled = true) {
  return useQuery<OpcionBuscadorPagos[], ApiError>({
    queryKey: pagosKeys.buscadorProfesores(params),
    queryFn: () => buscarProfesoresDePagos(params),
    enabled,
  })
}
