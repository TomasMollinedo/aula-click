import { prisma } from '@/lib/prisma'
import { dateAFecha, fechaADate } from '@/server/shared/fechas'
import { leerAdeudados, leerProximos, type Adeudado } from './cuentas.condiciones'
import type { PagoDelHistorial } from './cuentas.validation'

// Único lugar de la feature que usa Prisma. Sólo lecturas, sin transacción ni locks: la lista de
// adeudados y su total salen de la misma lectura. Qué se adeuda y qué es próximo lo deciden las
// condiciones de la feature (`cuentas.condiciones.ts`, que también usa el tablero), nunca una
// expansión propia. Los importes salen como `number`, nunca como `Prisma.Decimal`.

export const cuentasRepository = {
  /** Adeudados del alumno (o de todos, sin `alumnoId`), del más antiguo al más reciente. */
  async leerAdeudados(filtro: { alumnoId?: number; hoy: string }): Promise<Adeudado[]> {
    return leerAdeudados(prisma, filtro)
  },

  /** Próximos del alumno: de hoy a hoy + 56 días, agendados e impagos, ascendentes. */
  async leerProximos(filtro: { alumnoId: number; hoy: string }): Promise<Adeudado[]> {
    return leerProximos(prisma, filtro)
  },

  /**
   * Suma de `importeTotal` de los pagos del alumno con `fechaPago` en `[desde, hasta]` (por fecha
   * de pago, no por `createdAt`; todos cuentan: no hay anulación, definición D). 0 si no hay.
   */
  async sumarPagos(alumnoId: number, desde: string, hasta: string): Promise<number> {
    const { _sum } = await prisma.pago.aggregate({
      where: { alumnoId, fechaPago: { gte: fechaADate(desde), lte: fechaADate(hasta) } },
      _sum: { importeTotal: true },
    })
    return _sum.importeTotal ? _sum.importeTotal.toNumber() : 0
  },

  /** Todos los pagos del alumno, del más reciente al más antiguo, con su cantidad de turnos. */
  async listarPagos(alumnoId: number): Promise<PagoDelHistorial[]> {
    const filas = await prisma.pago.findMany({
      where: { alumnoId },
      select: {
        id: true,
        numeroComprobante: true,
        fechaPago: true,
        importeTotal: true,
        _count: { select: { turnos: true } },
      },
      orderBy: [{ fechaPago: 'desc' }, { numeroComprobante: 'desc' }],
    })
    return filas.map((fila) => ({
      pagoId: fila.id,
      numeroComprobante: fila.numeroComprobante,
      fechaPago: dateAFecha(fila.fechaPago),
      cantidad: fila._count.turnos,
      total: fila.importeTotal.toNumber(),
    }))
  },

  /** DNI de cada alumno pedido (`Ocurrencia.alumno` no lo trae), en una consulta. */
  async dnisDeAlumnos(alumnoIds: readonly number[]): Promise<Map<number, string>> {
    const ids = [...new Set(alumnoIds)]
    if (ids.length === 0) return new Map()
    const alumnos = await prisma.alumno.findMany({
      where: { id: { in: ids } },
      select: { id: true, dni: true },
    })
    return new Map(alumnos.map((a) => [a.id, a.dni]))
  },
}

export type CuentasRepository = typeof cuentasRepository
