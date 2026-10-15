import type { ObtenerPorcentajeParams } from '../reparto.types'

export const repartoKeys = {
  all: ['reparto'] as const,
  porcentajes: () => [...repartoKeys.all, 'porcentaje'] as const,
  porcentaje: (params: ObtenerPorcentajeParams) => [...repartoKeys.porcentajes(), params] as const,
}
