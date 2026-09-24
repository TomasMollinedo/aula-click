import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { TurnosRepository } from '@/server/features/turnos/turnos.repository'
import type { Actor } from '@/server/shared/actor'
import { hoy, type Reloj } from '@/server/shared/fechas'
import { horaAMinutos } from '@/server/shared/zod'
import { partirEnHoras } from './bloques.reglas'
import type { BloquesRepository } from './bloques.repository'
import type { Bloque, BloquesCreados, CrearBloque, EditarBloque } from './bloques.validation'

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases. De `profesores` y
// `turnos` solo lee (`buscarParaBloque`, `contarVigentesPorBloque`): nunca usa sus reglas ni su
// service.

const MENSAJE_PROFESOR_INACTIVO = 'El profesor está inactivo: no se le puede cargar un bloque'
const MENSAJE_SIN_MATERIAS =
  'El profesor no tiene materias asignadas: no se le puede cargar un bloque'

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo (`reloj` opcional; por defecto el del sistema, vía
 * `hoy(reloj)`). Los importa solo como tipo, así el service no carga Prisma ni `@/config/env`.
 */
export function crearBloquesService({
  repository,
  profesoresRepository,
  turnosRepository,
  reloj,
}: {
  repository: BloquesRepository
  profesoresRepository: Pick<ProfesoresRepository, 'buscarParaBloque'>
  turnosRepository: Pick<TurnosRepository, 'contarVigentesPorBloque'>
  reloj?: Reloj
}) {
  /** Profesor inexistente (404), inactivo o sin materias (409). Mismo chequeo del alta y la edición. */
  async function validarProfesor(profesorId: number): Promise<void> {
    const profesor = await profesoresRepository.buscarParaBloque(profesorId)
    if (!profesor) throw new NotFoundError('Profesor no encontrado')
    if (profesor.estado !== 'ACTIVO') {
      throw new ConflictError(MENSAJE_PROFESOR_INACTIVO, { code: 'PROFESOR_INACTIVO' })
    }
    if (!profesor.tieneMateriaActiva) {
      throw new ConflictError(MENSAJE_SIN_MATERIAS, { code: 'PROFESOR_SIN_MATERIAS' })
    }
  }

  /**
   * Turnos vigentes de la fila (`estado` `ACTIVO` y fecha no pasada, `condicionTurnoVigente` de
   * `turnos.repository`, T-11): recurrente o sesión única, es la misma condición. Lanza
   * `ConflictError` `TURNOS_VIGENTES` si hay alguno.
   */
  async function exigirSinTurnosVigentes(bloqueId: number): Promise<void> {
    const cantidad = await turnosRepository.contarVigentesPorBloque(bloqueId, hoy(reloj))
    if (cantidad > 0) {
      throw new ConflictError('No se puede modificar un bloque con turnos vigentes', {
        code: 'TURNOS_VIGENTES',
        details: { cantidad },
      })
    }
  }

  return {
    /**
     * Crea una fila por cada hora del rango pedido (todas o ninguna). Orden de los chequeos:
     * profesor inexistente (404), profesor inactivo (409 `PROFESOR_INACTIVO`), profesor sin
     * materias asignadas (409 `PROFESOR_SIN_MATERIAS`), superposición con otro bloque del profesor
     * (409 `BLOQUE_SUPERPUESTO`) y aula ocupada (409 `AULA_OCUPADA`). Las dos últimas se verifican
     * de forma atómica en el repository, junto con el `INSERT`.
     */
    async crear(datos: CrearBloque, actor: Actor): Promise<BloquesCreados> {
      await validarProfesor(datos.profesorId)

      const horas = partirEnHoras(datos.horaInicio, datos.horaFin)
      const bloques = await repository.crearBloques(
        { profesorId: datos.profesorId, aulaId: datos.aulaId, diaSemana: datos.diaSemana, horas },
        actor,
      )
      return { cantidad: bloques.length, bloques }
    },

    /**
     * Edita día, horario y/o aula de una fila (una hora; el profesor no se edita). Orden de los
     * chequeos: fila inexistente (404), turnos vigentes (409 `TURNOS_VIGENTES`, con
     * la cantidad en `details`: una fila con reservas no se mueve), el resultado sigue siendo una
     * hora exacta (400, se valida acá porque depende de la fila actual), profesor inactivo o sin
     * materias (409, mismo chequeo del alta), y superposición/aula ocupada, verificadas de forma
     * atómica en el repository junto con el `UPDATE`.
     */
    async editar(id: number, cambios: EditarBloque, actor: Actor): Promise<Bloque> {
      const actual = await repository.buscarPorId(id)
      if (!actual) throw new NotFoundError('Bloque no encontrado')

      await exigirSinTurnosVigentes(id)

      const diaSemana = cambios.diaSemana ?? actual.diaSemana
      const horaInicio =
        cambios.horaInicio === undefined ? actual.horaInicio : horaAMinutos(cambios.horaInicio)
      const horaFin = cambios.horaFin === undefined ? actual.horaFin : horaAMinutos(cambios.horaFin)
      const aulaId = cambios.aulaId ?? actual.aulaId

      // Cada fila es siempre una hora exacta: con las dos horas ya en punto (validación de
      // formato), esto alcanza para exigir 60 minutos justos y que el fin quede después del inicio.
      if (horaFin - horaInicio !== 60) {
        throw new ValidationError('Cada bloque es siempre una hora exacta', {
          details: [
            { path: ['horaFin'], message: 'Debe ser exactamente una hora después de horaInicio' },
          ],
        })
      }

      await validarProfesor(actual.profesorId)

      return repository.editarBloque(id, { diaSemana, horaInicio, horaFin, aulaId }, actor)
    },

    /**
     * Baja lógica de una fila (una hora). Orden de los chequeos: fila inexistente (404) y turnos
     * vigentes (409 `TURNOS_VIGENTES`, con la cantidad en `details`). A diferencia del
     * alta y la edición, no valida el estado del profesor: dar de baja un bloque de un profesor ya
     * inactivo tiene que poder hacerse.
     */
    async eliminar(id: number, actor: Actor): Promise<Bloque> {
      const actual = await repository.buscarPorId(id)
      if (!actual) throw new NotFoundError('Bloque no encontrado')

      await exigirSinTurnosVigentes(id)

      return repository.eliminarBloque(id, actor)
    },
  }
}

export type BloquesService = ReturnType<typeof crearBloquesService>
