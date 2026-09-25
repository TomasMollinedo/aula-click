import type { Auditoria, PaginatedResponse } from '@/types'

// Tipos de la API de turnos (docs/contrato-api.md → Turnos y Errores), escritos a mano (D-07).
// Fechas: string `YYYY-MM-DD`. Horas: string `HH:mm`. Día de la semana: entero ISO (1 = lunes).

export type TipoTurno = 'RECURRENTE' | 'SESION_UNICA'

/** La UI muestra `ACTIVO` como "Agendado": es el texto de la pantalla, no otro valor. */
export type EstadoTurno = 'ACTIVO' | 'CANCELADO'

export const TIPO_TURNO_LABEL: Record<TipoTurno, string> = {
  RECURRENTE: 'Recurrente',
  SESION_UNICA: 'Sesión única',
}

/** `ACTIVO` se muestra como "Agendado": es el texto de la pantalla, no un valor nuevo del enum. */
export const ESTADO_TURNO_LABEL: Record<EstadoTurno, string> = {
  ACTIVO: 'Agendado',
  CANCELADO: 'Cancelado',
}

type PersonaResumen = { id: number; nombre: string; apellido: string }
type Referencia = { id: number; nombre: string }

// ---------------------------------------------------------------------------------------------
// Disponibilidad (`GET /turnos/disponibilidad`)
// ---------------------------------------------------------------------------------------------

export type DisponibilidadParams = {
  materiaId: number
  diaSemana?: number
  profesorId?: number
  fecha?: string
}

/** Una hora (una fila del horario) de un resultado, con su ocupación en `fecha`. */
export type HoraDisponible = {
  bloqueId: number
  horaInicio: string
  horaFin: string
  capacidadEfectiva: number
  ocupacion: number
  lleno: boolean
}

/** Horas contiguas del mismo profesor, día y aula: el "bloque" que muestra la UI. */
export type BloqueDisponible = {
  profesor: PersonaResumen
  diaSemana: number
  /** La fecha de la ocupación: la pedida o la próxima ocurrencia del día. */
  fecha: string
  aula: Referencia
  horaInicio: string
  horaFin: string
  horas: HoraDisponible[]
}

// ---------------------------------------------------------------------------------------------
// Alta (`POST /turnos`)
// ---------------------------------------------------------------------------------------------

export type TurnoCrear = {
  alumnoId: number
  materiaId: number
  bloqueIds: number[]
  tipo: TipoTurno
  fechaInicio: string
  /** `RECURRENTE`: última fecha, o `null` si no tiene fin. `SESION_UNICA`: no se manda. */
  fechaFin?: string | null
  motivoConsulta?: string
  asignarDondeHayLugar?: boolean
}

/** Detalle de un turno: una hora y un rango de fechas (`GET /turnos/{turnoId}`). */
export type TurnoDetalle = {
  id: number
  tipo: TipoTurno
  estado: EstadoTurno
  fechaInicio: string
  /** `null` en un recurrente sin fin. */
  fechaFin: string | null
  diaSemana: number
  horaInicio: string
  horaFin: string
  bloqueId: number
  alumno: PersonaResumen & { dni: string }
  profesor: PersonaResumen
  materia: Referencia
  aula: Referencia
  motivoConsulta: string | null
} & Auditoria

/** Fechas en las que una hora pedida no tenía lugar y quedó sin turno. */
export type FechasSinTurno = {
  bloqueId: number
  horaInicio: string
  horaFin: string
  fechas: string[]
  /** Desde esta fecha todas las siguientes están completas, o `null`. */
  completoDesde: string | null
}

/** Respuesta del alta: un turno por hora y tramo, y las fechas salteadas. */
export type TurnosAlta = {
  cantidad: number
  turnos: TurnoDetalle[]
  fechasSinTurno: FechasSinTurno[]
}

// ---------------------------------------------------------------------------------------------
// `details` de los 409 del alta
// ---------------------------------------------------------------------------------------------

/** Una entrada de `details` de `BLOQUE_LLENO`: una por hora con problema. */
export type DetalleBloqueLleno = {
  path: (string | number)[]
  /** Texto de la HU, listo para mostrar ("La hora de 9:00 a 10:00 está completa el lunes 26/10"). */
  message: string
  bloqueId: number
  horaInicio: string
  horaFin: string
  capacidadEfectiva: number
  fechas: string[]
  completoDesde: string | null
  /** La hora no tiene lugar en ninguna de las fechas pedidas: no se puede asignar igual. */
  sinLugar: boolean
}

/** Una entrada de `details` de `ALUMNO_SUPERPUESTO`: un turno del alumno en conflicto. */
export type DetalleAlumnoSuperpuesto = {
  turnoId: number
  tipo: TipoTurno
  fechaInicio: string
  fechaFin: string | null
  diaSemana: number
  horaInicio: string
  horaFin: string
  profesor: PersonaResumen
  materia: Referencia
}

// ---------------------------------------------------------------------------------------------
// Pantalla (registrar turno)
// ---------------------------------------------------------------------------------------------

/** El alumno elegido en la pantalla (sale del buscador o de `?alumnoId=`, vía hooks de alumnos). */
export type AlumnoElegido = { id: number; nombre: string; apellido: string; dni: string }

// ---------------------------------------------------------------------------------------------
// Agenda diaria (`GET /turnos/agenda`)
// ---------------------------------------------------------------------------------------------

/** Ítem de `GET /api/v1/turnos/agenda` (docs/contrato-api.md → Turnos). */
export type AgendaItem = {
  id: number
  alumno: { id: number; apellido: string; nombre: string }
  profesor: { id: number; apellido: string; nombre: string }
  materia: { id: number; nombre: string }
  aula: { id: number; nombre: string }
  horaInicio: string
  horaFin: string
  estado: EstadoTurno
}

export type AgendaListadoParams = {
  /** `YYYY-MM-DD`. Sin ella, la API usa la fecha de hoy (zona del negocio). */
  fecha?: string
  page?: number
  pageSize?: number
  /** Vista personal de la agenda de ese profesor ese día (decisión T-42). */
  profesorId?: number
}

export type AgendaListadoResponse = PaginatedResponse<AgendaItem>

// ---------------------------------------------------------------------------------------------
// Agenda propia del profesor (`GET /turnos/agenda-propia`)
// ---------------------------------------------------------------------------------------------

/**
 * Una **ocurrencia** de un turno propio en una fecha (docs/contrato-api.md → Agenda propia del
 * profesor): en un recurrente, `turnoId` se repite entre fechas, así que la clave de la fila es
 * `turnoId` + `fecha`. Sin profesor: son todos del profesor de la sesión.
 */
export type AgendaPropiaItem = {
  turnoId: number
  fecha: string
  diaSemana: number
  horaInicio: string
  horaFin: string
  alumno: { id: number; apellido: string; nombre: string }
  materia: Referencia
  aula: Referencia
  tipo: TipoTurno
  estado: EstadoTurno
}

/** Rango pedido, extremos incluidos. Sin `desde`, la API usa hoy; sin `hasta`, el mismo `desde`. */
export type AgendaPropiaParams = {
  desde?: string
  hasta?: string
}
