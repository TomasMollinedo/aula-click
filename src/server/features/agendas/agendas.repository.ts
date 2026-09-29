import { prisma } from '@/lib/prisma'
import {
  leerOcurrencias,
  type FiltroOcurrencias,
  type Ocurrencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Reloj } from '@/server/shared/fechas'

// Único lugar de la feature que usa Prisma. Las agendas no tienen tablas propias: leen ocurrencias
// con el motor que publica `turnos` (`ocurrencias.condiciones.ts`, T-30), nunca con una expansión
// propia. Sin reglas de negocio: qué mostrar lo decide el service.

export type { Ocurrencia }

export const agendasRepository = {
  /**
   * Ocurrencias de un rango (incluidas las canceladas, con su estado), ordenadas por fecha, hora e
   * id del turno. `reloj` decide `SIN_REGISTRAR`.
   */
  async leerOcurrencias(filtro: FiltroOcurrencias, reloj?: Reloj): Promise<Ocurrencia[]> {
    return leerOcurrencias(prisma, filtro, reloj)
  },
}

export type AgendasRepository = typeof agendasRepository
