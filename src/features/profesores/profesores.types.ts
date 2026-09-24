import type { Auditoria, PaginatedResponse } from '@/types'

export type Estado = 'ACTIVO' | 'INACTIVO'

export type EstadoFiltro = Estado | 'TODOS'

export type ProfesorListadoItem = {
  id: number
  apellido: string
  nombre: string
  dni: string
  estado: Estado
  fotoUrl: string | null
}

export type ProfesorDetalle = {
  id: number
  nombre: string
  apellido: string
  dni: string
  telefono: string
  email: string
  titulo: string
  matricula: string
  capacidad: number
  estado: Estado
  fotoUrl: string | null
} & Auditoria

export type ProfesorCrear = {
  nombre: string
  apellido: string
  dni: string
  telefono: string
  email: string
  titulo: string
  matricula: string
  capacidad: number
  password: string
}

export type ProfesorEditar = Partial<Omit<ProfesorCrear, 'password'>>

export type ListarProfesoresParams = {
  page?: number
  pageSize?: number
  q?: string
  estado?: EstadoFiltro
  materiaId?: number
}

export type ProfesoresListadoResponse = PaginatedResponse<ProfesorListadoItem>

export type MateriaAsignada = {
  id: number
  nombre: string
}

/** Aula de un bloque, tal como viaja en sus respuestas. */
export type BloqueAula = {
  id: number
  nombre: string
}

/** Una fila del horario: una hora exacta (T-29). Día ISO y horas `HH:mm`. */
export type Bloque = {
  id: number
  diaSemana: number
  horaInicio: string
  horaFin: string
  aula: BloqueAula
}

/**
 * Una fila de `GET /api/v1/bloques?profesorId=`: además de lo de `Bloque`, la capacidad efectiva de
 * esa hora y su ocupación en la próxima fecha de ese día (`proximaFecha`, `YYYY-MM-DD`, hoy
 * incluido). Las calcula la API.
 */
export type BloqueHorario = Bloque & {
  capacidadEfectiva: number
  proximaFecha: string
  ocupacion: number
}

/** Body del alta: un rango de horas en punto crea una fila por hora. */
export type BloqueCrear = {
  profesorId: number
  diaSemana: number
  horaInicio: string
  horaFin: string
  aulaId: number
}

/** Body de la edición de una hora: solo lo que cambia. */
export type BloqueEditar = Partial<Omit<BloqueCrear, 'profesorId'>>

/** Respuesta del alta de un rango y de la baja de varias horas juntas. */
export type BloquesLote = {
  cantidad: number
  bloques: Bloque[]
}

/**
 * Detalle de una hora (`GET /api/v1/bloques/{bloqueId}`): lo del horario más su estado (puede
 * estar dada de baja), el aula con su capacidad, el profesor y la auditoría.
 */
export type BloqueDetalle = Omit<BloqueHorario, 'aula'> & {
  estado: Estado
  aula: BloqueAula & { capacidad: number }
  profesor: { id: number; nombre: string; apellido: string }
} & Auditoria
