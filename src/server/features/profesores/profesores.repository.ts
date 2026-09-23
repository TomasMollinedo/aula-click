import { prisma } from '@/lib/prisma'
import type { MateriasAsignadas } from './profesores.validation'

// Único lugar de la feature que usa Prisma. Traduce errores del motor (P2002 -> ConflictError),
// completa la auditoría con el Actor y devuelve DTOs: ningún tipo de Prisma sale de acá.
// Sin reglas de negocio.

export const profesoresRepository = {
  /**
   * Materias con asignación `ACTIVO` del profesor, o `null` si el profesor no existe.
   * Orden por `busqueda` (nombre normalizado, sin tildes ni mayúsculas) y luego `id`.
   */
  async listarMateriasAsignadas(profesorId: number): Promise<MateriasAsignadas | null> {
    const profesor = await prisma.profesor.findUnique({
      where: { id: profesorId },
      select: {
        asignaciones: {
          where: { estado: 'ACTIVO' },
          select: { materia: { select: { id: true, nombre: true } } },
          orderBy: [{ materia: { busqueda: 'asc' } }, { materiaId: 'asc' }],
        },
      },
    })
    return profesor && profesor.asignaciones.map(({ materia }) => materia)
  },
}

export type ProfesoresRepository = typeof profesoresRepository
