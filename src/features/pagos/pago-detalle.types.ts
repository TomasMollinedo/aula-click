// Tipos del detalle de un pago (`GET /pagos/{id}`, HU-36) y de su comprobante adjunto
// (`GET` y `PUT /adjuntos/pagos/{pagoId}`, HU-24), según docs/contrato-api.md → Pagos y Adjuntos.
// Los importes son números en pesos que calcula la API: la UI solo los muestra. Fechas: string
// `YYYY-MM-DD`; instantes: ISO 8601 en UTC; horas: `HH:mm`.

import type { UsuarioAuditoria } from '@/types'
import type { EstadoPagoRegistrado, PagoParaAcciones } from '@/types/pago'

/** La forma de pago por su código fijo (nunca por el nombre, que es solo para mostrar). */
export type CodigoFormaPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO'

/** Red de una tarjeta de débito. */
export type RedDebito = 'VISA_DEBITO' | 'MASTERCARD_DEBITO' | 'MAESTRO' | 'CABAL_DEBITO' | 'OTRA'

/** Motivo de la anulación de un pago (HU-42). */
export type MotivoAnulacion = 'ERROR_CARGA' | 'FORMA_PAGO_EQUIVOCADA' | 'OTRO'

/** Un turno pagado: los datos **actuales** de su turno y el importe que se cobró. */
export type TurnoDelPago = {
  turnoId: number
  fecha: string
  horaInicio: string
  horaFin: string
  materia: { id: number; nombre: string }
  profesor: { id: number; nombre: string; apellido: string }
  importe: number
}

/** El último comprobante adjunto activo, como viene en el detalle: sin URL. */
export type AdjuntoDelPago = {
  id: number
  nombre: string
  /** `image/jpeg`, `image/png` o `application/pdf`. */
  tipo: string
  bytes: number
  adjuntadoPor: UsuarioAuditoria
  adjuntadoEl: string
}

/**
 * El comprobante adjunto con la URL para abrirlo (`GET` y `PUT /adjuntos/pagos/{pagoId}`). La URL
 * es prefirmada y vence a los 15 minutos: se usa como enlace y no se guarda.
 */
export type AdjuntoConUrl = AdjuntoDelPago & { url: string }

/** Respuesta de `GET /pagos/{id}`. */
export type DetallePago = {
  id: number
  numeroComprobante: number
  fechaPago: string
  alumno: { id: number; nombre: string; apellido: string; dni: string }
  /** Ordenados por fecha, hora de inicio y turno. */
  turnos: TurnoDelPago[]
  total: number
  /** Solo en efectivo; `null` con transferencia o débito. */
  montoRecibido: number | null
  /** `montoRecibido - total`, recalculado por la API; `null` sin monto recibido. */
  vuelto: number | null
  formaPago: { codigo: CodigoFormaPago; nombre: string }
  transferencia: { operacion: string; banco: string; titular: string | null } | null
  debito: { red: RedDebito; cupon: string; ultimos4: string | null } | null
  estado: EstadoPagoRegistrado
  anulacion: {
    motivo: MotivoAnulacion
    detalle: string | null
    anuladoPor: UsuarioAuditoria
    anuladoEl: string
  } | null
  observaciones: string | null
  registradoPor: UsuarioAuditoria
  registradoEl: string
  /** Cuántos turnos incluye. */
  cantidad: number
  /** `null` si no tiene (nunca tuvo, se quitó o es en efectivo). */
  adjunto: AdjuntoDelPago | null
  /** Las decide la API según el rol, el estado, la forma de pago y si tiene adjunto. */
  acciones: PagoParaAcciones['acciones']
}
