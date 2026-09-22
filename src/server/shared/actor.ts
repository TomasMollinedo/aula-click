// Valores del campo `role` (fuente: docs/contrato-api.md → Roles). Un cambio se hace en el mismo PR
// en el seed (catálogo `rol`), en este archivo y en src/types/index.ts (el frontend no importa este).
export const ROLES = ['MESA_ENTRADAS', 'PROFESOR', 'GERENTE', 'ALUMNO'] as const

/** Uno de los valores de `ROLES`. */
export type Role = (typeof ROLES)[number]

/** Quién hace la operación: lo deja `requireAuth()` en el contexto y lo recibe cada service. */
export type Actor = { userId: string; role: Role }

/**
 * Indica si un valor cualquiera (por ejemplo el `user.role` de Better Auth, que puede ser
 * `null`, `undefined` o un texto arbitrario) es uno de `ROLES`. Distingue mayúsculas.
 */
export function esRole(valor: unknown): valor is Role {
  return ROLES.some((rol) => rol === valor)
}
