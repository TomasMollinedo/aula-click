import type { PaginatedResponse } from '@/types'
import type {
  EstadoOcurrencia,
  EstadoPagoOcurrencia,
  PrioridadOcurrencia,
  TipoOcurrencia,
} from '@/types/ocurrencia'

// Tipos de la API de agendas (`/api/v1/agendas/*`, docs/contrato-api.md → Agendas), escritos a mano
// (D-07). Fechas: string `YYYY-MM-DD`. Horas: string `HH:mm`. Día de la semana: entero ISO
// (1 = lunes).

type Referencia = { id: number; nombre: string }
type Persona = { id: number; apellido: string; nombre: string }

/**
 * Una **ocurrencia** de un turno en una fecha, tal como la devuelven las cuatro agendas (T-57,
 * docs/contrato-api.md → La ocurrencia de una agenda): en un recurrente `turnoId` se repite entre
 * fechas, así que la identidad es `turnoId` + `fecha` y es lo que abre el detalle. `estado`,
 * `estadoPago` y `prioridad` los calcula la API; las canceladas vienen sin prioridad ni examen.
 */
export type AgendaOcurrencia = {
  turnoId: number
  fecha: string
  /** Con `fecha`, identifica la clase: lo usa el calendario para agrupar. */
  bloqueAgendaId: number
  diaSemana: number
  horaInicio: string
  horaFin: string
  alumno: Persona
  materia: Referencia
  aula: Referencia
  tipo: TipoOcurrencia
  estado: EstadoOcurrencia
  estadoPago: EstadoPagoOcurrencia
  prioridad: PrioridadOcurrencia | null
  /** El examen que determina la prioridad, si lo hay. */
  examen: { id: number; fecha: string; tipo: string; materiaNombre: string; dias: number } | null
  /** El cupo de la clase (`fecha` + `bloqueAgendaId`): el mismo para todas sus ocurrencias. */
  cupo: CupoClase
}

/**
 * Cuánto lugar tiene una clase, como lo calcula la API: `capacidad` es la efectiva de la hora y
 * `ocupados` cuenta todos los turnos que ocupan lugar (los cancelados no), también los que un filtro
 * deja afuera.
 */
export type CupoClase = { ocupados: number; capacidad: number }

/**
 * Filtros de cancelados y prioridad que aceptan las cuatro agendas (combinables con los demás). Sin
 * `incluirCancelados`, la API trae solo las agendadas y las sin registrar.
 */
export type FiltrosEstadoPrioridadParams = {
  incluirCancelados?: boolean
  prioridad?: PrioridadOcurrencia
}

/**
 * De dónde salen los turnos de una agenda: el centro entero (mesa de entradas), un profesor
 * (ficha del profesor) o el profesor de la sesión ("Mi agenda"). Lo usa el calendario semanal.
 */
export type OrigenAgenda =
  { tipo: 'centro' } | { tipo: 'profesor'; profesorId: number } | { tipo: 'propia' }

// ---------------------------------------------------------------------------------------------
// Calendario semanal (`GET /agendas/centro`, `/agendas/profesor` y `/agendas/propia`)
// ---------------------------------------------------------------------------------------------

/**
 * Ocurrencia que muestra el calendario: la del centro trae el `profesor` de su bloque; las de un
 * profesor ("Mi agenda" y la ficha) no, porque son todas del mismo.
 */
export type CalendarioItem = AgendaOcurrencia & { profesor?: Persona }

/** Rango pedido a `GET /agendas/centro` (obligatorio, hasta 31 días) con sus filtros. */
export type AgendaCentroParams = FiltrosEstadoPrioridadParams & {
  desde: string
  hasta: string
  profesorId?: number
}

/**
 * Lo que identifica un pedido del calendario: de dónde salen los turnos, la semana y los filtros que
 * viajan a la API. `profesorId` solo lo usa el centro; en las otras dos el profesor ya está fijo.
 */
export type CalendarioParams = FiltrosEstadoPrioridadParams & {
  origen: OrigenAgenda
  desde: string
  hasta: string
  profesorId?: number
}

// ---------------------------------------------------------------------------------------------
// Agenda diaria (`GET /agendas/diaria`)
// ---------------------------------------------------------------------------------------------

/** Ítem de `GET /api/v1/agendas/diaria`: la ocurrencia con el profesor del bloque. */
export type AgendaItem = AgendaOcurrencia & { profesor: Persona }

export type AgendaListadoParams = FiltrosEstadoPrioridadParams & {
  /** `YYYY-MM-DD`. Sin ella, la API usa la fecha de hoy (zona del negocio). */
  fecha?: string
  page?: number
  pageSize?: number
  /** Vista personal de la agenda de ese profesor ese día (decisión T-42). */
  profesorId?: number
}

export type AgendaListadoResponse = PaginatedResponse<AgendaItem>

// ---------------------------------------------------------------------------------------------
// Agenda propia del profesor (`GET /agendas/propia`) y de un profesor (`GET /agendas/profesor`)
// ---------------------------------------------------------------------------------------------

/**
 * Ítem de `GET /agendas/propia` y de `GET /agendas/profesor`: la ocurrencia sin profesor, porque
 * son todos del profesor de la sesión (o del profesor pedido).
 */
export type AgendaPropiaItem = AgendaOcurrencia

/** Rango pedido, extremos incluidos. Sin `desde`, la API usa hoy; sin `hasta`, el mismo `desde`. */
export type AgendaPropiaParams = FiltrosEstadoPrioridadParams & {
  desde?: string
  hasta?: string
}

/**
 * Agenda de un profesor para mesa de entradas (ficha del profesor, HU-02): mismo rango, con el
 * profesor fijo. La respuesta tiene la forma de la agenda propia (`AgendaPropiaItem[]`).
 */
export type AgendaProfesorParams = AgendaPropiaParams & { profesorId: number }
