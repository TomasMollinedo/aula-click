import type { PaginatedResponse } from '@/types'

export type NivelEscolaridad = 'INICIAL' | 'PRIMARIO' | 'SECUNDARIO' | 'TERCIARIO' | 'UNIVERSITARIO'

export const NIVEL_ESCOLARIDAD_LABEL: Record<NivelEscolaridad, string> = {
  INICIAL: 'Inicial',
  PRIMARIO: 'Primario',
  SECUNDARIO: 'Secundario',
  TERCIARIO: 'Terciario',
  UNIVERSITARIO: 'Universitario',
}

export type UsuarioAuditoria = {
  id: string
  nombre: string
  apellido: string
}

export type AlumnoListadoItem = {
  id: number
  apellido: string
  nombre: string
  dni: string
}

export type AlumnoDetalle = {
  id: number
  nombre: string
  apellido: string
  dni: string
  fechaNacimiento: string
  email: string
  telefono: string
  nivelEscolaridad: NivelEscolaridad | null
  grado: string | null
  institucionEducativa: string | null
  observaciones: string | null
  tutorNombre: string | null
  tutorApellido: string | null
  tutorDni: string | null
  tutorTelefono: string | null
  tutorEmail: string | null
  estado: 'ACTIVO' | 'INACTIVO'
  menorDeEdad: boolean
  createdAt: string
  updatedAt: string
  createdBy: UsuarioAuditoria | null
  updatedBy: UsuarioAuditoria | null
}

export type AlumnoCrear = {
  nombre: string
  apellido: string
  dni: string
  fechaNacimiento: string
  email: string
  telefono: string
  nivelEscolaridad?: NivelEscolaridad | null
  grado?: string | null
  institucionEducativa?: string | null
  observaciones?: string | null
  tutorNombre?: string | null
  tutorApellido?: string | null
  tutorDni?: string | null
  tutorTelefono?: string | null
  tutorEmail?: string | null
}

export type AlumnoEditar = Partial<AlumnoCrear>

export type ListarAlumnosParams = {
  page?: number
  pageSize?: number
  q?: string
}

export type AlumnosListadoResponse = PaginatedResponse<AlumnoListadoItem>
