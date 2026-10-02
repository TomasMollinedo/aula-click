import { prisma } from '@/lib/prisma'
import {
  leerPrioridades,
  type PedidoPrioridad,
  type PrioridadDeTurno,
} from '@/server/features/examenes/examenes.condiciones'
import {
  claveOcupacion,
  leerOcurrencias,
  ocupacionesEn,
  type FiltroOcurrencias,
  type Ocurrencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Reloj } from '@/server/shared/fechas'

// Único lugar de la feature que usa Prisma. Las agendas no tienen tablas propias: leen ocurrencias
// con el motor que publica `turnos` (`ocurrencias.condiciones.ts`, T-30) y la prioridad con la que
// publica `examenes` (`examenes.condiciones.ts`, T-31), nunca con una expansión ni un cálculo
// propios. Sin reglas de negocio: qué mostrar lo decide el service.

export type { Ocurrencia, PrioridadDeTurno }

/** Una clase: una hora de un bloque en una fecha. */
export type ClaseDeAgenda = { bloqueAgendaId: number; fecha: string }

/** Cuánto lugar tiene una clase: cuántos turnos ocupan lugar y la capacidad efectiva de la hora. */
export type Cupo = { ocupados: number; capacidad: number }

export const agendasRepository = {
  /**
   * Ocurrencias de un rango (incluidas las canceladas, con su estado y su pago), ordenadas por
   * fecha, hora e id del turno. `reloj` decide `SIN_REGISTRAR`.
   */
  async leerOcurrencias(filtro: FiltroOcurrencias, reloj?: Reloj): Promise<Ocurrencia[]> {
    return leerOcurrencias(prisma, filtro, reloj)
  },

  /**
   * Cupo de un lote de clases por `claveOcupacion(bloqueAgendaId, fecha)`, con una entrada por cada
   * clase pedida. `ocupados` sale del motor de `turnos` (`ocupacionesEn`: `ACTIVO`, dentro del fin
   * efectivo y no cancelado; una pagada o pasada ocupa lugar igual) y cuenta **todos** los turnos de
   * la clase, no sólo los que pasaron los filtros de la agenda. `capacidad` es
   * `min(profesor.capacidad, aula.capacidad)` del bloque, calculada al leer (T-27).
   */
  async leerCupos(clases: readonly ClaseDeAgenda[]): Promise<Map<string, Cupo>> {
    if (clases.length === 0) return new Map()
    const [bloques, ocupaciones] = await Promise.all([
      prisma.bloqueAgenda.findMany({
        where: { id: { in: [...new Set(clases.map((clase) => clase.bloqueAgendaId))] } },
        select: {
          id: true,
          profesor: { select: { capacidad: true } },
          aula: { select: { capacidad: true } },
        },
      }),
      ocupacionesEn(prisma, clases),
    ])
    const capacidades = new Map(
      bloques.map((bloque) => [
        bloque.id,
        Math.min(bloque.profesor.capacidad, bloque.aula.capacidad),
      ]),
    )
    return new Map(
      clases.map(({ bloqueAgendaId, fecha }) => {
        const clave = claveOcupacion(bloqueAgendaId, fecha)
        return [
          clave,
          {
            ocupados: ocupaciones.get(clave) ?? 0,
            capacidad: capacidades.get(bloqueAgendaId) ?? 0,
          },
        ]
      }),
    )
  },

  /** Prioridad (y el examen que la determina) de un lote de ocurrencias, en una sola consulta. */
  async leerPrioridades(items: PedidoPrioridad[]): Promise<Map<string, PrioridadDeTurno>> {
    return leerPrioridades(prisma, items)
  },
}

export type AgendasRepository = typeof agendasRepository
