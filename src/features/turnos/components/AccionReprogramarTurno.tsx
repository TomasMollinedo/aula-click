'use client'

import type { OcurrenciaDetalle } from '@/types/ocurrencia'

export type AccionReprogramarTurnoProps = {
  ocurrencia: OcurrenciaDetalle
}

/**
 * PLACEHOLDER de T-35, lo completa T-50: "Reprogramar" en el pie del detalle. Se muestra según
 * `ocurrencia.acciones.reprogramar.visible`, nunca con reglas propias.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder: las props ya son las definitivas
export function AccionReprogramarTurno(_props: AccionReprogramarTurnoProps) {
  return null
}
