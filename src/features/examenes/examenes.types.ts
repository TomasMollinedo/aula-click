import type { Role } from '@/types'

// Tipos de la API de exámenes (docs/contrato-api.md → Exámenes; OpenAPI de /api/v1/examenes).

export type TipoExamen = 'PARCIAL' | 'FINAL' | 'RECUPERATORIO' | 'TRABAJO_PRACTICO' | 'OTRO'

export type MateriaExamen = { id: number; nombre: string }

/**
 * Usuario de auditoría de un examen: a diferencia de `UsuarioAuditoria` (`types/index.ts`), trae el
 * rol, para distinguir si lo cargó mesa de entradas o el profesor (HU-17).
 */
export type ExamenUsuarioAuditoria = {
  id: string
  nombre: string
  apellido: string
  role: Role
}

/** Ítem de `GET /examenes?alumnoId`. */
export type ExamenItem = {
  id: number
  materia: MateriaExamen
  /** `YYYY-MM-DD`. */
  fecha: string
  tipo: TipoExamen
  observaciones: string | null
  pasado: boolean
  /** Días de calendario hasta el examen (0 = hoy), calculados por la API. `null` en los pasados. */
  diasRestantes: number | null
  /**
   * Quien consulta puede editarlo y eliminarlo, según la API: mesa de entradas, siempre; el
   * profesor, si le dicta esa materia al alumno.
   */
  administrable: boolean
  /** Instante ISO 8601 en UTC. */
  createdAt: string
  /** Instante ISO 8601 en UTC. */
  updatedAt: string
  createdBy: ExamenUsuarioAuditoria | null
  updatedBy: ExamenUsuarioAuditoria | null
}

export type ExamenesListado = {
  /** De hoy en adelante, por fecha ascendente. */
  proximos: ExamenItem[]
  pasados: ExamenItem[]
}

/** Lo que devuelven el alta, la edición y la baja. */
export type ExamenDetalle = Omit<ExamenItem, 'diasRestantes' | 'administrable'> & {
  alumnoId: number
}

export type ExamenCrear = {
  alumnoId: number
  materiaId: number
  fecha: string
  tipo: TipoExamen
  observaciones?: string
}

/** Edición parcial: lo omitido no cambia. `observaciones: ''` las borra. */
export type ExamenEditar = Partial<Omit<ExamenCrear, 'alumnoId'>>

/** El existente de un 409 `EXAMEN_PENDIENTE` (`details`). */
export type ExamenPendiente = { id: number; tipo: TipoExamen; fecha: string }
