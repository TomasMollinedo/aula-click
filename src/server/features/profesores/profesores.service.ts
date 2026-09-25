import { ConflictError, NotFoundError } from '@/server/errors'
import type { MateriasRepository } from '@/server/features/materias/materias.repository'
import type { TurnosRepository } from '@/server/features/turnos/turnos.repository'
import type {
  OcupacionMaximaPorFila,
  TurnosVigentesPorMateria,
  TurnoVigentePorProfesor,
} from '@/server/features/turnos/turnos.condiciones'
import type { Actor } from '@/server/shared/actor'
import { normalizarBusqueda, terminosDeBusqueda } from '@/server/shared/busqueda'
import { detallesPorPosicion } from '@/server/shared/detalles'
import { hoy, type Reloj } from '@/server/shared/fechas'
import type { ProfesoresRepository } from './profesores.repository'
import type {
  AsignarMaterias,
  CrearProfesor,
  EditarProfesor,
  FotoMimeType,
  ListarProfesoresQuery,
  MateriasAsignadas,
  ProfesorDetalle,
  ProfesorGuardado,
  ProfesorListadoFila,
  ProfesorListadoItem,
  ProfesoresListado,
  QuitarMaterias,
} from './profesores.validation'

const MENSAJE_NO_ENCONTRADO = 'Profesor no encontrado'
const MENSAJE_CAPACIDAD_INSUFICIENTE =
  'La capacidad no puede ser menor que la cantidad de turnos que el profesor ya tiene a la vez en una hora'

