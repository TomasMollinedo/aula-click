import type { BloquesRepository } from '@/server/features/bloques/bloques.repository'
import { partirEnHoras } from '@/server/shared/zod'
import type { AulasRepository } from './aulas.repository'
import type { AulaDisponible, AulasDisponiblesQuery } from './aulas.validation'

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases. De `bloques` solo
// lee (`aulasOcupadas`, dueña de la definición de "hora ocupada"): nunca usa sus reglas.

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos. Los importa solo como tipo, así el service no carga Prisma ni
 * `@/config/env`.
 */
export function crearAulasService({
  repository,
  bloquesRepository,
}: {
  repository: AulasRepository
  bloquesRepository: Pick<BloquesRepository, 'aulasOcupadas'>
}) {
  return {
    /**
     * Aulas activas libres **durante todo** el horario pedido ese día (ninguna de sus horas
     * ocupada por otra fila activa, de cualquier profesor), ordenadas por nombre. Es un selector:
     * sin paginar, y `[]` si no hay ninguna (no es un error: la UI muestra el mensaje de la HU).
     * Las inactivas no se ofrecen: lo dado de baja no se puede elegir.
     */
    async disponibles(query: AulasDisponiblesQuery): Promise<AulaDisponible[]> {
      const horasPedidas = partirEnHoras(query.horaInicio, query.horaFin).map(
        (hora) => hora.horaInicio,
      )
      const ocupadas = new Set(
        await bloquesRepository.aulasOcupadas({
          diaSemana: query.diaSemana,
          horasPedidas,
          excluirBloqueId: query.excluirBloqueId,
        }),
      )
      const aulas = await repository.listar()
      return aulas
        .filter((aula) => aula.estado === 'ACTIVO' && !ocupadas.has(aula.id))
        .map(({ id, nombre, capacidad }) => ({ id, nombre, capacidad }))
    },
  }
}

export type AulasService = ReturnType<typeof crearAulasService>
