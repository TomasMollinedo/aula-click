import type { Auditoria, PaginatedResponse } from '@/types'

export type Estado = 'ACTIVO' | 'INACTIVO'

export type EstadoFiltro = Estado | 'TODOS'

/** Ítem del selector de materias activas (dropdowns de asignaciones, profesores y turnos). */
export type MateriaSelectorItem = {
  id: number
  nombre: string
}

export type MateriaListadoItem = {
  id: number
  nombre: string
  estado: Estado
}

/**
 * Profesor que dicta la materia. Aparece en el detalle y en los `details` del 409
 * `MATERIA_CON_PROFESORES`; `id` es el de `Profesor`, para enlazar a su ficha.
 */
export type MateriaProfesor = {
  id: number
  apellido: string
  nombre: string
  estado: Estado
}

export type MateriaDetalle = {
  id: number
  nombre: string
  descripcion: string | null
  estado: Estado
  /** Profesores con una asignación activa, ordenados por apellido y nombre. */
  profesores: MateriaProfesor[]
} & Auditoria

export type MateriaCrear = {
  nombre: string
  descripcion?: string | null
}

export type ListarMateriasParams = {
  page?: number
  pageSize?: number
  q?: string
  estado?: EstadoFiltro
}

export type MateriasListadoResponse = PaginatedResponse<MateriaListadoItem>
