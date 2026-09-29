'use client'

import type { OcurrenciaDetalle } from '@/types/ocurrencia'

export type AccionRegistrarPagoProps = {
  ocurrencia: OcurrenciaDetalle
}

/**
 * PLACEHOLDER de T-35, lo completa T-52: "Registrar pago" en el pie del detalle. Se muestra según
 * `ocurrencia.acciones.registrarPago.visible`, nunca con reglas propias.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder: las props ya son las definitivas
export function AccionRegistrarPago(_props: AccionRegistrarPagoProps) {
  return null
}
