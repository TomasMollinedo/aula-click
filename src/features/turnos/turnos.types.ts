import type { PaginatedResponse } from '@/types'

export type EstadoTurno = 'ACTIVO' | 'CANCELADO'

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
  /** Vista personal de la agenda de ese profesor ese día (decisión T-41). */
  profesorId?: number
}

export type AgendaListadoResponse = PaginatedResponse<AgendaItem>
