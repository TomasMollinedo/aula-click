import { ConflictError, NotFoundError } from '@/server/errors'
import type { MateriasRepository } from '@/server/features/materias/materias.repository'
import type { Actor } from '@/server/shared/actor'
import type { ProfesoresRepository } from './profesores.repository'
import type { AsignarMaterias, MateriasAsignadas } from './profesores.validation'

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases.

type Detalle = { path: (string | number)[]; message: string }

/**
 * Un detalle por cada materia pedida que cumple `condicion`, con la misma forma que las issues
 * de Zod (`path` = posición en `materiaIds`): la UI marca cada materia igual que en un 400.
 */
function detallesDe(
  materiaIds: number[],
  condicion: (id: number) => boolean,
  mensaje: (id: number) => string,
): Detalle[] {
  return materiaIds.flatMap((id, i) =>
    condicion(id) ? [{ path: ['materiaIds', i], message: mensaje(id) }] : [],
  )
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos. Los importa solo como tipo, así el service no carga Prisma ni
 * `@/config/env`. De `materias` solo lee (`buscarPorIds`): nunca usa sus reglas.
 */
export function crearProfesoresService({
  repository,
  materiasRepository,
}: {
  repository: ProfesoresRepository
  materiasRepository: Pick<MateriasRepository, 'buscarPorIds'>
}) {
  async function listarMateriasAsignadas(profesorId: number): Promise<MateriasAsignadas> {
    const materias = await repository.listarMateriasAsignadas(profesorId)
    if (!materias) throw new NotFoundError('Profesor no encontrado')
    return materias
  }

  return {
    /** Materias con asignación activa. Se listan aunque el profesor esté inactivo. */
    listarMateriasAsignadas,

    /**
     * Asigna una o varias materias (todas o ninguna) y devuelve las asignadas actualizadas.
     * Orden de los chequeos: profesor inexistente (404), profesor inactivo (409), materias
     * inexistentes (404), materias inactivas (409) y materias ya asignadas (409). Cada error
     * informa todas las materias que lo causan. Una asignación dada de baja se reactiva.
     */
    async asignarMaterias(
      profesorId: number,
      { materiaIds }: AsignarMaterias,
      actor: Actor,
    ): Promise<MateriasAsignadas> {
      const profesor = await repository.buscarParaAsignar(profesorId, materiaIds)
      if (!profesor) throw new NotFoundError('Profesor no encontrado')
      if (profesor.estado !== 'ACTIVO') {
        throw new ConflictError('El profesor está inactivo: no se le pueden asignar materias', {
          code: 'PROFESOR_INACTIVO',
        })
      }

      const materias = new Map(
        (await materiasRepository.buscarPorIds(materiaIds)).map((materia) => [materia.id, materia]),
      )
      const nombre = (id: number) => materias.get(id)?.nombre ?? `#${id}`

      const inexistentes = detallesDe(
        materiaIds,
        (id) => !materias.has(id),
        (id) => `La materia ${id} no existe`,
      )
      if (inexistentes.length > 0) {
        throw new NotFoundError('Materia no encontrada', { details: inexistentes })
      }

      const inactivas = detallesDe(
        materiaIds,
        (id) => materias.get(id)?.estado !== 'ACTIVO',
        (id) => `La materia ${nombre(id)} está inactiva`,
      )
      if (inactivas.length > 0) {
        throw new ConflictError('No se pueden asignar materias inactivas', {
          code: 'MATERIA_INACTIVA',
          details: inactivas,
        })
      }

      const activas = new Set(
        profesor.asignaciones
          .filter((asignacion) => asignacion.estado === 'ACTIVO')
          .map((asignacion) => asignacion.materiaId),
      )
      const yaAsignadas = detallesDe(
        materiaIds,
        (id) => activas.has(id),
        (id) => `La materia ${nombre(id)} ya está asignada al profesor`,
      )
      if (yaAsignadas.length > 0) {
        throw new ConflictError('Alguna materia ya está asignada al profesor', {
          details: yaAsignadas,
        })
      }

      await repository.asignarMaterias(profesorId, materiaIds, actor)
      return listarMateriasAsignadas(profesorId)
    },
  }
}

export type ProfesoresService = ReturnType<typeof crearProfesoresService>
