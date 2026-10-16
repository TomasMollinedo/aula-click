import { prisma } from '@/lib/prisma'
import { totalAdeudado } from '@/server/features/cuentas/cuentas.condiciones'
import {
  cobrosConReparto,
  saldoAPagarPorProfesor,
  type CobroConReparto,
} from '@/server/features/liquidaciones/liquidaciones.condiciones'
import {
  totalCobradoEntre,
  totalCobradoPorForma,
  type TotalesPorForma,
} from '@/server/features/pagos/pagos.condiciones'
import { leerOcurrencias, type Ocurrencia } from '@/server/features/turnos/ocurrencias.condiciones'
import { dateAFecha, fechaADate, type Reloj } from '@/server/shared/fechas'
import type { LiquidacionPagada, SaldoDeProfesor } from './tablero.reglas'

// Único lugar de la feature que usa Prisma. Sólo lecturas, sin transacción ni locks, y sólo
// agregados: el tablero no tiene tablas propias ni escribe nada. Las ocurrencias salen del motor de
// `turnos`, la deuda de `cuentas.condiciones` y lo cobrado de `pagos.condiciones`: acá no se
// reimplementa ninguna regla. Los importes salen como `number`, nunca como `Prisma.Decimal`. Lo de
// "Finanzas" (T-128): el reparto de los cobros y el saldo de los profesores salen del motor de
// `liquidaciones.condiciones`, y lo pagado a los profesores se lee de los importes guardados de las
// liquidaciones pagadas (decisión T-156): no se recalcula nada.

export type { CobroConReparto, LiquidacionPagada, Ocurrencia, SaldoDeProfesor, TotalesPorForma }

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

  /**
   * Lo cobrado en el período por forma de pago (`EFECTIVO`, `TRANSFERENCIA`, `DEBITO`), con el mismo
   * filtro que `totalCobrado`: sólo pagos `VIGENTE`, así que las tres suman ese total.
   */
  async totalCobradoPorForma(periodo: { desde: string; hasta: string }): Promise<TotalesPorForma> {
    return totalCobradoPorForma(prisma, periodo)
  },

  /** Total adeudado a `hoy`, de todos los alumnos y sin período: la deuda de `cuentas`. */
  async totalAdeudado(filtro: { hoy: string }): Promise<number> {
    return totalAdeudado(prisma, filtro)
  },

  /**
   * Los cobros de turnos (`PagoTurno` vigentes) con `fechaPago` en `[desde, hasta]`, con su reparto
   * al porcentaje del cobro, el profesor del bloque y si quedaron cerrados sin registrar a `hoy`.
   */
  async cobrosConReparto(filtro: {
    desde: string
    hasta: string
    hoy: string
  }): Promise<CobroConReparto[]> {
    return cobrosConReparto(prisma, filtro)
  },

  /** Lo que se le debe a `hoy` a cada profesor con alguna liquidación abierta; puede ser negativo. */
  async saldosDeProfesores(filtro: { hoy: string }): Promise<SaldoDeProfesor[]> {
    return saldoAPagarPorProfesor(prisma, filtro)
  },

  /**
   * Las liquidaciones `PAGADA` con `fechaTransferencia` en `[desde, hasta]` (extremos incluidos),
   * con su `total` guardado. Las `DESCONTADA` no son transferencias y no entran.
   */
  async liquidacionesPagadas(periodo: {
    desde: string
    hasta: string
  }): Promise<LiquidacionPagada[]> {
    const filas = await prisma.liquidacion.findMany({
      where: {
        estado: 'PAGADA',
        fechaTransferencia: { gte: fechaADate(periodo.desde), lte: fechaADate(periodo.hasta) },
      },
      select: {
        profesorId: true,
        total: true,
        fechaTransferencia: true,
        profesor: { select: { usuario: { select: { nombre: true, apellido: true } } } },
      },
      orderBy: [{ fechaTransferencia: 'asc' }, { id: 'asc' }],
    })
    // Una `PAGADA` siempre tiene `fechaTransferencia`: el filtro ya deja afuera las que no.
    return filas.flatMap((fila) =>
      fila.fechaTransferencia === null
        ? []
        : [
            {
              profesor: {
                id: fila.profesorId,
                nombre: fila.profesor.usuario.nombre,
                apellido: fila.profesor.usuario.apellido,
              },
              fechaTransferencia: dateAFecha(fila.fechaTransferencia),
              total: fila.total.toNumber(),
            },
          ],
    )
  },
}

export type TableroRepository = typeof tableroRepository
