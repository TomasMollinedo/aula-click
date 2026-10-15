import type { Auditoria, PaginatedResponse, UsuarioAuditoria } from '@/types'

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
  /** URL prefirmada (vive 15 min) o null si no tiene foto. No se guarda fuera de la query. */
  fotoUrl: string | null
}

export type AlumnoDetalle = {
  id: number
  nombre: string
  apellido: string
  dni: string
  fechaNacimiento: string
  email: string | null
  telefono: string | null
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
  /** URL prefirmada (vive 15 min) o null si no tiene foto. No se guarda fuera de la query. */
  fotoUrl: string | null
  /** Acceso al portal (HU-27), o `null` si todavía no lo tiene. */
  acceso: AccesoPortal | null
} & Auditoria

/** El acceso al portal de un alumno (HU-27). La contraseña nunca viaja. */
export type AccesoPortal = {
  usuario: string
  creadoPor: UsuarioAuditoria | null
  /** Instante ISO 8601 en UTC. */
  creadoEl: string
  /** Quién restableció la contraseña por última vez, o `null` si nunca se restableció. */
  restablecidaPor: UsuarioAuditoria | null
  restablecidaEl: string | null
}

export type AlumnoCrear = {
  nombre: string
  apellido: string
  dni: string
  fechaNacimiento: string
  email?: string | null
  telefono?: string | null
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
