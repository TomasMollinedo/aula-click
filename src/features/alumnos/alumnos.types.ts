import type { Auditoria, PaginatedResponse } from '@/types'

export type NivelEscolaridad = 'INICIAL' | 'PRIMARIO' | 'SECUNDARIO' | 'TERCIARIO' | 'UNIVERSITARIO'

export const NIVEL_ESCOLARIDAD_LABEL: Record<NivelEscolaridad, string> = {
  INICIAL: 'Inicial',
  PRIMARIO: 'Primario',
  SECUNDARIO: 'Secundario',
  TERCIARIO: 'Terciario',
  UNIVERSITARIO: 'Universitario',
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
} & Auditoria

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

/** Materia de un turno vigente del alumno con el profesor. */
export type AlumnoMateria = { id: number; nombre: string }

/** Item de `GET /alumnos/mis-alumnos`: el general más las materias que cursa con ese profesor. */
export type AlumnoDeProfesorItem = AlumnoListadoItem & { materias: AlumnoMateria[] }

export type AlumnosDeProfesorListadoResponse = PaginatedResponse<AlumnoDeProfesorItem>

export type ListarMisAlumnosParams = {
  page?: number
  pageSize?: number
  q?: string
  materiaId?: number
}
