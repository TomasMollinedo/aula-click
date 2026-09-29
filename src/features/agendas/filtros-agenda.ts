import type { FiltrosAgenda } from '@/types/agenda'
import type { EstadoOcurrencia, PrioridadOcurrencia } from '@/types/ocurrencia'

// Los filtros de las agendas en la URL (`?profesorId=&estado=&prioridad=`). Funciones puras: este
// es el único lugar que conoce los nombres de los parámetros y sus valores válidos.

export const ESTADOS_FILTRO: readonly EstadoOcurrencia[] = [
  'AGENDADO',
  'CANCELADO',
  'SIN_REGISTRAR',
]
export const PRIORIDADES_FILTRO: readonly PrioridadOcurrencia[] = ['ALTA', 'MEDIA', 'BAJA']

export const FILTROS_VACIOS: FiltrosAgenda = { profesorId: null, estado: null, prioridad: null }

/** Un valor inválido (o ausente) es "sin filtro": la URL nunca rompe la pantalla. */
export function leerFiltros(params: URLSearchParams): FiltrosAgenda {
  const profesorId = Number(params.get('profesorId'))
  const estado = params.get('estado')
  const prioridad = params.get('prioridad')
  return {
    profesorId: Number.isInteger(profesorId) && profesorId > 0 ? profesorId : null,
    estado: ESTADOS_FILTRO.find((e) => e === estado) ?? null,
    prioridad: PRIORIDADES_FILTRO.find((p) => p === prioridad) ?? null,
  }
}

/**
 * Copia de `params` con los filtros dados: un filtro vacío no se escribe, los demás parámetros
 * (fecha, vista, tab…) se conservan y `page` se descarta, porque cambiar un filtro vuelve a la
 * página 1.
 */
export function paramsConFiltros(params: URLSearchParams, filtros: FiltrosAgenda): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  nuevos.delete('page')
  if (filtros.profesorId !== null) nuevos.set('profesorId', String(filtros.profesorId))
  else nuevos.delete('profesorId')
  if (filtros.estado !== null) nuevos.set('estado', filtros.estado)
  else nuevos.delete('estado')
  if (filtros.prioridad !== null) nuevos.set('prioridad', filtros.prioridad)
  else nuevos.delete('prioridad')
  return nuevos
}
