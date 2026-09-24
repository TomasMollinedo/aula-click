import { ConflictError, NotFoundError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import { partirEnHoras } from './bloques.reglas'
import type { BloquesRepository } from './bloques.repository'
import type { BloquesCreados, CrearBloque } from './bloques.validation'

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases. De `profesores`
// solo lee (`buscarParaBloque`): nunca usa sus reglas ni su service.

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos. Los importa solo como tipo, así el service no carga Prisma ni
 * `@/config/env`.
 */
export function crearBloquesService({
  repository,
  profesoresRepository,
}: {
  repository: BloquesRepository
  profesoresRepository: Pick<ProfesoresRepository, 'buscarParaBloque'>
}) {
  return {
    /**
     * Crea una fila por cada hora del rango pedido (todas o ninguna). Orden de los chequeos:
     * profesor inexistente (404), profesor inactivo (409 `PROFESOR_INACTIVO`), profesor sin
     * materias asignadas (409 `PROFESOR_SIN_MATERIAS`), superposición con otro bloque del profesor
     * (409 `BLOQUE_SUPERPUESTO`) y aula ocupada (409 `AULA_OCUPADA`). Las dos últimas se verifican
     * de forma atómica en el repository, junto con el `INSERT`.
     */
    async crear(datos: CrearBloque, actor: Actor): Promise<BloquesCreados> {
      const profesor = await profesoresRepository.buscarParaBloque(datos.profesorId)
      if (!profesor) throw new NotFoundError('Profesor no encontrado')
      if (profesor.estado !== 'ACTIVO') {
        throw new ConflictError('El profesor está inactivo: no se le puede cargar un bloque', {
          code: 'PROFESOR_INACTIVO',
        })
      }
      if (!profesor.tieneMateriaActiva) {
        throw new ConflictError(
          'El profesor no tiene materias asignadas: no se le puede cargar un bloque',
          { code: 'PROFESOR_SIN_MATERIAS' },
        )
      }

      const horas = partirEnHoras(datos.horaInicio, datos.horaFin)
      const bloques = await repository.crearBloques(
        { profesorId: datos.profesorId, aulaId: datos.aulaId, diaSemana: datos.diaSemana, horas },
        actor,
      )
      return { cantidad: bloques.length, bloques }
    },
  }
}

export type BloquesService = ReturnType<typeof crearBloquesService>
