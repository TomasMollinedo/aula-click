import type { ReactNode } from 'react'

import type { Auditoria, Role, UsuarioAuditoria } from './index'

// Tipos compartidos de la ocurrencia de un turno. Viven acá y no en una feature porque los usan
// varias (`ocurrencias`, `cancelaciones`, `finalizaciones`, `pagos`, `cuentas`, `documentos`,
// `turnos`, `asistencias`) y ninguna puede importar los types de otra (docs/arquitectura-frontend.md).
//
// Siguen el contrato real de T-84 (docs/contrato-api.md → Ocurrencias): el detalle del personal
// (`GET /ocurrencias/{turnoId}/{fecha}`), con el `pago`, el `plazoAsistencia`, la `asistencia` de esa
// hora y sus `horasSeguidas`; la lista de turnos del alumno (`GET /ocurrencias?alumnoId`), con el
// `estadoPago` y el `plazoAsistencia`; y los del portal (`GET /ocurrencias/mis-turnos` y su
// detalle), derivados de los del personal para que no diverjan. **Sin
// `reprogramacion`/`fechaOriginal`**: reprogramar cambia el turno a su fecha y bloque nuevos (una
// sesión única nueva si era una ocurrencia de un recurrente), así que `turnoId` + `fecha` ya
// identifican la ocurrencia tal cual está ahora; no se guarda desde dónde se movió (definición A de
// las PO). Fechas: string `YYYY-MM-DD`. Horas: string `HH:mm`. Instantes: ISO 8601 en UTC.
// Importes: número JSON en pesos, que calcula la API.

export type TipoOcurrencia = 'RECURRENTE' | 'SESION_UNICA'

/**
 * Lo calcula la API. La UI lo muestra como "Agendado", "Cancelado", "Sin registrar", "Realizado" y
 * "Ausente" (los dos últimos salen de la asistencia registrada, HU-22).
 */
export type EstadoOcurrencia = 'AGENDADO' | 'CANCELADO' | 'SIN_REGISTRAR' | 'REALIZADO' | 'AUSENTE'

/** Estado de pago de una ocurrencia: el de las agendas, la lista de turnos del alumno y el detalle. */
export type EstadoPagoOcurrencia = 'PENDIENTE' | 'PAGADO'

/**
 * Plazo para registrar o corregir la asistencia, tal cual lo manda la API: su último día (hasta las
 * 23:59) y si ya pasó; `null` en una cancelada o posterior a hoy. Misma forma que `PlazoAsistencia`
 * de `components/turno/indicadores-turno.ts`, que `types/` no puede importar.
 */
export type PlazoAsistenciaOcurrencia = { vence: string; vencido: boolean }

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
  /**
   * Sólo para el profesor del turno y con el plazo abierto, también con la asistencia ya registrada
   * (corregir es volver a guardar). Se guarda con `PUT /asistencias`.
   */
  registrarAsistencia: { visible: boolean }
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

/** El registro del profesor: "Presente" o "Ausente". */
export type EstadoAsistencia = 'PRESENTE' | 'AUSENTE'

/**
 * La asistencia de **esa hora** en el detalle. Si no es `null`, tiene una de dos formas:
 * - Registrada (`REALIZADO` o `AUSENTE`): con quién y cuándo la registró y la modificó. Un ausente
 *   trae `observacion` y no trae textos.
 * - Cerrada por el sistema (`SIN_REGISTRAR` con el plazo vencido): `cerradaPorSistema: true`, la
 *   `observacion` del cierre y el resto en `null` (la fecha del cierre es `plazoAsistencia.vence`).
 */
export type AsistenciaDeOcurrencia = {
  estado: EstadoAsistencia | null
  /** "Qué se trabajó". */
  trabajado: string | null
  /** "Indicaciones para la próxima sesión". */
  indicaciones: string | null
  /** La del ausente, o la del cierre del sistema. */
  observacion: string | null
  registradaPor: UsuarioAuditoria | null
  registradaEl: string | null
  modificadaPor: UsuarioAuditoria | null
  modificadaEl: string | null
  cerradaPorSistema: boolean
}

/** "Qué se trabajó" e indicaciones de una hora presente. */
export type TextosAsistencia = { trabajado: string | null; indicaciones: string | null }

