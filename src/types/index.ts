export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// TODO: confirmar los valores reales con el backend (ver src/lib/auth.ts, decisión abierta).
export type Role = 'mesa_entradas' | 'profesor' | 'gerente' | 'alumno'
