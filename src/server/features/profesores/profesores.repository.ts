import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ConflictError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import type { MateriasAsignadas, ProfesorParaAsignar } from './profesores.validation'

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

  /**
   * Estado del profesor (el de su `Usuario`) y sus asignaciones de esas materias, activas o no.
   * `null` si el profesor no existe.
   */
  async buscarParaAsignar(
    profesorId: number,
    materiaIds: number[],
  ): Promise<ProfesorParaAsignar | null> {
    const profesor = await prisma.profesor.findUnique({
      where: { id: profesorId },
      select: {
        usuario: { select: { estado: true } },
        asignaciones: {
          where: { materiaId: { in: materiaIds } },
          select: { materiaId: true, estado: true },
        },
      },
    })
    return profesor && { estado: profesor.usuario.estado, asignaciones: profesor.asignaciones }
  },

  /**
   * Asigna todas las materias en una sola transacción (todas o ninguna). El par profesor–materia
   * es único: si ya existe una fila (dada de baja), se reactiva; si no, se inserta.
   * Auditoría: `createdById` en el alta y `updatedById` siempre, con el actor.
   */
  async asignarMaterias(profesorId: number, materiaIds: number[], actor: Actor): Promise<void> {
    try {
      await prisma.$transaction(
        materiaIds.map((materiaId) =>
          prisma.asignacionMateria.upsert({
            where: { profesorId_materiaId: { profesorId, materiaId } },
            create: {
              profesorId,
              materiaId,
              createdById: actor.userId,
              updatedById: actor.userId,
            },
            update: { estado: 'ACTIVO', updatedById: actor.userId },
            select: { id: true },
          }),
        ),
      )
    } catch (error) {
      // Dos asignaciones simultáneas del mismo par: la segunda choca con el UNIQUE.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Alguna de las materias ya fue asignada a este profesor', {
          cause: error,
        })
      }
      throw error
    }
  },
}

export type ProfesoresRepository = typeof profesoresRepository
