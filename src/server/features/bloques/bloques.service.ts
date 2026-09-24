import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { TurnosRepository } from '@/server/features/turnos/turnos.repository'
import type { Actor } from '@/server/shared/actor'
import { detallesPorPosicion } from '@/server/shared/detalles'
import { hoy, proximaFechaDelDia, type Reloj } from '@/server/shared/fechas'
import { horaAMinutos, minutosAHora, partirEnHoras } from '@/server/shared/zod'
import type { BloquesRepository } from './bloques.repository'
import type {
  Bloque,
  BloqueHorario,
  BloquesLote,
  CrearBloque,
  EditarBloque,
  EliminarBloques,
} from './bloques.validation'

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases. De `profesores` y
// `turnos` solo lee (`buscarParaBloque`, `buscarCapacidad`, los conteos de turnos vigentes y la
// ocupación): nunca usa sus reglas ni su service.

const MENSAJE_TURNOS_VIGENTES = 'No se puede modificar un bloque con turnos vigentes'

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
  profesoresRepository: Pick<ProfesoresRepository, 'buscarParaBloque' | 'buscarCapacidad'>
  turnosRepository: Pick<
    TurnosRepository,
    'contarVigentesPorBloque' | 'contarVigentesPorBloques' | 'contarOcupacionPorBloque'
  >
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
      throw new ConflictError(MENSAJE_TURNOS_VIGENTES, {
        code: 'TURNOS_VIGENTES',
        details: { cantidad },
      })
    }
  }

  return {
    /**
     * Horario semanal del profesor: sus filas activas, ordenadas por día y hora, sin paginar
     * (T-17 punto 1). Cada una trae, calculadas al leer:
     * - la capacidad efectiva (`min(profesor.capacidad, aula.capacidad)`);
     * - `proximaFecha`: la próxima fecha de su día de la semana a partir de hoy, hoy incluido
     *   (aunque la hora de hoy ya haya pasado: es un horario semanal, no una agenda);
     * - `ocupacion`: los turnos que ocupan lugar en esa fila en `proximaFecha`. Con T-30 todo
     *   turno es de una fecha puntual, así que sumar todos los futuros no se puede comparar con la
     *   capacidad: la ocupación es la de la próxima ocurrencia. Una sola consulta para todo el
     *   horario.
     *
     * 404 si el profesor no existe. Se puede ver aunque el profesor esté inactivo (es lectura,
     * igual que `listarMateriasAsignadas` de `profesores`).
     */
    async listarPorProfesor(profesorId: number): Promise<BloqueHorario[]> {
      const capacidadProfesor = await profesoresRepository.buscarCapacidad(profesorId)
      if (capacidadProfesor === null) throw new NotFoundError('Profesor no encontrado')

      const fechaHoy = hoy(reloj)
      const filas = (await repository.listarPorProfesor(profesorId)).map((fila) => ({
        ...fila,
        proximaFecha: proximaFechaDelDia(fila.diaSemana, fechaHoy),
      }))

      const ocupacion = new Map(
        (
          await turnosRepository.contarOcupacionPorBloque(
            filas.map((fila) => ({ bloqueAgendaId: fila.id, fecha: fila.proximaFecha })),
          )
        ).map((grupo) => [`${grupo.bloqueAgendaId}|${grupo.fecha}`, grupo.cantidad]),
      )

      return filas.map((fila) => ({
        id: fila.id,
        diaSemana: fila.diaSemana,
        horaInicio: minutosAHora(fila.horaInicio),
        horaFin: minutosAHora(fila.horaFin),
        aula: { id: fila.aula.id, nombre: fila.aula.nombre },
        capacidadEfectiva: Math.min(capacidadProfesor, fila.aula.capacidad),
        proximaFecha: fila.proximaFecha,
        ocupacion: ocupacion.get(`${fila.id}|${fila.proximaFecha}`) ?? 0,
      }))
    },

    /**
     * Crea una fila por cada hora del rango pedido (todas o ninguna). Orden de los chequeos:
     * profesor inexistente (404), profesor inactivo (409 `PROFESOR_INACTIVO`), profesor sin
     * materias asignadas (409 `PROFESOR_SIN_MATERIAS`), superposición con otro bloque del profesor
     * (409 `BLOQUE_SUPERPUESTO`) y aula ocupada (409 `AULA_OCUPADA`). Las dos últimas se verifican
     * de forma atómica en el repository, junto con el `INSERT`.
     */
    async crear(datos: CrearBloque, actor: Actor): Promise<BloquesLote> {
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

    /**
     * Baja lógica de varias filas juntas (el bloque que la UI muestra agrupado), todas o ninguna,
     * por ids explícitos. Mismo esquema que `quitarMaterias` de `profesores`: cada error informa
     * en `details` todas las filas que lo causan (`path` = posición en `bloqueIds`). Orden de los
     * chequeos: filas inexistentes o ya dadas de baja (404), filas de más de un profesor (400
     * `VALIDACION`: es la baja de un bloque del horario de un profesor, no una operación masiva) y
     * filas con turnos vigentes (409 `TURNOS_VIGENTES`, con la cantidad de cada una). Igual que la
     * baja de una hora, no valida el estado del profesor.
     */
    async eliminarVarios({ bloqueIds }: EliminarBloques, actor: Actor): Promise<BloquesLote> {
      const filas = new Map((await repository.buscarPorIds(bloqueIds)).map((f) => [f.id, f]))

      const inexistentes = detallesPorPosicion(
        'bloqueIds',
        bloqueIds,
        (id) => filas.get(id)?.estado !== 'ACTIVO',
        (id) => `El bloque ${id} no existe o ya fue dado de baja`,
      )
      if (inexistentes.length > 0) {
        throw new NotFoundError('Bloque no encontrado', { details: inexistentes })
      }

      const profesores = new Set(bloqueIds.map((id) => filas.get(id)?.profesorId))
      if (profesores.size > 1) {
        throw new ValidationError('Todas las horas deben ser del mismo profesor', {
          details: [
            { path: ['bloqueIds'], message: 'Todas las horas deben ser del mismo profesor' },
          ],
        })
      }

      const vigentes = new Map(
        (await turnosRepository.contarVigentesPorBloques(bloqueIds, hoy(reloj))).map(
          ({ bloqueAgendaId, cantidad }) => [bloqueAgendaId, cantidad],
        ),
      )
      const conTurnos = detallesPorPosicion(
        'bloqueIds',
        bloqueIds,
        (id) => (vigentes.get(id) ?? 0) > 0,
        (id) => {
          const fila = filas.get(id)
          const cantidad = vigentes.get(id) ?? 0
          const hora = fila
            ? ` de ${minutosAHora(fila.horaInicio)} a ${minutosAHora(fila.horaFin)}`
            : ''
          return `La hora${hora} tiene ${cantidad} ${cantidad === 1 ? 'turno vigente' : 'turnos vigentes'}`
        },
        (id) => ({ cantidad: vigentes.get(id) ?? 0 }),
      )
      if (conTurnos.length > 0) {
        throw new ConflictError(MENSAJE_TURNOS_VIGENTES, {
          code: 'TURNOS_VIGENTES',
          details: conTurnos,
        })
      }

      const bloques = await repository.eliminarBloques(bloqueIds, actor)
      return { cantidad: bloques.length, bloques }
    },
  }
}

export type BloquesService = ReturnType<typeof crearBloquesService>
