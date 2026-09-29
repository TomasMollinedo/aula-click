'use client'

import type { OcurrenciaDeAlumno } from '@/types/ocurrencia'

export type RegistrarPagoDialogProps = {
  alumnoId: number
  /** Las ocurrencias que se ofrecen pagar (pendientes, del mismo alumno). */
  ocurrencias: OcurrenciaDeAlumno[]
  onCerrar: () => void
}

/**
 * PLACEHOLDER de T-35, lo completa T-52: el diálogo de registrar un pago. Lo abren "Registrar pago"
 * de las pestañas de pagos (`cuentas`) y `AccionRegistrarPago`; `app/` lo compone como
 * `renderRegistrarPago`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder: las props ya son las definitivas
export function RegistrarPagoDialog(_props: RegistrarPagoDialogProps) {
  return null
}
