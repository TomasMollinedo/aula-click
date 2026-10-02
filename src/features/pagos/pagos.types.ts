// Tipos de lo que la API de pagos recibe y devuelve (docs/contrato-api.md → Pagos y Errores,
// T-51). Los importes son números en pesos, con hasta dos decimales: los calcula la API y la UI
// solo los muestra. Fechas: string `YYYY-MM-DD`. Horas: string `HH:mm`.

/** Body de `POST /pagos`. La forma de pago no viaja: es "Efectivo" (única en este sprint). */
export type RegistrarPago = {
  alumnoId: number
  /** Pares `(turnoId, fecha)` en el orden en que se muestran (los errores vuelven por posición). */
  ocurrencias: { turnoId: number; fecha: string }[]
  fechaPago: string
  /** Obligatorio: el pago es en efectivo. */
  montoRecibido: number
  /** Omitido = sin observaciones. */
  observaciones?: string
}

/** Respuesta 201 de `POST /pagos`. */
export type PagoRegistrado = {
  pagoId: number
  numeroComprobante: number
  cantidad: number
  total: number
  montoRecibido: number
  /** `montoRecibido - total`. */
  vuelto: number
}

/** Por qué no se puede cobrar una ocurrencia (409 `TURNOS_NO_COBRABLES`), en el orden en que se evalúan. */
export type MotivoNoCobrable =
  'NO_EXISTE' | 'CANCELADO' | 'YA_PAGADO' | 'FUERA_DE_RANGO' | 'SIN_PRECIO'

/** Una entrada de `details` del 409 `TURNOS_NO_COBRABLES`. */
export type DetalleNoCobrable = {
  path: ['ocurrencias', number]
  message: string
  turnoId: number
  fecha: string
  motivo: MotivoNoCobrable
  /** Solo con `YA_PAGADO`: el pago que ya la cubre. */
  pagoId?: number
}
