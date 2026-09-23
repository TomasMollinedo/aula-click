import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ConflictError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import type {
  MateriasAsignadas,
  ProfesorConAsignaciones,
  ProfesorDeMateria,
} from './profesores.validation'

// Único lugar de la feature que usa Prisma. Traduce errores del motor (P2002 -> ConflictError),
// completa la auditoría con el Actor y devuelve DTOs: ningún tipo de Prisma sale de acá.
// Sin reglas de negocio.

/** Profesores con asignación activa de la materia; con `soloActivos`, además usuario `ACTIVO`. */
async function profesoresDeMateria({
  materiaId,
  soloActivos = false,
}: {
  materiaId: number
  soloActivos?: boolean
}): Promise<ProfesorDeMateria[]> {
  const filas = await prisma.profesor.findMany({
    where: {
      asignaciones: { some: { materiaId, estado: 'ACTIVO' } },
      ...(soloActivos ? { usuario: { estado: 'ACTIVO' } } : {}),
    },
    select: {
      id: true,
      usuario: { select: { apellido: true, nombre: true, estado: true } },
    },
    orderBy: [{ usuario: { busqueda: 'asc' } }, { id: 'asc' }],
  })
  return filas.map(({ id, usuario }) => ({ id, ...usuario }))
}

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
   * Estado del profesor (el de su `Usuario`) y sus asignaciones de esas materias, activas o no,
   * con el nombre de la materia. `null` si el profesor no existe.
   */
  async buscarConAsignaciones(
    profesorId: number,
    materiaIds: number[],
  ): Promise<ProfesorConAsignaciones | null> {
    const profesor = await prisma.profesor.findUnique({
      where: { id: profesorId },
      select: {
        usuario: { select: { estado: true } },
        asignaciones: {
          where: { materiaId: { in: materiaIds } },
          select: { materiaId: true, estado: true, materia: { select: { nombre: true } } },
        },
      },
    })
    return (
      profesor && {
        estado: profesor.usuario.estado,
        asignaciones: profesor.asignaciones.map(({ materiaId, estado, materia }) => ({
          materiaId,
          nombre: materia.nombre,
          estado,
        })),
      }
    )
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

  /**
   * Profesores con asignación `ACTIVO` de la materia, activos o no (con su `estado`), ordenados
   * por apellido y nombre (`busqueda` del usuario) y luego `id`. Lectura para otras features:
   * detalle de materias (quién la dicta) y baja de materias (T-09: no se puede con profesores).
   */
  async listarProfesoresDeMateria(materiaId: number): Promise<ProfesorDeMateria[]> {
    return profesoresDeMateria({ materiaId })
  },

  /**
   * Como `listarProfesoresDeMateria`, pero solo profesores activos: los que pueden recibir un
   * turno nuevo de esa materia (HU-07).
   */
  async listarProfesoresActivosDeMateria(materiaId: number): Promise<ProfesorDeMateria[]> {
    return profesoresDeMateria({ materiaId, soloActivos: true })
  },

  /**
   * Baja lógica de las asignaciones activas de esas materias (`estado = INACTIVO`), nunca borrado
   * físico: reasignar la materia reactiva la misma fila. Un solo UPDATE: todas o ninguna.
   * Auditoría: `updatedById` con el actor.
   */
  async quitarMaterias(profesorId: number, materiaIds: number[], actor: Actor): Promise<void> {
    await prisma.asignacionMateria.updateMany({
      where: { profesorId, materiaId: { in: materiaIds }, estado: 'ACTIVO' },
      data: { estado: 'INACTIVO', updatedById: actor.userId },
    })
  },
}

export type ProfesoresRepository = typeof profesoresRepository
