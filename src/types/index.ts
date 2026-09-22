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
