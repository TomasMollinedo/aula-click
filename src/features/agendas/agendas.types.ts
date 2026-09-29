import type { PaginatedResponse } from '@/types'

// Tipos de la API de agendas (`/api/v1/agendas/*`, docs/contrato-api.md → Agendas), escritos a mano
// (D-07). Fechas: string `YYYY-MM-DD`. Horas: string `HH:mm`. Día de la semana: entero ISO
// (1 = lunes). Los campos nuevos del Sprint 2 (estado, pago, prioridad) los suma T-58.

export type TipoTurno = 'RECURRENTE' | 'SESION_UNICA'

/** La UI muestra `ACTIVO` como "Agendado": es el texto de la pantalla, no otro valor. */
export type EstadoTurno = 'ACTIVO' | 'CANCELADO'

type Referencia = { id: number; nombre: string }

/**
 * De dónde salen los turnos de una agenda: el centro entero (mesa de entradas), un profesor
 * (ficha del profesor) o el profesor de la sesión ("Mi agenda"). Lo usa el calendario semanal.
 */
export type OrigenAgenda =
  { tipo: 'centro' } | { tipo: 'profesor'; profesorId: number } | { tipo: 'propia' }

// ---------------------------------------------------------------------------------------------
// Agenda diaria (`GET /agendas/diaria`)
// ---------------------------------------------------------------------------------------------

/** Ítem de `GET /api/v1/agendas/diaria`. */
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
// Agenda propia del profesor (`GET /agendas/propia`) y de un profesor (`GET /agendas/profesor`)
// ---------------------------------------------------------------------------------------------

/**
 * Una **ocurrencia** de un turno en una fecha (docs/contrato-api.md → Agendas): en un recurrente,
 * `turnoId` se repite entre fechas, así que la clave de la fila es `turnoId` + `fecha`. Sin
 * profesor: son todos del profesor de la sesión (o del profesor pedido).
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

/**
 * Agenda de un profesor para mesa de entradas (ficha del profesor, HU-02): mismo rango, con el
 * profesor fijo. La respuesta tiene la forma de la agenda propia (`AgendaPropiaItem[]`).
 */
export type AgendaProfesorParams = AgendaPropiaParams & { profesorId: number }
