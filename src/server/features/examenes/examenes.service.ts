import { ConflictError, ForbiddenError, NotFoundError } from '@/server/errors'
import type { AlumnosRepository } from '@/server/features/alumnos/alumnos.repository'
import type { MateriasRepository } from '@/server/features/materias/materias.repository'
import type { ProfesoresRepository } from '@/server/features/profesores/profesores.repository'
import type { Actor } from '@/server/shared/actor'
import { fechaADate, hoy, type Reloj } from '@/server/shared/fechas'
import type { ExamenesRepository } from './examenes.repository'
import type {
  CrearExamen,
  EditarExamen,
  ExamenDetalle,
  ExamenesListado,
  ExamenGuardado,
  ExamenItem,
  MateriasExamenSelector,
} from './examenes.validation'

// Reglas de negocio de exámenes (HU-17). No conoce HTTP ni Prisma: lanza AppError o sus
// subclases. No toca `examenes.condiciones.ts` (T-31, prioridad): la prioridad no se persiste, así
// que cargar, editar o dar de baja un examen la cambia sola en la próxima consulta.

const MENSAJE_NO_ENCONTRADO = 'Examen no encontrado'
const MENSAJE_ALUMNO_NO_ENCONTRADO = 'Alumno no encontrado'
const MENSAJE_MATERIA_NO_ENCONTRADA = 'Materia no encontrada'
const MENSAJE_MATERIA_INACTIVA = 'La materia está inactiva: no se le puede cargar un examen'
const MENSAJE_MATERIA_AJENA = 'No dicta esa materia a este alumno'
const MENSAJE_MATERIA_SIN_TURNOS = 'El alumno no tiene turnos próximos de esa materia'
const MENSAJE_PENDIENTE =
  'Ya hay un examen pendiente de esa materia: edítelo en vez de cargar uno nuevo'

/** Código del 409 al cargar o editar un examen de una materia inactiva (`contrato-api.md`). */
export const CODIGO_MATERIA_INACTIVA = 'MATERIA_INACTIVA'
/** Código del 409 al cargar o mover un examen a una materia sin turnos vigentes del alumno. */
export const CODIGO_MATERIA_SIN_TURNOS = 'MATERIA_SIN_TURNOS'
/** Código del 409 al cargar o mover un examen a una materia con un pendiente (HU-17). */
export const CODIGO_EXAMEN_PENDIENTE = 'EXAMEN_PENDIENTE'

const MS_POR_DIA = 24 * 60 * 60 * 1000

