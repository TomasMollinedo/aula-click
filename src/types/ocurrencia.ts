import type { ReactNode } from 'react'

import type { Auditoria } from './index'

// Tipos compartidos de la ocurrencia de un turno (T-35). Viven acá y no en una feature porque los
// usan varias (`ocurrencias`, `cancelaciones`, `finalizaciones`, `pagos`, `cuentas`, `documentos`,
// `turnos`) y ninguna puede importar los types de otra (docs/arquitectura-frontend.md).
//
// Siguen el contrato de `GET /ocurrencias/{turnoId}/{fecha}` y `GET /ocurrencias?alumnoId` (T-43,
// docs/sprint-2/sprint-2.md). Mientras el contrato final no esté escrito son provisorios: T-44
// (dueña de este archivo desde que empieza) los ajusta y avisa a T-46, T-48, T-50, T-52 y T-60.
// Fechas: string `YYYY-MM-DD`. Horas: string `HH:mm`.

export type TipoOcurrencia = 'RECURRENTE' | 'SESION_UNICA'

/** Lo calcula la API. La UI lo muestra como "Agendado", "Cancelado" y "Sin registrar". */
export type EstadoOcurrencia = 'AGENDADO' | 'CANCELADO' | 'SIN_REGISTRAR'

export type EstadoPagoOcurrencia = 'PENDIENTE' | 'PAGADO'

/** La calcula la API a partir de los exámenes del alumno (HU-18); `null` en una cancelada. */
export type PrioridadOcurrencia = 'ALTA' | 'MEDIA' | 'BAJA'

export type MotivoCancelacion =
  'CANCELACION_ALUMNO' | 'CANCELACION_PROFESOR' | 'PROBLEMA_ADMINISTRATIVO' | 'OTRO'

type Persona = { id: number; nombre: string; apellido: string }
type Referencia = { id: number; nombre: string }
/** Quién hizo algo y cuándo (registro de un pago, cancelación, reprogramación…). */
type Registro = { por: Persona | null; en: string }

/**
 * Qué acciones admite la ocurrencia. **Lo decide la API**: cada acción se muestra según este dato
 * y nunca con reglas propias (docs/arquitectura-frontend.md → Acciones sobre una ocurrencia).
 */
export type AccionesOcurrencia = {
  /** Visible pero deshabilitada (con su `motivo`) cuando el turno está pagado. */
  cancelar: { visible: boolean; habilitada: boolean; motivo?: string }
  finalizar: { visible: boolean }
  reprogramar: { visible: boolean }
  registrarPago: { visible: boolean }
}

export type PagoOcurrencia =
  | {
      estado: 'PENDIENTE'
      /** Precio vigente de la materia: lo que costaría pagarlo hoy. */
      importeVigente: number
    }
  | {
      estado: 'PAGADO'
      pagoId: number
      numeroComprobante: number
      importe: number
      formaPago: string
      /** Fecha del pago. */
      fecha: string
      registro: Registro
    }

/**
 * Detalle de una ocurrencia: un turno en una fecha. Se identifica por `turnoId` + `fechaOriginal`
 * (la fecha de la serie), aunque después se reprograme a otra fecha u hora; `fecha`, `horaInicio`
 * y `horaFin` son los **efectivos**.
 */
export type OcurrenciaDetalle = {
  turnoId: number
  fechaOriginal: string
  fecha: string
  diaSemana: number
  horaInicio: string
  horaFin: string
  tipo: TipoOcurrencia
  estado: EstadoOcurrencia
  alumno: Persona & { dni: string }
  profesor: Persona
  materia: Referencia
  aula: Referencia
  observaciones: string | null
  temas: string | null
  serie: {
    fechaInicio: string
    /** `null` en un recurrente sin fin. */
    fechaFin: string | null
    /** Fecha original de cada ocurrencia de la serie que se movió (HU-20). */
    fechasReprogramadas: string[]
    finalizacion: {
      fechaDesde: string
      motivo: MotivoCancelacion
      detalle: string | null
      registro: Registro
    } | null
  }
  pago: PagoOcurrencia
  cancelacion: { motivo: MotivoCancelacion; detalle: string | null; registro: Registro } | null
  reprogramacion: {
    desdeFecha: string
    desdeHoraInicio: string
    desdeHoraFin: string
    desdeProfesor: Persona
    registro: Registro
  } | null
  prioridad: PrioridadOcurrencia | null
  /** El examen que determina la prioridad, si lo hay. */
  examen: { id: number; fecha: string; materiaNombre: string; dias: number } | null
  acciones: AccionesOcurrencia
} & Auditoria

/**
 * Una ocurrencia en la lista de turnos de un alumno (`GET /ocurrencias?alumnoId`). Es lo que
 * reciben las acciones sobre varias a la vez (cancelar varios, registrar un pago).
 */
export type OcurrenciaDeAlumno = {
  turnoId: number
  fechaOriginal: string
  fecha: string
  horaInicio: string
  horaFin: string
  estado: EstadoOcurrencia
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
  /** Fecha **original** de la ocurrencia. */
  fecha: string
  onCerrar: () => void
}

export type RenderDetalleOcurrencia = (solicitud: SolicitudDetalleOcurrencia) => ReactNode
