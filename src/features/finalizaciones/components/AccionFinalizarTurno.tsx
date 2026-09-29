'use client'

import type { OcurrenciaDetalle } from '@/types/ocurrencia'

export type AccionFinalizarTurnoProps = {
  ocurrencia: OcurrenciaDetalle
}

/**
 * PLACEHOLDER de T-35, lo completa T-48: "Finalizar recurrencia" en el pie del detalle. Se muestra
 * según `ocurrencia.acciones.finalizar.visible`, nunca con reglas propias.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder: las props ya son las definitivas
export function AccionFinalizarTurno(_props: AccionFinalizarTurnoProps) {
  return null
}
