import type { UsuarioAuditoria } from '@/types'

// Tipos de lo que la API de pagos recibe y devuelve (docs/contrato-api.md → Pagos y Errores,
// T-51). Los importes son números en pesos, con hasta dos decimales: los calcula la API y la UI
// solo los muestra. Fechas: string `YYYY-MM-DD`. Horas: string `HH:mm`.

type Persona = { id: number; nombre: string; apellido: string }
type Referencia = { id: number; nombre: string }

/** Body de `POST /pagos`. La forma de pago no viaja: es "Efectivo" (única en este sprint). */
export type RegistrarPago = {
  alumnoId: number
  /** Pares `(turnoId, fecha)` en el orden en que se muestran (los errores vuelven por posición). */
  ocurrencias: { turnoId: number; fecha: string }[]
  fechaPago: string
  /** Omitido = no se informó. */
  montoRecibido?: number
  /** Omitido = sin observaciones. */
  observaciones?: string
}

/** Respuesta 201 de `POST /pagos`. */
export type PagoRegistrado = {
  pagoId: number
  numeroComprobante: number
  cantidad: number
  total: number
  /** `null` si no se informó el monto. */
  montoRecibido: number | null
  /** `montoRecibido - total`, o `null` sin monto recibido. */
  vuelto: number | null
}

/** Una ocurrencia pagada, con los datos **actuales** de su turno y el importe que se cobró. */
export type TurnoComprobante = {
  turnoId: number
  fecha: string
  horaInicio: string
  horaFin: string
  materia: Referencia
  profesor: Persona
  importe: number
}

/** Respuesta de `GET /pagos/{id}`: los datos del comprobante. */
export type Comprobante = {
  id: number
  numeroComprobante: number
  fechaPago: string
  alumno: Persona & { dni: string }
  /** Ordenados por fecha, hora de inicio y turno. */
  turnos: TurnoComprobante[]
  total: number
  montoRecibido: number | null
  vuelto: number | null
  formaPago: Referencia
  observaciones: string | null
  registradoPor: UsuarioAuditoria
  /** Instante ISO 8601 en UTC. */
  registradoEl: string
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