/** `YYYY-MM-DD` → `DD/MM`. */
function diaMes(fecha: string): string {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`
}

/**
 * 409 `CAPACIDAD_INSUFICIENTE` (T-15) si `capacidad` es menor que la ocupación simultánea máxima
 * de alguna hora del profesor desde hoy (la mayor cantidad de turnos que ocupan lugar en una
 * misma fecha, la misma cuenta que `BLOQUE_LLENO`). `details`: una entrada por hora en
 * conflicto, sobre el campo `capacidad`, con la hora, la fecha y la cantidad.
 */
function exigirCapacidadSuficiente(capacidad: number, porFila: OcupacionMaximaPorFila[]): void {
  const conflictos = porFila.filter((fila) => fila.cantidad > capacidad)
  if (conflictos.length === 0) return
  throw new ConflictError(MENSAJE_CAPACIDAD_INSUFICIENTE, {
    code: 'CAPACIDAD_INSUFICIENTE',
    details: conflictos.map((fila) => ({
      path: ['capacidad'],
      message: `El ${diaMes(fila.fecha)}, la hora de ${fila.horaInicio} a ${fila.horaFin} ya tiene ${fila.cantidad} ${fila.cantidad === 1 ? 'turno' : 'turnos'} a la vez`,
      ...fila,
    })),
  })
}

/** 409 `TURNOS_VIGENTES` con cada turno en `details` si el profesor tiene alguno. */
function exigirSinTurnosVigentes(turnos: TurnoVigentePorProfesor[]): void {
  if (turnos.length > 0) {
    throw new ConflictError('No se puede dar de baja un profesor con turnos vigentes', {
      code: 'TURNOS_VIGENTES',
      details: turnos,
    })
  }
}

// Mismo formato que el seed y alumnos usan para los usuarios: apellido, nombre y DNI.
function calcularBusqueda(datos: { apellido: string; nombre: string; dni: string }): string {
  return normalizarBusqueda(`${datos.apellido} ${datos.nombre} ${datos.dni}`)
}

// Solo los campos que vienen en la edición (undefined = no cambia).
function sinOmitidos<T extends object>(cambios: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(cambios).filter(([, valor]) => valor !== undefined),
  ) as Partial<T>
}

// Reglas de negocio. No conoce HTTP ni Prisma: lanza AppError o sus subclases.

/**
 * Un detalle por cada materia pedida que cumple `condicion` (`path` = posición en `materiaIds`):
 * la UI marca cada materia igual que en un 400.
 */
function detallesDe(
  materiaIds: number[],
  condicion: (id: number) => boolean,
  mensaje: (id: number) => string,
  extra?: (id: number) => Record<string, unknown>,
) {
  return detallesPorPosicion('materiaIds', materiaIds, condicion, mensaje, extra)
}

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo (`reloj` opcional: por defecto el del sistema, vía
 * `hoy(reloj)`). Los importa solo como tipo, así el service no carga Prisma ni `@/config/env`.
 * De `materias` y `turnos` solo lee: nunca usa sus reglas. `getPresignedUrl` se inyecta (en vez de
 * importar `@/lib/storage` directo) por la misma razón: así el service no carga `@/config/env`.
 */
export function crearProfesoresService({
  repository,
  materiasRepository,
  turnosRepository,
  getPresignedUrl,
  reloj,
}: {
  repository: ProfesoresRepository
  materiasRepository: Pick<MateriasRepository, 'buscarPorIds'>
  turnosRepository: Pick<
    TurnosRepository,
    'contarVigentesPorMateria' | 'listarVigentesPorProfesor' | 'ocupacionMaximaPorFila'
  >
  getPresignedUrl: (key: string) => Promise<string>
  reloj?: Reloj
}) {
  /** `avatarKey` (interno) → `fotoUrl` (URL prefirmada, o `null` si no tiene). */
  async function conFotoUrl(profesor: ProfesorGuardado): Promise<ProfesorDetalle> {
    const { avatarKey, ...resto } = profesor
    return { ...resto, fotoUrl: avatarKey ? await getPresignedUrl(avatarKey) : null }
  }

  async function conFotoUrlListado(fila: ProfesorListadoFila): Promise<ProfesorListadoItem> {
    const { avatarKey, ...resto } = fila
    return { ...resto, fotoUrl: avatarKey ? await getPresignedUrl(avatarKey) : null }
  }

  async function listarMateriasAsignadas(profesorId: number): Promise<MateriasAsignadas> {
    const materias = await repository.listarMateriasAsignadas(profesorId)
    if (!materias) throw new NotFoundError('Profesor no encontrado')
    return materias
  }

  return {
    async listar(query: ListarProfesoresQuery): Promise<ProfesoresListado> {
      const { data, meta } = await repository.listar({
        page: query.page,
        pageSize: query.pageSize,
        terminos: terminosDeBusqueda(query.q),
        // `TODOS` es "sin filtro": el repository solo conoce los valores de `Estado`.
        estado: query.estado === 'TODOS' ? undefined : query.estado,
        materiaId: query.materiaId,
      })
      return { data: await Promise.all(data.map(conFotoUrlListado)), meta }
    },

    async obtener(id: number): Promise<ProfesorDetalle> {
      const profesor = await repository.buscarPorId(id)
      if (!profesor) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)
      return conFotoUrl(profesor)
    },

    async crear(datos: CrearProfesor, actor: Actor): Promise<ProfesorDetalle> {
      const profesor = await repository.crear(
        { ...datos, busqueda: calcularBusqueda(datos) },
        actor,
      )
      return conFotoUrl(profesor)
    },

    /**
     * Edición parcial. `busqueda` se recalcula sobre el estado resultante (actual + cambios).
     *
     * Si cambia la capacidad, no puede quedar menor que la ocupación simultánea máxima de alguna
     * hora del profesor desde hoy (409 `CAPACIDAD_INSUFICIENTE`, T-15, decisión T-40). Se chequea
     * antes y el repository lo repite con el lock del profesor tomado.
     */
    async editar(id: number, cambios: EditarProfesor, actor: Actor): Promise<ProfesorDetalle> {
      const actual = await repository.buscarPorId(id)
      if (!actual) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)

      const resultado = { ...actual, ...sinOmitidos(cambios) }
      const { capacidad } = cambios
      let ocupacion: Parameters<typeof repository.actualizar>[3]
      if (capacidad !== undefined) {
        const fechaHoy = hoy(reloj)
        exigirCapacidadSuficiente(
          capacidad,
          await turnosRepository.ocupacionMaximaPorFila(id, fechaHoy),
        )
        ocupacion = {
          fechaHoy,
          verificar: (porFila) => exigirCapacidadSuficiente(capacidad, porFila),
        }
      }
      const profesor = await repository.actualizar(
        id,
        { ...cambios, busqueda: calcularBusqueda(resultado) },
        actor,
        ocupacion,
      )
      return conFotoUrl(profesor)
    },

    /** Sube o reemplaza la foto (JPG o PNG, ya validados por el schema). */
    async subirFoto(id: number, foto: File, actor: Actor): Promise<ProfesorDetalle> {
      // El tipo ya lo validó subirFotoSchema (solo JPG o PNG llegan hasta acá).
      const mimeType = foto.type as FotoMimeType
      const bytes = new Uint8Array(await foto.arrayBuffer())
      const profesor = await repository.actualizarFoto(id, { bytes, mimeType }, actor)
      if (!profesor) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)
      return conFotoUrl(profesor)
    },

    /** Quita la foto, si tiene. Sin foto no es un error: es idempotente. */
    async quitarFoto(id: number, actor: Actor): Promise<ProfesorDetalle> {
      const profesor = await repository.quitarFoto(id, actor)
      if (!profesor) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)
      return conFotoUrl(profesor)
    },

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

      const fechaHoy = hoy(reloj)
      const exigirSinVigentes = (porMateria: TurnosVigentesPorMateria[]) => {
        const vigentes = new Map(porMateria.map(({ materiaId, cantidad }) => [materiaId, cantidad]))
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
      }
      exigirSinVigentes(
        await turnosRepository.contarVigentesPorMateria({ fechaHoy, profesorId, materiaIds }),
      )

      await repository.quitarMaterias(profesorId, materiaIds, actor, {
        fechaHoy,
        verificar: exigirSinVigentes,
      })
      return listarMateriasAsignadas(profesorId)
    },

    /**
     * Baja lógica del profesor: la de su `Usuario` (T-22), que pasa a `INACTIVO` y no puede
     * iniciar sesión. No se permite si tiene turnos vigentes: 409 `TURNOS_VIGENTES` con cada uno
     * en `details` (alumno, materia, fecha y horario). No toca materias, bloques ni el historial
     * de turnos: se conservan tal cual.
     */
    async darDeBaja(id: number, actor: Actor): Promise<ProfesorDetalle> {
      const actual = await repository.buscarPorId(id)
      if (!actual) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)

      const fechaHoy = hoy(reloj)
      exigirSinTurnosVigentes(await turnosRepository.listarVigentesPorProfesor(id, fechaHoy))

      return conFotoUrl(
        await repository.darDeBaja(id, actor, { fechaHoy, verificar: exigirSinTurnosVigentes }),
      )
    },

    /**
     * Reactivación: vuelve el profesor a `ACTIVO`. No revalida nada: sus materias y bloques
     * quedan intactos, y vuelve a estar disponible para agendar turnos.
     */
    async reactivar(id: number, actor: Actor): Promise<ProfesorDetalle> {
      const actual = await repository.buscarPorId(id)
      if (!actual) throw new NotFoundError(MENSAJE_NO_ENCONTRADO)

      return conFotoUrl(await repository.reactivar(id, actor))
    },
  }
}

export type ProfesoresService = ReturnType<typeof crearProfesoresService>