/** Una hora de unas horas seguidas, con su propio estado y su plazo. */
export type HoraSeguida = {
  turnoId: number
  fecha: string
  horaInicio: string
  horaFin: string
  estado: EstadoOcurrencia
  plazoAsistencia: PlazoAsistenciaOcurrencia | null
  /** Es la hora del detalle abierto. */
  actual: boolean
  /** Quien mira puede registrarla y no tiene asistencia ni venció: las de "Aplicar también a…". */
  registrable: boolean
  /** Los de esta hora si es presente y difieren de `textos` del grupo; si no, `null`. */
  textosPropios: TextosAsistencia | null
  /** La de la asistencia si la hora es `AUSENTE`; si no, `null`. */
  observacion: string | null
}

/**
 * Las horas seguidas de la ocurrencia: mismo alumno, profesor, materia y fecha, una a continuación
 * de la otra. Qué textos van una sola vez (`textos`) y cuáles aparte (`textosPropios`) lo decide la
 * API: la UI no compara textos.
 */
export type HorasSeguidas = {
  /** La de la primera hora. */
  horaInicio: string
  /** La de la última hora. */
  horaFin: string
  horas: number
  /** Los de la primera hora presente, que se muestran una sola vez; `null` si ninguna lo está. */
  textos: TextosAsistencia | null
  /** Todas las horas del grupo, en orden. */
  ocurrencias: HoraSeguida[]
}

/** Quien creó el turno, con su rol: `ALUMNO` si lo sacó el alumno desde el portal (HU-29). */
export type UsuarioAuditoriaConRol = UsuarioAuditoria & { rol: Role }

/**
 * Detalle de una ocurrencia: un turno en una fecha. La identifican `turnoId` + `fecha` (definición
 * B); si se reprogramó, son los nuevos. Es el de **esa hora**: su estado, su asistencia y su
 * auditoría, aunque tenga horas seguidas.
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
  plazoAsistencia: PlazoAsistenciaOcurrencia | null
  /** `null` si está agendada, cancelada o sin registrar dentro del plazo. */
  asistencia: AsistenciaDeOcurrencia | null
  /** `null` si la hora no tiene horas seguidas o está cancelada. */
  horasSeguidas: HorasSeguidas | null
  acciones: AccionesOcurrencia
} & Omit<Auditoria, 'createdBy'> & { createdBy: UsuarioAuditoriaConRol | null }

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
  /** El mismo del detalle. Es una lista: la asistencia y las horas seguidas se ven en el detalle. */
  plazoAsistencia: PlazoAsistenciaOcurrencia | null
}

/**
 * Una ocurrencia del alumno de la sesión en "Mi calendario" (`GET /ocurrencias/mis-turnos`),
 * incluidas las canceladas. Suma el aula; sin prioridad, `cancelable`, plazo ni auditoría.
 */
export type OcurrenciaDelPortal = Pick<
  OcurrenciaDeAlumno,
  | 'turnoId'
  | 'fecha'
  | 'diaSemana'
  | 'horaInicio'
  | 'horaFin'
  | 'tipo'
  | 'estado'
  | 'estadoPago'
  | 'profesor'
  | 'materia'
> &
  Pick<OcurrenciaDetalle, 'aula'>

/** La asistencia de esa hora para el alumno: las mismas formas, sin auditoría ni observación. */
export type AsistenciaDelPortal = Pick<
  AsistenciaDeOcurrencia,
  'estado' | 'trabajado' | 'indicaciones' | 'cerradaPorSistema'
>

/** Las horas seguidas para el alumno: los mismos textos, sin `registrable` ni `observacion`. */
export type HorasSeguidasDelPortal = Omit<HorasSeguidas, 'ocurrencias'> & {
  ocurrencias: Omit<HoraSeguida, 'registrable' | 'observacion'>[]
}

/**
 * El detalle de una ocurrencia del alumno de la sesión
 * (`GET /ocurrencias/mis-turnos/{turnoId}/{fecha}`). Nunca trae prioridad, observaciones del turno,
 * acciones, los datos del pago (solo su estado) ni auditoría.
 */
export type OcurrenciaDetallePortal = Pick<
  OcurrenciaDetalle,
  | 'turnoId'
  | 'fecha'
  | 'horaInicio'
  | 'horaFin'
  | 'materia'
  | 'profesor'
  | 'aula'
  | 'tipo'
  | 'temas'
  | 'estado'
  | 'plazoAsistencia'
> & {
  estadoPago: EstadoPagoOcurrencia
  asistencia: AsistenciaDelPortal | null
  horasSeguidas: HorasSeguidasDelPortal | null
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
