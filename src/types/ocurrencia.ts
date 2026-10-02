import type { ReactNode } from 'react'

import type { Auditoria, UsuarioAuditoria } from './index'

// Tipos compartidos de la ocurrencia de un turno. Viven acá y no en una feature porque los usan
// varias (`ocurrencias`, `cancelaciones`, `finalizaciones`, `pagos`, `cuentas`, `documentos`,
// `turnos`) y ninguna puede importar los types de otra (docs/arquitectura-frontend.md).
//
// Siguen el contrato real de `GET /ocurrencias/{turnoId}/{fecha}` y `GET /ocurrencias?alumnoId`
// (T-43, docs/contrato-api.md → Ocurrencias), con el `pago` del detalle y el `estadoPago` de la
// lista (los sumó el PR de pagos, T-52/T-54). **Sin `reprogramacion`/`fechaOriginal`**: reprogramar
// cambia el turno a su fecha y bloque nuevos (una sesión única nueva si era una ocurrencia de un
// recurrente), así que `turnoId` + `fecha` ya identifican la ocurrencia tal cual está ahora; no se
// guarda desde dónde se movió (definición A de las PO). Fechas: string `YYYY-MM-DD`. Horas: string
// `HH:mm`. Importes: número JSON en pesos, que calcula la API.

export type TipoOcurrencia = 'RECURRENTE' | 'SESION_UNICA'

/** Lo calcula la API. La UI lo muestra como "Agendado", "Cancelado" y "Sin registrado". */
export type EstadoOcurrencia = 'AGENDADO' | 'CANCELADO' | 'SIN_REGISTRAR'

/** Estado de pago de una ocurrencia: el de las agendas, la lista de turnos del alumno y el detalle. */
export type EstadoPagoOcurrencia = 'PENDIENTE' | 'PAGADO'

/**
 * El pago de una ocurrencia en su detalle (HU-15). Pendiente: lo que costaría cobrarla hoy (el
 * precio vigente de la materia; `null` si no tiene precio). Pagada: lo que se cobró (`importe` no
 * cambia si después cambia el precio) y los datos de su pago, con los nombres de `GET /pagos/{id}`.
 */
export type PagoDeOcurrencia =
  | { estado: 'PENDIENTE'; importeVigente: number | null }
  | {
      estado: 'PAGADO'
      pagoId: number
      numeroComprobante: number
      importe: number
      formaPago: { id: number; nombre: string }
      fechaPago: string
      registradoPor: UsuarioAuditoria
      registradoEl: string
    }

/** La calcula la API a partir de los exámenes del alumno (HU-18); `null` en una cancelada. */
export type PrioridadOcurrencia = 'ALTA' | 'MEDIA' | 'BAJA'

export type MotivoCancelacion =
  'CANCELACION_ALUMNO' | 'CANCELACION_PROFESOR' | 'PROBLEMA_ADMINISTRATIVO' | 'OTRO'

type Persona = { id: number; nombre: string; apellido: string }
type Referencia = { id: number; nombre: string }

/**
 * Qué acciones admite la ocurrencia. **Lo decide la API**: cada acción se muestra según este dato
 * y nunca con reglas propias (docs/arquitectura-frontend.md → Acciones sobre una ocurrencia).
 * `cancelar` viene visible y deshabilitada, con su `motivo`, en una ocurrencia agendada y pagada.
 */
export type AccionesOcurrencia = {
  cancelar: { visible: boolean; habilitada: boolean; motivo?: string }
  finalizar: { visible: boolean }
  reprogramar: { visible: boolean }
  registrarPago: { visible: boolean }
}

/** El examen que determina la prioridad (T-31), si hay uno próximo. */
export type ExamenQueDeterminaPrioridad = {
  id: number
  fecha: string
  tipo: string
  materiaNombre: string
  /** Días desde la fecha de la ocurrencia hasta el examen. */
  dias: number
}

export type FinalizacionDeSerie = {
  /** Fin efectivo de la serie (definición C): desde esta fecha ya no genera ocurrencias. */
  fechaDesde: string
  motivo: MotivoCancelacion
  detalle: string | null
  createdBy: UsuarioAuditoria | null
  createdAt: string
}

export type CancelacionDeOcurrencia = {
  motivo: MotivoCancelacion
  detalle: string | null
  createdBy: UsuarioAuditoria | null
  createdAt: string
}

/**
 * Detalle de una ocurrencia: un turno en una fecha. La identifican `turnoId` + `fecha` (definición
 * B); si se reprogramó, son los nuevos.
 */
export type OcurrenciaDetalle = {
  turnoId: number
  fecha: string
  alumno: Persona & { dni: string }
  materia: Referencia
  profesor: Persona
  aula: Referencia
  horaInicio: string
  horaFin: string
  tipo: TipoOcurrencia
  estado: EstadoOcurrencia
  observaciones: string | null
  temas: string | null
  serie: {
    fechaInicio: string
    /** `null` en un recurrente sin fin. */
    fechaFin: string | null
    finalizacion: FinalizacionDeSerie | null
  }
  cancelacion: CancelacionDeOcurrencia | null
  /** `null` para el profesor, que no ve pagos. */
  pago: PagoDeOcurrencia | null
  prioridad: PrioridadOcurrencia | null
  examen: ExamenQueDeterminaPrioridad | null
  acciones: AccionesOcurrencia
} & Auditoria

/**
 * Una ocurrencia en la lista de turnos de un alumno (`GET /ocurrencias?alumnoId`). Es lo que
 * reciben las acciones sobre varias a la vez (cancelar varios).
 */
export type OcurrenciaDeAlumno = {
  turnoId: number
  fecha: string
  diaSemana: number
  horaInicio: string
  horaFin: string
  tipo: TipoOcurrencia
  estado: EstadoOcurrencia
  /** Una cancelada viene `PENDIENTE` (nunca se cobró): la UI no lo muestra. */
  estadoPago: EstadoPagoOcurrencia
  prioridad: PrioridadOcurrencia | null
  profesor: Persona
  materia: Referencia
  /** Mismas reglas que `acciones.cancelar` del detalle: casilla de selección en la lista. */
  cancelable: boolean
}

/**
 * Qué detalle abrir y cómo cerrarlo. Es lo que una pantalla (agenda, ficha del alumno, alta de
 * turno) le pasa a `renderDetalle`, que compone `app/` con el detalle y sus acciones.
 */
export type SolicitudDetalleOcurrencia = {
  turnoId: number
  fecha: string
  onCerrar: () => void
}

export type RenderDetalleOcurrencia = (solicitud: SolicitudDetalleOcurrencia) => ReactNode