// Misma cuenta que `examenes.condiciones.ts` (T-31): días de calendario de `desde` a `hasta`.
function diasEntre(desde: string, hasta: string): number {
  return Math.round((fechaADate(hasta).getTime() - fechaADate(desde).getTime()) / MS_POR_DIA)
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo. Los importa solo como tipo, así el service no
 * carga Prisma ni `@/config/env`.
 */
export function crearExamenesService({
  repository,
  alumnosRepository,
  materiasRepository,
  profesoresRepository,
  reloj,
}: {
  repository: Pick<
    ExamenesRepository,
    | 'listarDelAlumno'
    | 'buscarPorId'
    | 'buscarPendiente'
    | 'crear'
    | 'actualizar'
    | 'darDeBaja'
    | 'materiasDictadas'
    | 'materiasConTurnoVigente'
  >
  alumnosRepository: Pick<AlumnosRepository, 'buscarPorId'>
  materiasRepository: Pick<MateriasRepository, 'listarActivas' | 'buscarPorIds'>
  profesoresRepository: Pick<ProfesoresRepository, 'buscarIdPorUsuario'>
  reloj?: Reloj
}) {
  function aItem(examen: ExamenGuardado, fechaHoy: string, administrable: boolean): ExamenItem {
    const pasado = examen.fecha < fechaHoy
    return {
      id: examen.id,
      materia: examen.materia,
      fecha: examen.fecha,
      tipo: examen.tipo,
      observaciones: examen.observaciones,
      pasado,
      diasRestantes: pasado ? null : diasEntre(fechaHoy, examen.fecha),
      administrable,
      createdAt: examen.createdAt,
      updatedAt: examen.updatedAt,
      createdBy: examen.createdBy,
      updatedBy: examen.updatedBy,
    }
  }

  function aDetalle(examen: ExamenGuardado, fechaHoy: string): ExamenDetalle {
    return {
      id: examen.id,
      alumnoId: examen.alumnoId,
      materia: examen.materia,
      fecha: examen.fecha,
      tipo: examen.tipo,
      observaciones: examen.observaciones,
      pasado: examen.fecha < fechaHoy,
      createdAt: examen.createdAt,
      updatedAt: examen.updatedAt,
      createdBy: examen.createdBy,
      updatedBy: examen.updatedBy,
    }
  }

  /** Materia inexistente (404) o inactiva (409 `MATERIA_INACTIVA`, `path` `["materiaId"]`). */
  async function exigirMateriaActiva(materiaId: number): Promise<void> {
    const [materia] = await materiasRepository.buscarPorIds([materiaId])
    if (!materia) throw new NotFoundError(MENSAJE_MATERIA_NO_ENCONTRADA)
    if (materia.estado !== 'ACTIVO') {
      throw new ConflictError(MENSAJE_MATERIA_INACTIVA, {
        code: CODIGO_MATERIA_INACTIVA,
        details: [{ path: ['materiaId'], message: MENSAJE_MATERIA_INACTIVA }],
      })
    }
  }

  /**
   * `PROFESOR` sólo puede cargar, editar o dar de baja un examen de una materia que le dicta a ese
   * alumno (`materiasDictadas`, T-29/T-30): 403 si no. `MESA_ENTRADAS` no tiene esta restricción.
   */
  async function exigirMateriaPropia(
    actor: Actor,
    alumnoId: number,
    materiaId: number,
  ): Promise<void> {
    if (actor.role !== 'PROFESOR') return
    const profesorId = await profesoresRepository.buscarIdPorUsuario(actor.userId)
    const materias =
      profesorId === null ? [] : await repository.materiasDictadas(profesorId, alumnoId)
    if (!materias.some((materia) => materia.id === materiaId)) {
      throw new ForbiddenError(MENSAJE_MATERIA_AJENA)
    }
  }

  /**
   * Ids de las materias en las que se le puede cargar un examen nuevo al alumno: las de sus turnos
   * vigentes (alguna fecha no cancelada de hoy en adelante). `PROFESOR`: sólo las de los turnos que
   * tiene con él.
   */
  async function materiasConTurno(
    actor: Actor,
    alumnoId: number,
    fechaHoy: string,
  ): Promise<number[]> {
    if (actor.role !== 'PROFESOR') return repository.materiasConTurnoVigente(alumnoId, fechaHoy)
    const profesorId = await profesoresRepository.buscarIdPorUsuario(actor.userId)
    return profesorId === null
      ? []
      : repository.materiasConTurnoVigente(alumnoId, fechaHoy, profesorId)
  }

  /** El alumno sin turnos vigentes de esa materia → 409 `MATERIA_SIN_TURNOS` (`materiaId`). */
  async function exigirTurnoVigente(
    actor: Actor,
    alumnoId: number,
    materiaId: number,
    fechaHoy: string,
  ): Promise<void> {
    const materiaIds = await materiasConTurno(actor, alumnoId, fechaHoy)
    if (!materiaIds.includes(materiaId)) {
      throw new ConflictError(MENSAJE_MATERIA_SIN_TURNOS, {
        code: CODIGO_MATERIA_SIN_TURNOS,
        details: [{ path: ['materiaId'], message: MENSAJE_MATERIA_SIN_TURNOS }],
      })
    }
  }

  /** Un examen `ACTIVO` pendiente (fecha `>= hoy`) de la misma materia → 409 con el existente. */
  async function exigirSinPendiente(
    alumnoId: number,
    materiaId: number,
    fechaHoy: string,
    excluirId?: number,
  ): Promise<void> {
    const pendiente = await repository.buscarPendiente(alumnoId, materiaId, fechaHoy, excluirId)
    if (pendiente) {
      throw new ConflictError(MENSAJE_PENDIENTE, {
        code: CODIGO_EXAMEN_PENDIENTE,
        details: pendiente,
      })
    }
  }

  return {
    /**
     * `{ proximos[], pasados[] }` del alumno: próximos por fecha ascendente, pasados al revés.
     * `administrable` dice si el actor puede editarlo y darlo de baja: mesa de entradas, todos; el
     * profesor, los de las materias que le dicta al alumno (la misma regla que `exigirMateriaPropia`).
     */
    async listar(alumnoId: number, actor: Actor): Promise<ExamenesListado> {
      const fechaHoy = hoy(reloj)
      const examenes = await repository.listarDelAlumno(alumnoId)
      let propias: Set<number> | null = null
      if (actor.role === 'PROFESOR') {
        const profesorId = await profesoresRepository.buscarIdPorUsuario(actor.userId)
        const materias =
          profesorId === null ? [] : await repository.materiasDictadas(profesorId, alumnoId)
        propias = new Set(materias.map((materia) => materia.id))
      }
      const item = (examen: ExamenGuardado) =>
        aItem(examen, fechaHoy, propias === null || propias.has(examen.materiaId))
      return {
        proximos: examenes.filter((examen) => examen.fecha >= fechaHoy).map(item),
        pasados: examenes
          .filter((examen) => examen.fecha < fechaHoy)
          .reverse()
          .map(item),
      }
    },

    /**
     * Materias ofrecibles para cargarle un examen nuevo a ese alumno: las activas en las que tiene
     * algún turno vigente (para el profesor, con él), por nombre.
     */
    async materiasOfrecibles(alumnoId: number, actor: Actor): Promise<MateriasExamenSelector> {
      const materiaIds = await materiasConTurno(actor, alumnoId, hoy(reloj))
      if (materiaIds.length === 0) return []
      const activas = await materiasRepository.listarActivas()
      return activas.filter((materia) => materiaIds.includes(materia.id))
    },

    /**
     * Alta de un examen (HU-17). Chequeos, en orden: alumno (404), materia activa (404/409),
     * materia propia si es `PROFESOR` (403), con algún turno vigente del alumno en esa materia (409)
     * y sin un pendiente de la misma materia (409). Una fecha
     * pasada se acepta (`pasado: true` en la respuesta, para el aviso del front).
     */
    async crear(datos: CrearExamen, actor: Actor): Promise<ExamenDetalle> {
      const fechaHoy = hoy(reloj)
      const alumno = await alumnosRepository.buscarPorId(datos.alumnoId)
      if (!alumno) throw new NotFoundError(MENSAJE_ALUMNO_NO_ENCONTRADO)

      await exigirMateriaActiva(datos.materiaId)
      await exigirMateriaPropia(actor, datos.alumnoId, datos.materiaId)
      await exigirTurnoVigente(actor, datos.alumnoId, datos.materiaId, fechaHoy)
      await exigirSinPendiente(datos.alumnoId, datos.materiaId, fechaHoy)

      const examen = await repository.crear(datos, actor)
      return aDetalle(examen, fechaHoy)
    },

    /**
     * Edición parcial. Si cambia la materia, se revalida que esté activa y, si es otra que la que
     * tenía, que el alumno tenga algún turno vigente en ella (la propia se conserva aunque ya no
     * tenga turnos); si cambia la materia o la
     * fecha, se vuelve a chequear el pendiente (sin contar el propio examen). El permiso de
     * `PROFESOR` se chequea contra la materia resultante (la nueva, si cambia).
     */
    async editar(id: number, cambios: EditarExamen, actor: Actor): Promise<ExamenDetalle> {
      const fechaHoy = hoy(reloj)
      const actual = await repository.buscarPorId(id)
      if (!actual) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)

      const materiaId = cambios.materiaId ?? actual.materiaId
      if (cambios.materiaId !== undefined) await exigirMateriaActiva(materiaId)
      await exigirMateriaPropia(actor, actual.alumnoId, materiaId)
      if (materiaId !== actual.materiaId) {
        await exigirTurnoVigente(actor, actual.alumnoId, materiaId, fechaHoy)
      }
      if (cambios.materiaId !== undefined || cambios.fecha !== undefined) {
        await exigirSinPendiente(actual.alumnoId, materiaId, fechaHoy, id)
      }

      const examen = await repository.actualizar(id, cambios, actor)
      return aDetalle(examen, fechaHoy)
    },

    /** Baja lógica ("eliminar" en la HU, con confirmación en el front). */
    async darDeBaja(id: number, actor: Actor): Promise<ExamenDetalle> {
      const fechaHoy = hoy(reloj)
      const actual = await repository.buscarPorId(id)
      if (!actual) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)

      await exigirMateriaPropia(actor, actual.alumnoId, actual.materiaId)

      const examen = await repository.darDeBaja(id, actor)
      return aDetalle(examen, fechaHoy)
    },
  }
}

export type ExamenesService = ReturnType<typeof crearExamenesService>
