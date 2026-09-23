import { ConflictError, NotFoundError } from '@/server/errors'
import type { MateriasRepository } from '@/server/features/materias/materias.repository'
import type { TurnosRepository } from '@/server/features/turnos/turnos.repository'
import type { Actor } from '@/server/shared/actor'
import { hoy, type Reloj } from '@/server/shared/fechas'
import type { ProfesoresRepository } from './profesores.repository'
import type { AsignarMaterias, MateriasAsignadas, QuitarMaterias } from './profesores.validation'

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases.

type Detalle = { path: (string | number)[]; message: string } & Record<string, unknown>

/**
 * Un detalle por cada materia pedida que cumple `condicion`, con la misma forma que las issues
 * de Zod (`path` = posición en `materiaIds`): la UI marca cada materia igual que en un 400.
 * `extra` agrega datos propios del error (por ejemplo la cantidad de turnos vigentes).
 */
function detallesDe(
  materiaIds: number[],
  condicion: (id: number) => boolean,
  mensaje: (id: number) => string,
  extra: (id: number) => Record<string, unknown> = () => ({}),
): Detalle[] {
  return materiaIds.flatMap((id, i) =>
    condicion(id) ? [{ path: ['materiaIds', i], message: mensaje(id), ...extra(id) }] : [],
  )
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo (`reloj` opcional: por defecto el del sistema, vía
 * `hoy(reloj)`). Los importa solo como tipo, así el service no carga Prisma ni `@/config/env`.
 * De `materias` y `turnos` solo lee: nunca usa sus reglas.
 */
export function crearProfesoresService({
  repository,
  materiasRepository,
  turnosRepository,
  reloj,
}: {
  repository: ProfesoresRepository
  materiasRepository: Pick<MateriasRepository, 'buscarPorIds'>
  turnosRepository: Pick<TurnosRepository, 'contarVigentesPorMateria'>
  reloj?: Reloj
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
      const profesor = await repository.buscarConAsignaciones(profesorId, materiaIds)
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

    /**
     * Quita una o varias materias (baja lógica, todas o ninguna) y devuelve las asignadas
     * actualizadas. Orden de los chequeos: profesor inexistente (404), materias sin asignación
     * activa (404) y materias con turnos vigentes del profesor (409 `TURNOS_VIGENTES`, con la
     * cantidad de turnos de cada una en `details`). Se permite aunque el profesor esté inactivo.
     */
    async quitarMaterias(
      profesorId: number,
      { materiaIds }: QuitarMaterias,
      actor: Actor,
    ): Promise<MateriasAsignadas> {
      const profesor = await repository.buscarConAsignaciones(profesorId, materiaIds)
      if (!profesor) throw new NotFoundError('Profesor no encontrado')

      const asignadas = new Map(
        profesor.asignaciones
          .filter((asignacion) => asignacion.estado === 'ACTIVO')
          .map((asignacion) => [asignacion.materiaId, asignacion.nombre]),
      )
      const noAsignadas = detallesDe(
        materiaIds,
        (id) => !asignadas.has(id),
        (id) => `La materia ${id} no está asignada al profesor`,
      )
      if (noAsignadas.length > 0) {
        throw new NotFoundError('Materia no asignada al profesor', { details: noAsignadas })
      }

      const vigentes = new Map(
        (
          await turnosRepository.contarVigentesPorMateria({
            fechaHoy: hoy(reloj),
            profesorId,
            materiaIds,
          })
        ).map(({ materiaId, cantidad }) => [materiaId, cantidad]),
      )
      const conTurnos = detallesDe(
        materiaIds,
        (id) => (vigentes.get(id) ?? 0) > 0,
        (id) => {
          const cantidad = vigentes.get(id) ?? 0
          return `La materia ${asignadas.get(id)} tiene ${cantidad} ${cantidad === 1 ? 'turno vigente' : 'turnos vigentes'} con el profesor`
        },
        (id) => ({ cantidad: vigentes.get(id) ?? 0 }),
      )
      if (conTurnos.length > 0) {
        throw new ConflictError('No se pueden quitar materias con turnos vigentes', {
          code: 'TURNOS_VIGENTES',
          details: conTurnos,
        })
      }

      await repository.quitarMaterias(profesorId, materiaIds, actor)
      return listarMateriasAsignadas(profesorId)
    },
  }
}

export type ProfesoresService = ReturnType<typeof crearProfesoresService>
