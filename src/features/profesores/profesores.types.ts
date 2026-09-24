import type { PaginatedResponse } from '@/types'

export type Estado = 'ACTIVO' | 'INACTIVO'

export type EstadoFiltro = Estado | 'TODOS'

export type UsuarioAuditoria = {
  id: string
  nombre: string
  apellido: string
}

export type ProfesorListadoItem = {
  id: number
  apellido: string
  nombre: string
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
  createdAt: string
  updatedAt: string
  createdBy: UsuarioAuditoria | null
  updatedBy: UsuarioAuditoria | null
}

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
