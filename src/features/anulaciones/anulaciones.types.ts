// Tipos de la API de anulaciones (docs/contrato-api.md → Anulaciones). Importes en pesos.

export type MotivoAnulacion = 'ERROR_CARGA' | 'FORMA_PAGO_EQUIVOCADA' | 'OTRO'

type PersonaDelPago = { id: number; nombre: string; apellido: string }

/** Respuesta de `GET /anulaciones/previa`: el resumen para confirmar y los avisos. */
export type PreviaAnulacion = {
  pago: {
    id: number
    numeroComprobante: number
    alumno: PersonaDelPago
    total: number
    cantidad: number
  }
  avisos: AvisosAnulacion
}

/** Los avisos informan, no bloquean: anular se puede igual. */
export type AvisosAnulacion = {
  /** El alumno quedaría con deuda vencida; `null` si no. */
  deuda: AvisoDeuda | null
  /** Materias cuyo precio vigente es distinto del cobrado; `[]` si no hay. */
  precios: AvisoPrecio[]
  /** Otros pagos vigentes con la misma transferencia; `null` si no hay. */
  transferenciaCompartida: AvisoTransferenciaCompartida | null
}

export type AvisoDeuda = {
  /** Turnos con deuda vencida que tendría el alumno al anular. */
  cantidad: number
  /** Lo que suman, a precio vigente (una materia sin precio cuenta en `cantidad` pero no suma). */
  total: number
  /** Cuántos de esos turnos son de este pago; puede ser 0. */
  turnosDelPago: number
}

export type AvisoPrecio = {
  materia: { id: number; nombre: string }
  cobrado: number
  /** `null` si la materia ya no tiene precio. */
  vigente: number | null
}

export type AvisoTransferenciaCompartida = {
  operacion: string
  banco: string
  pagos: { pagoId: number; numeroComprobante: number; alumno: PersonaDelPago }[]
}

/** Body de `POST /anulaciones`. */
export type AnularPagoBody = {
  pagoId: number
  motivo: MotivoAnulacion
  /** Se omite si no hay detalle. */
  detalle?: string
}

/** Respuesta 201 de `POST /anulaciones`: los turnos que volvieron a quedar pendientes de pago. */
export type AnulacionCreada = {
  pagoId: number
  cantidad: number
}
