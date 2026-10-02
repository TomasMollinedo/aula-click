import type { FiltrosAgenda } from '@/types/agenda'
import type { PrioridadOcurrencia } from '@/types/ocurrencia'

// Los filtros de las agendas en la URL (`?profesorId=&incluirCancelados=true&prioridad=`). Funciones
// puras: este es el único lugar que conoce los nombres de los parámetros y sus valores válidos.

export const PRIORIDADES_FILTRO: readonly PrioridadOcurrencia[] = ['ALTA', 'MEDIA', 'BAJA']

export const FILTROS_VACIOS: FiltrosAgenda = {
  profesorId: null,
  incluirCancelados: false,
  prioridad: null,
}

/** `true` si hay algún filtro puesto (para el mensaje de "sin resultados" de las listas). */
export function hayFiltrosActivos(filtros: FiltrosAgenda): boolean {
  return filtros.profesorId !== null || filtros.incluirCancelados || filtros.prioridad !== null
}

/** Los filtros de cancelados y prioridad como parámetros de la API (lo vacío no se manda). */
export function paramsDeCanceladosYPrioridad(filtros: FiltrosAgenda): {
  incluirCancelados?: boolean
  prioridad?: PrioridadOcurrencia
} {
  return {
    incluirCancelados: filtros.incluirCancelados || undefined,
    prioridad: filtros.prioridad ?? undefined,
  }
}

/** Un valor inválido (o ausente) es "sin filtro": la URL nunca rompe la pantalla. */
export function leerFiltros(params: URLSearchParams): FiltrosAgenda {
  const profesorId = Number(params.get('profesorId'))
  const prioridad = params.get('prioridad')
  return {
    profesorId: Number.isInteger(profesorId) && profesorId > 0 ? profesorId : null,
    incluirCancelados: params.get('incluirCancelados') === 'true',
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
  if (filtros.incluirCancelados) nuevos.set('incluirCancelados', 'true')
  else nuevos.delete('incluirCancelados')
  if (filtros.prioridad !== null) nuevos.set('prioridad', filtros.prioridad)
  else nuevos.delete('prioridad')
  return nuevos
}
