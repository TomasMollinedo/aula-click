// Tipos de lo que la API de pagos recibe y devuelve (docs/contrato-api.md → Pagos y Errores,
// T-51; formas de pago, HU-23, T-96). Los importes son números en pesos, con hasta dos decimales:
// los calcula la API y la UI solo los muestra. Fechas: string `YYYY-MM-DD`. Horas: string `HH:mm`.

/** La forma de pago, por su código fijo (nunca por el nombre). */
export type CodigoFormaPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO'

/** La red de una tarjeta de débito. */
export type RedDebito = 'VISA_DEBITO' | 'MASTERCARD_DEBITO' | 'MAESTRO' | 'CABAL_DEBITO' | 'OTRA'

/** Los datos de cada medio en el body: un pago, un medio (HU-23). */
export type MedioRegistrarPago =
  | {
      formaPago: 'EFECTIVO'
      /** Obligatorio en efectivo: con él la API calcula el vuelto. */
      montoRecibido: number
    }
  | {
      formaPago: 'TRANSFERENCIA'
      transferencia: { operacion: string; banco: string; titular?: string }
      /** Obligatorio: el comprobante subido con `POST /adjuntos`. */
      comprobanteAdjuntoId: number
    }
  | {
      formaPago: 'DEBITO'
      /** `ultimos4` omitido = sin ellos. Nunca el número completo de la tarjeta. */
      debito: { red: RedDebito; cupon: string; ultimos4?: string }
      /** Opcional con débito. */
      comprobanteAdjuntoId?: number
    }

/** Body de `POST /pagos`. */
export type RegistrarPago = {
  alumnoId: number
  /** Pares `(turnoId, fecha)` en el orden en que se muestran (los errores vuelven por posición). */
  ocurrencias: { turnoId: number; fecha: string }[]
  fechaPago: string
  /** Omitido = sin observaciones. */
  observaciones?: string
} & MedioRegistrarPago

/** Respuesta 201 de `POST /pagos`. */
export type PagoRegistrado = {
  pagoId: number
  numeroComprobante: number
  cantidad: number
  total: number
  formaPago: CodigoFormaPago
  /** Sólo en efectivo; `null` con transferencia o débito. */
  montoRecibido: number | null
  /** `montoRecibido - total`; `null` fuera del efectivo. */
  vuelto: number | null
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
