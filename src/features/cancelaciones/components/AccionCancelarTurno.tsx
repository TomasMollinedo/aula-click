'use client'

import type { OcurrenciaDetalle } from '@/types/ocurrencia'

export type AccionCancelarTurnoProps = {
  ocurrencia: OcurrenciaDetalle
}

/**
 * PLACEHOLDER de T-35, lo completa T-46: "Cancelar turno" en el pie del detalle. Se muestra según
 * `ocurrencia.acciones.cancelar` (visible / habilitada / motivo), nunca con reglas propias.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder: las props ya son las definitivas
export function AccionCancelarTurno(_props: AccionCancelarTurnoProps) {
  return null
}
