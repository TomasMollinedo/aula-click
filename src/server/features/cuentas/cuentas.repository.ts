import { prisma } from '@/lib/prisma'
import type { Estado } from '@/server/shared/estado'
import { leerAdeudados, leerProximos, type Adeudado, type FiltroDeuda } from './cuentas.condiciones'

// Único lugar de la feature que usa Prisma. Sólo lecturas, sin transacción ni locks: la lista de
// adeudados y su total salen de la misma lectura. Qué se adeuda y qué es próximo lo deciden las
// condiciones de la feature (`cuentas.condiciones.ts`, que también usa el tablero), nunca una
// expansión propia. Los importes salen como `number`, nunca como `Prisma.Decimal`.

export const cuentasRepository = {
  /** Adeudados del filtro (sin `alumnoId`, de todos), del más antiguo al más reciente. */
  async leerAdeudados(filtro: FiltroDeuda): Promise<Adeudado[]> {
    return leerAdeudados(prisma, filtro)
  },

  /** Próximos del filtro (sin `alumnoId`, de todos): agendados e impagos, hasta el tope de cobro. */
  async leerProximos(filtro: FiltroDeuda): Promise<Adeudado[]> {
    return leerProximos(prisma, filtro)
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

  /** Estado de cada materia pedida (`Ocurrencia.materia` no lo trae), en una consulta. */
  async estadosDeMaterias(materiaIds: readonly number[]): Promise<Map<number, Estado>> {
    const ids = [...new Set(materiaIds)]
    if (ids.length === 0) return new Map()
    const materias = await prisma.materia.findMany({
      where: { id: { in: ids } },
      select: { id: true, estado: true },
    })
    return new Map(materias.map((m) => [m.id, m.estado]))
  },
}

export type CuentasRepository = typeof cuentasRepository
