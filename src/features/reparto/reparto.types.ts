import type { PaginatedResponse, UsuarioAuditoria } from '@/types'

/** Porcentaje del centro vigente (`vigente` del GET y respuesta del PUT). */
export type PorcentajeVigente = {
  /** Número de 0 a 99,99 con hasta dos decimales (18 = 18 %). */
  porcentaje: number
  /** Desde cuándo rige: instante ISO 8601 en UTC. */
  desde: string
  cambiadoPor: UsuarioAuditoria
}

/** Fila del historial, del más reciente al más antiguo: la primera de la página 1 es el vigente. */
export type PorcentajeHistorialItem = PorcentajeVigente & { id: number }

export type PorcentajeCentroConHistorial = {
  vigente: PorcentajeVigente
  historial: PaginatedResponse<PorcentajeHistorialItem>
}

export type ObtenerPorcentajeParams = {
  page: number
  pageSize: number
}

/** Body del `PUT /reparto/porcentaje`. */
export type CambiarPorcentajeBody = {
  porcentaje: number
}
