import { NotFoundError } from '@/server/errors'
import type { ProfesoresRepository } from './profesores.repository'
import type { MateriasAsignadas } from './profesores.validation'

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases.

/**
 * Crea el service con sus dependencias. El controller arma la instancia con el repository real;
 * los tests, con un repository falso. Importa el repository solo como tipo, así el service no
 * carga Prisma ni `@/config/env`.
 */
export function crearProfesoresService({ repository }: { repository: ProfesoresRepository }) {
  return {
    /** Materias con asignación activa. Se listan aunque el profesor esté inactivo. */
    async listarMateriasAsignadas(profesorId: number): Promise<MateriasAsignadas> {
      const materias = await repository.listarMateriasAsignadas(profesorId)
      if (!materias) throw new NotFoundError('Profesor no encontrado')
      return materias
    },
  }
}

export type ProfesoresService = ReturnType<typeof crearProfesoresService>
