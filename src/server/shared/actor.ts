import { ForbiddenError } from '@/server/errors'

// Valores del campo `role` (fuente: docs/contrato-api.md → Roles). Un cambio se hace en el mismo PR
// en el seed (catálogo `rol`), en este archivo y en src/types/index.ts (el frontend no importa este).
export const ROLES = ['MESA_ENTRADAS', 'PROFESOR', 'GERENTE', 'ALUMNO'] as const

/** Uno de los valores de `ROLES`. */
export type Role = (typeof ROLES)[number]

/**
 * Quién hace la operación: lo deja `requireAuth()` en el contexto y lo recibe cada service.
 * `alumnoId` solo lo tiene el rol ALUMNO: es el alumno de su cuenta (`Usuario.alumnoId`).
 */
export type Actor = { userId: string; role: Role; alumnoId?: number }

/**
 * Indica si un valor cualquiera (por ejemplo el `user.role` de Better Auth, que puede ser
 * `null`, `undefined` o un texto arbitrario) es uno de `ROLES`. Distingue mayúsculas.
 */
export function esRole(valor: unknown): valor is Role {
  return ROLES.some((rol) => rol === valor)
}

/**
 * El alumno de la sesión, para los endpoints del portal (`mis-…` / `mi-…`), que nunca reciben un
 * `alumnoId`. Responde 403 SIN_PERMISO si el actor no tiene alumno: un usuario de otro rol o una
 * cuenta ALUMNO mal formada (`requireAuth()` ya rechaza esta última).
 */
export function alumnoDeLaSesion(actor: Actor): number {
  if (actor.alumnoId === undefined) {
    throw new ForbiddenError('No tenés permiso para esta operación')
  }
  return actor.alumnoId
}
