export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// Valores del campo `role` de la API (docs/contrato-api.md → Roles; decisión T-17).
// El frontend no puede importar los del backend (src/server/shared/actor.ts):
// si cambian allá, se cambian acá en el mismo PR.
export type Role = 'MESA_ENTRADAS' | 'PROFESOR' | 'GERENTE' | 'ALUMNO'

// Auditoría del detalle de toda entidad (docs/contrato-api.md → Recursos individuales): cuatro
// campos planos, iguales en todas. `createdBy` / `updatedBy` son `null` solo en lo que creó el seed.
export type UsuarioAuditoria = {
  id: string
  nombre: string
  apellido: string
}

export type Auditoria = {
  /** Instante ISO 8601 en UTC. */
  createdAt: string
  /** Instante ISO 8601 en UTC. */
  updatedAt: string
  createdBy: UsuarioAuditoria | null
  updatedBy: UsuarioAuditoria | null
}
