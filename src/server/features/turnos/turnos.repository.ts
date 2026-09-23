import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { fechaADate } from '@/server/shared/fechas'
import type { TurnosVigentesPorMateria } from './turnos.validation'

// Único lugar de la feature que usa Prisma. Traduce errores del motor (P2002 -> ConflictError).
// Sin reglas de negocio.

/**
 * Condición de **turno vigente** (docs/dominio.md → Turnos): un recurrente sin fecha de fin o con
 * fin >= hoy, o una sesión única con fecha >= hoy. Como en una sesión única `fechaFin` es igual a
 * `fechaInicio` (decisión T-20), es una sola condición sobre `fechaFin`. Además, un turno
 * `CANCELADO` no cuenta: la vigencia se decide por fechas, pero un cancelado no bloquea nada.
 *
 * Es la **única** implementación de la condición (convenciones-backend.md → Turno vigente): se
 * reutiliza desde acá, nunca se reescribe en otra feature. `fechaHoy` la calcula el service con
 * `hoy()` y su reloj inyectable.
 */
export function condicionTurnoVigente(fechaHoy: string) {
  return {
    estado: 'ACTIVO',
    OR: [{ fechaFin: null }, { fechaFin: { gte: fechaADate(fechaHoy) } }],
  } satisfies Prisma.TurnoWhereInput
}

export const turnosRepository = {
  /**
   * Cantidad de turnos vigentes por materia, filtrable por profesor (el del bloque) y materias.
   * Solo vienen las materias con al menos un turno vigente.
   */
  async contarVigentesPorMateria(filtro: {
    fechaHoy: string
    profesorId?: number
    materiaIds?: number[]
  }): Promise<TurnosVigentesPorMateria[]> {
    const grupos = await prisma.turno.groupBy({
      by: ['materiaId'],
      where: {
        ...condicionTurnoVigente(filtro.fechaHoy),
        ...(filtro.profesorId === undefined
          ? {}
          : { bloqueAgenda: { profesorId: filtro.profesorId } }),
        ...(filtro.materiaIds === undefined ? {} : { materiaId: { in: filtro.materiaIds } }),
      },
      _count: { _all: true },
      orderBy: { materiaId: 'asc' },
    })
    return grupos.map((grupo) => ({ materiaId: grupo.materiaId, cantidad: grupo._count._all }))
  },
}

export type TurnosRepository = typeof turnosRepository
