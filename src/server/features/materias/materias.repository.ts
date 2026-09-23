import { prisma } from '@/lib/prisma'
import type { MateriaConEstado } from './materias.validation'

// Único lugar de la feature que usa Prisma. Traduce errores del motor (P2002 -> ConflictError).
// Sin reglas de negocio.

export const materiasRepository = {
  /**
   * Materias con esos ids, con su estado. Las que no existen no vienen: quien llama compara.
   * La usa `profesores` para validar las materias que se asignan (T-11).
   */
  async buscarPorIds(ids: number[]): Promise<MateriaConEstado[]> {
    return prisma.materia.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true, estado: true },
    })
  },
}

export type MateriasRepository = typeof materiasRepository
