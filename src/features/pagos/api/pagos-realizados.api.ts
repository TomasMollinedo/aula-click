import { fetchJson } from '@/utils/fetch-json'

import type {
  BuscadorAcotadoParams,
  BuscadorPagosParams,
  ListadoPagosRealizados,
  ListarPagosRealizadosParams,
  OpcionBuscadorPagos,
  OpcionMateriaDePagos,
} from '../pagos-realizados.types'

const BASE = '/api/v1/pagos'

/** Un query sin los vacíos: cada valor como texto. */
function query(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [nombre, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '') qs.set(nombre, String(valor))
  }
  const texto = qs.toString()
  return texto ? `?${texto}` : ''
}

/** Los pagos realizados del filtro (una página) y lo cobrado de todo el filtro, por forma de pago. */
export function listarPagosRealizados(
  params: ListarPagosRealizadosParams,
): Promise<ListadoPagosRealizados> {
  return fetchJson<ListadoPagosRealizados>(`${BASE}${query(params)}`)
}

/** Los alumnos con algún pago, para el filtro (hasta 20): por `q` y/o uno solo por su `id`. */
export function buscarAlumnosDePagos(params: BuscadorPagosParams): Promise<OpcionBuscadorPagos[]> {
  return fetchJson<OpcionBuscadorPagos[]>(`${BASE}/alumnos${query(params)}`)
}

/**
 * Los profesores con algún turno pagado, para el filtro (hasta 20): por `q` y/o por su `id`; con
 * `alumnoId`, solo los de los pagos de ese alumno.
 */
export function buscarProfesoresDePagos(
  params: BuscadorAcotadoParams,
): Promise<OpcionBuscadorPagos[]> {
  return fetchJson<OpcionBuscadorPagos[]>(`${BASE}/profesores${query(params)}`)
}

/** Lo mismo con las materias de algún turno pagado, incluidas las dadas de baja. */
export function buscarMateriasDePagos(
  params: BuscadorAcotadoParams,
): Promise<OpcionMateriaDePagos[]> {
  return fetchJson<OpcionMateriaDePagos[]>(`${BASE}/materias${query(params)}`)
}
