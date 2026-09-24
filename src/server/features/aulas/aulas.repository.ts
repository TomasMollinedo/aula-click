import { prisma } from '@/lib/prisma'
import type { AulaGuardada } from './aulas.validation'

// Único lugar de la feature que usa Prisma, y dueño de las lecturas del catálogo `Aula` (sin ABM
// en este release, T-28). Sin reglas de negocio: qué aulas se pueden elegir lo decide el service.
// No lleva auditoría: `Aula` es un catálogo del seed, como `Rol`.

export const aulasRepository = {
  /** Todas las aulas, activas o no, ordenadas por nombre (y `id` como desempate). */
  async listar(): Promise<AulaGuardada[]> {
    return prisma.aula.findMany({
      select: { id: true, nombre: true, capacidad: true, estado: true },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    })
  },
}

export type AulasRepository = typeof aulasRepository
