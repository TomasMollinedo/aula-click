import type { PeriodoTablero } from '../tablero.types'

export const tableroKeys = {
  all: ['tablero'] as const,
  periodo: ({ desde, hasta }: PeriodoTablero) => [...tableroKeys.all, { desde, hasta }] as const,
}
