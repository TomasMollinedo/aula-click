// Valores del enum `Estado` de Prisma: la baja lógica de materias, asignaciones de materias,
// bloques y alumnos, y el estado del `Usuario` (que es también el del profesor). Nada se borra.
// shared no importa Prisma: si el enum suma un valor, los repositories que asignan el `estado` de
// Prisma a este tipo dejan de compilar (alumnos.repository además exige que sean idénticos).
export const ESTADOS = ['ACTIVO', 'INACTIVO'] as const

/** Uno de los valores de `ESTADOS`. */
export type Estado = (typeof ESTADOS)[number]
