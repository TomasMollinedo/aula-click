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
  /**
   * Quien consulta puede cargar o corregir la nota, según la API: el examen ya se rindió (hoy o
   * antes) y es `administrable` (HU-34).
   */
  cargarNota: boolean
} & NotaDeExamen

/** `CON_NOTA` (con `nota`) o `AUSENTE` (sin nota, no cuenta para los promedios). */
export type ResultadoExamen = 'CON_NOTA' | 'AUSENTE'

/** La nota de un examen con su trazabilidad propia (HU-34); todo `null` si no se cargó. */
export type NotaDeExamen = {
  resultado: ResultadoExamen | null
  /** De 1 a 10, con hasta dos decimales. */
  nota: number | null
  notaCreatedAt: string | null
  notaUpdatedAt: string | null
  notaCreatedBy: ExamenUsuarioAuditoria | null
  notaUpdatedBy: ExamenUsuarioAuditoria | null
}

export type ExamenesListado = {
  /** De hoy en adelante, por fecha ascendente. */
  proximos: ExamenItem[]
  pasados: ExamenItem[]
  /** Exámenes ya rendidos (hoy o antes) sin nota cargada. */
  rendidosSinNota: number
}

/** Lo que devuelven el alta, la edición, la baja y la carga de la nota. */
export type ExamenDetalle = Omit<ExamenItem, 'diasRestantes' | 'administrable' | 'cargarNota'> & {
  alumnoId: number
}

/** Body de `PATCH /examenes/{id}/nota`. */
export type NotaCargar = { resultado: 'CON_NOTA'; nota: number } | { resultado: 'AUSENTE' }

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
