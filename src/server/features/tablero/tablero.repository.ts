import { prisma } from '@/lib/prisma'
import { totalAdeudado } from '@/server/features/cuentas/cuentas.condiciones'
import { totalCobradoEntre } from '@/server/features/pagos/pagos.condiciones'
import { leerOcurrencias, type Ocurrencia } from '@/server/features/turnos/ocurrencias.condiciones'
import type { Reloj } from '@/server/shared/fechas'

// Único lugar de la feature que usa Prisma. Sólo lecturas, sin transacción ni locks, y sólo
// agregados: el tablero no tiene tablas propias ni escribe nada. Las ocurrencias salen del motor de
// `turnos`, la deuda de `cuentas.condiciones` y lo cobrado de `pagos.condiciones`: acá no se
// reimplementa ninguna regla. Los importes salen como `number`, nunca como `Prisma.Decimal`.

export type { Ocurrencia }

export const tableroRepository = {
  /**
   * Todas las ocurrencias del período (incluidas las canceladas), sin otros filtros. `reloj` es el
   * del service: decide `SIN_REGISTRAR` con el mismo "hoy" que el resto de la consulta.
   */
  async ocurrenciasDelPeriodo(
    periodo: { desde: string; hasta: string },
    reloj?: Reloj,
  ): Promise<Ocurrencia[]> {
    return leerOcurrencias(prisma, { desde: periodo.desde, hasta: periodo.hasta }, reloj)
  },

  /**
   * Capacidad efectiva de cada bloque pedido, `min(profesor.capacidad, aula.capacidad)`, calculada
   * al leer (T-27, como `agendas`), en una consulta. Sin bloques, sin consulta.
   */
  async capacidadesDeBloques(bloqueAgendaIds: readonly number[]): Promise<Map<number, number>> {
    const ids = [...new Set(bloqueAgendaIds)]
    if (ids.length === 0) return new Map()
    const bloques = await prisma.bloqueAgenda.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        profesor: { select: { capacidad: true } },
        aula: { select: { capacidad: true } },
      },
    })
    return new Map(
      bloques.map((bloque) => [
        bloque.id,
        Math.min(bloque.profesor.capacidad, bloque.aula.capacidad),
      ]),
    )
  },

  /**
   * Cuántos alumnos se dieron de alta en `[desde, hasta)` (instantes): todos, cualquiera sea su
   * estado actual.
   */
  async contarAlumnosNuevos(desde: Date, hasta: Date): Promise<number> {
    return prisma.alumno.count({ where: { createdAt: { gte: desde, lt: hasta } } })
  },

  /** Suma de los pagos `VIGENTE` con `fechaPago` en el período (extremos incluidos). */
  async totalCobrado(periodo: { desde: string; hasta: string }): Promise<number> {
    return totalCobradoEntre(prisma, periodo)
  },

  /** Total adeudado a `hoy`, de todos los alumnos y sin período: la deuda de `cuentas`. */
  async totalAdeudado(filtro: { hoy: string }): Promise<number> {
    return totalAdeudado(prisma, filtro)
  },
}

export type TableroRepository = typeof tableroRepository
