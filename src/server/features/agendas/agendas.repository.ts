import { prisma } from '@/lib/prisma'
import {
  leerPrioridades,
  type PedidoPrioridad,
  type PrioridadDeTurno,
} from '@/server/features/examenes/examenes.condiciones'
import {
  leerOcurrencias,
  type FiltroOcurrencias,
  type Ocurrencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Reloj } from '@/server/shared/fechas'

// Único lugar de la feature que usa Prisma. Las agendas no tienen tablas propias: leen ocurrencias
// con el motor que publica `turnos` (`ocurrencias.condiciones.ts`, T-30) y la prioridad con la que
// publica `examenes` (`examenes.condiciones.ts`, T-31), nunca con una expansión ni un cálculo
// propios. Sin reglas de negocio: qué mostrar lo decide el service.

export type { Ocurrencia, PrioridadDeTurno }

export const agendasRepository = {
  /**
   * Ocurrencias de un rango (incluidas las canceladas, con su estado y su pago), ordenadas por
   * fecha, hora e id del turno. `reloj` decide `SIN_REGISTRAR`.
   */
  async leerOcurrencias(filtro: FiltroOcurrencias, reloj?: Reloj): Promise<Ocurrencia[]> {
    return leerOcurrencias(prisma, filtro, reloj)
  },

  /** Prioridad (y el examen que la determina) de un lote de ocurrencias, en una sola consulta. */
  async leerPrioridades(items: PedidoPrioridad[]): Promise<Map<string, PrioridadDeTurno>> {
    return leerPrioridades(prisma, items)
  },
}

export type AgendasRepository = typeof agendasRepository
