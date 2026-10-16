import type { ParamsAsistencia, ParamsFinanzas, PeriodoTablero } from '../tablero.types'

export const tableroKeys = {
  all: ['tablero'] as const,
  periodo: ({ desde, hasta }: PeriodoTablero) => [...tableroKeys.all, { desde, hasta }] as const,
  /**
   * La sección "Asistencia" de un período con el estado de sus dos tablas: cuelga de `all`, así
   * que invalidar el tablero invalida las dos secciones, y volver a la misma vista (la misma
   * página, el mismo orden y el mismo filtro) no vuelve a pedir nada.
   */
  asistencia: (params: ParamsAsistencia) => [...tableroKeys.all, 'asistencia', params] as const,
  /** La sección "Finanzas" de un período con el estado de su tabla, igual que "Asistencia". */
  finanzas: (params: ParamsFinanzas) => [...tableroKeys.all, 'finanzas', params] as const,
}
