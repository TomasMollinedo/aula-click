import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ConflictError, NotFoundError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { armarAuditoria, SELECT_USUARIO_AUDITORIA } from '@/server/shared/auditoria'
import { minutosAHora } from '@/server/shared/zod'
import type {
  Bloque,
  BloqueConAula,
  BloqueDeProfesor,
  BloqueDetalleGuardado,
  BloqueGuardado,
  DatosCrearBloques,
  DatosEditarBloque,
} from './bloques.validation'

// Único lugar de la feature que usa Prisma. El catálogo de aulas es de la feature `aulas` (que lo
// lee en `aulas.repository`); acá solo se lee `Aula` dentro de las transacciones del alta y la
// edición (existencia y `SELECT ... FOR UPDATE`), porque eso tiene que ser atómico con el
// `INSERT`/`UPDATE`. Sin reglas de negocio propias: las de profesor (activo, con materias) y
// turnos vigentes las decide el service con lecturas de `profesores.repository` y
// `turnos.repository`. Lo que sí vive acá es lo que tiene que ser atómico con la escritura
// (superposición y ocupación del aula), porque no hay forma de garantizarlo si se separa.

const MENSAJE_AULA_OCUPADA =
  'No hay un aula disponible en ese horario. Por favor, elija otro horario.'

const SELECT_BLOQUE_GUARDADO = {
  id: true,
  profesorId: true,
  aulaId: true,
  diaSemana: true,
  horaInicio: true,
  horaFin: true,
  estado: true,
} satisfies Prisma.BloqueAgendaSelect

type ConflictoFila = {
  id: number
  horaInicio: number
  horaFin: number
  profesorId: number
  aulaId: number
}

/**
 * Filas activas que ya ocupan alguna de `horasPedidas` ese día, opcionalmente solo las del
 * profesor y/o el aula dados. `excluirId` saca una fila de la búsqueda (la propia, al editar).
 * Es la **única** definición de "hora ocupada": la usan el alta y la edición (dentro de su
 * transacción) y la lectura de aulas ocupadas que consume `aulas` (con el cliente común).
 */
async function buscarConflictos(
  db: Prisma.TransactionClient,
  filtro: {
    diaSemana: number
    horasPedidas: number[]
    profesorId?: number
    aulaId?: number
    excluirId?: number
  },
): Promise<ConflictoFila[]> {
  return db.bloqueAgenda.findMany({
    where: {
      diaSemana: filtro.diaSemana,
      estado: 'ACTIVO',
      horaInicio: { in: filtro.horasPedidas },
      ...(filtro.profesorId === undefined ? {} : { profesorId: filtro.profesorId }),
      ...(filtro.aulaId === undefined ? {} : { aulaId: filtro.aulaId }),
      ...(filtro.excluirId === undefined ? {} : { id: { not: filtro.excluirId } }),
    },
    select: { id: true, horaInicio: true, horaFin: true, profesorId: true, aulaId: true },
  })
}

function errorSuperpuesto(diaSemana: number, conflictos: ConflictoFila[]): ConflictError {
  return new ConflictError('El profesor ya tiene un bloque en ese horario', {
    code: 'BLOQUE_SUPERPUESTO',
    details: conflictos.map((conflicto) => ({
      diaSemana,
      horaInicio: minutosAHora(conflicto.horaInicio),
      horaFin: minutosAHora(conflicto.horaFin),
      bloqueExistenteId: conflicto.id,
    })),
  })
}

function errorAulaOcupada(diaSemana: number, conflictos: ConflictoFila[]): ConflictError {
  return new ConflictError(MENSAJE_AULA_OCUPADA, {
    code: 'AULA_OCUPADA',
    details: conflictos.map((conflicto) => ({
      diaSemana,
      horaInicio: minutosAHora(conflicto.horaInicio),
      horaFin: minutosAHora(conflicto.horaFin),
      profesorId: conflicto.profesorId,
    })),
  })
}

export const bloquesRepository = {
  /**
   * Filas activas del profesor, ordenadas por día y hora (es un horario semanal: sin paginar,
   * T-17 punto 1). Trae la capacidad del aula (no la ocupación: eso lo agrega el service, leyendo
   * `turnos.repository`) para que el service calcule la capacidad efectiva de cada hora.
   */
  async listarPorProfesor(profesorId: number): Promise<BloqueConAula[]> {
    const filas = await prisma.bloqueAgenda.findMany({
      where: { profesorId, estado: 'ACTIVO' },
      select: {
        id: true,
        diaSemana: true,
        horaInicio: true,
        horaFin: true,
        aula: { select: { id: true, nombre: true, capacidad: true } },
      },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    })
    return filas.map((fila) => ({
      id: fila.id,
      diaSemana: fila.diaSemana,
      horaInicio: fila.horaInicio,
      horaFin: fila.horaFin,
      aula: fila.aula,
    }))
  },

  /**
   * Filas activas de esos profesores (opcionalmente de un solo día), con el aula y la capacidad
   * del profesor, en una sola consulta, ordenadas por profesor, día y hora. Lectura para otras
   * features: la usa `turnos` para la disponibilidad (HU-07).
   */
  async listarActivasDeProfesores(filtro: {
    profesorIds: number[]
    diaSemana?: number
  }): Promise<BloqueDeProfesor[]> {
    if (filtro.profesorIds.length === 0) return []
    const filas = await prisma.bloqueAgenda.findMany({
      where: {
        profesorId: { in: filtro.profesorIds },
        estado: 'ACTIVO',
        ...(filtro.diaSemana === undefined ? {} : { diaSemana: filtro.diaSemana }),
      },
      select: {
        id: true,
        profesorId: true,
        diaSemana: true,
        horaInicio: true,
        horaFin: true,
        aula: { select: { id: true, nombre: true, capacidad: true } },
        profesor: { select: { capacidad: true } },
      },
      orderBy: [{ profesorId: 'asc' }, { diaSemana: 'asc' }, { horaInicio: 'asc' }],
    })
    return filas.map(({ profesor, ...fila }) => ({
      ...fila,
      profesorCapacidad: profesor.capacidad,
    }))
  },

  /**
   * Crea una fila por cada hora pedida, todas o ninguna, en una única transacción que bloquea
   * (`SELECT ... FOR UPDATE`) primero la fila del `Profesor` y después la del `Aula` —siempre en
   * ese orden, para que dos altas simultáneas nunca se bloqueen entre sí en orden cruzado—, vuelve
   * a chequear los conflictos con los locks ya tomados y recién ahí inserta.
   *
   * Lanza `NotFoundError` si el aula no existe, y `ConflictError` si alguna hora pedida ya está
   * tomada: `BLOQUE_SUPERPUESTO` si es el mismo profesor, `AULA_OCUPADA` si es la misma aula (de
   * cualquier profesor). Reporta **todas** las horas en conflicto, no solo la primera.
   * Auditoría: `createdById` y `updatedById` con el actor.
   */
  async crearBloques(datos: DatosCrearBloques, actor: Actor): Promise<Bloque[]> {
    const { profesorId, aulaId, diaSemana, horas } = datos
    const horasPedidas = horas.map((hora) => hora.horaInicio)

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM profesor WHERE id = ${profesorId} FOR UPDATE`

      const aulaLock = await tx.$queryRaw<{ id: number; nombre: string }[]>`
        SELECT id, nombre FROM aula WHERE id = ${aulaId} FOR UPDATE
      `
      const aula = aulaLock[0]
      if (!aula) throw new NotFoundError('Aula no encontrada')

      const conflictosProfesor = await buscarConflictos(tx, { diaSemana, horasPedidas, profesorId })
      if (conflictosProfesor.length > 0) throw errorSuperpuesto(diaSemana, conflictosProfesor)

      const conflictosAula = await buscarConflictos(tx, { diaSemana, horasPedidas, aulaId })
      if (conflictosAula.length > 0) throw errorAulaOcupada(diaSemana, conflictosAula)

      const filas = await Promise.all(
        horas.map((hora) =>
          tx.bloqueAgenda.create({
            data: {
              profesorId,
              aulaId,
              diaSemana,
              horaInicio: hora.horaInicio,
              horaFin: hora.horaFin,
              createdById: actor.userId,
              updatedById: actor.userId,
            },
            select: { id: true, diaSemana: true, horaInicio: true, horaFin: true },
          }),
        ),
      )
      return filas.map((fila) => ({
        id: fila.id,
        diaSemana: fila.diaSemana,
        horaInicio: minutosAHora(fila.horaInicio),
        horaFin: minutosAHora(fila.horaFin),
        aula: { id: aulaId, nombre: aula.nombre },
      }))
    })
  },

  /**
   * Ids de las aulas con alguna fila activa en alguna de `horasPedidas` (minutos de inicio) ese
   * día, de cualquier profesor, sin repetir. `excluirBloqueId` saca esa fila de la cuenta (la
   * edición: la propia fila no ocupa su aula). Lectura para otras features: la usa `aulas`
   * (aulas disponibles, T-17) y la va a usar `turnos` (T-21). No bloquea filas: es para mostrar
   * opciones; el alta y la edición vuelven a chequear con lock.
   */
  async aulasOcupadas(filtro: {
    diaSemana: number
    horasPedidas: number[]
    excluirBloqueId?: number
  }): Promise<number[]> {
    const filas = await buscarConflictos(prisma, {
      diaSemana: filtro.diaSemana,
      horasPedidas: filtro.horasPedidas,
      excluirId: filtro.excluirBloqueId,
    })
    return [...new Set(filas.map((fila) => fila.aulaId))]
  },

  /**
   * La fila para su detalle, activa o no (también se puede ver una hora dada de baja), con el aula,
   * el profesor (su nombre es el de su `Usuario`) y la auditoría. `null` si no existe.
   */
  async buscarDetalle(id: number): Promise<BloqueDetalleGuardado | null> {
    const fila = await prisma.bloqueAgenda.findUnique({
      where: { id },
      select: {
        id: true,
        diaSemana: true,
        horaInicio: true,
        horaFin: true,
        estado: true,
        aula: { select: { id: true, nombre: true, capacidad: true } },
        profesor: {
          select: {
            id: true,
            capacidad: true,
            usuario: { select: { nombre: true, apellido: true } },
          },
        },
        createdAt: true,
        updatedAt: true,
        createdBy: { select: SELECT_USUARIO_AUDITORIA },
        updatedBy: { select: SELECT_USUARIO_AUDITORIA },
      },
    })
    if (!fila) return null
    return {
      id: fila.id,
      diaSemana: fila.diaSemana,
      horaInicio: fila.horaInicio,
      horaFin: fila.horaFin,
      estado: fila.estado,
      aula: fila.aula,
      profesor: {
        id: fila.profesor.id,
        nombre: fila.profesor.usuario.nombre,
        apellido: fila.profesor.usuario.apellido,
        capacidad: fila.profesor.capacidad,
      },
      ...armarAuditoria(fila),
    }
  },

  /** La fila con sus datos en minutos, o `null` si no existe. Para editar o dar de baja. */
  async buscarPorId(id: number): Promise<BloqueGuardado | null> {
    return prisma.bloqueAgenda.findUnique({ where: { id }, select: SELECT_BLOQUE_GUARDADO })
  },

  /**
   * Las filas con esos ids, activas o no, con sus datos en minutos. Las que no existen no vienen:
   * quien llama compara. Para la baja de varias horas juntas.
   */
  async buscarPorIds(ids: number[]): Promise<BloqueGuardado[]> {
    return prisma.bloqueAgenda.findMany({
      where: { id: { in: ids } },
      select: SELECT_BLOQUE_GUARDADO,
    })
  },

  /**
   * Edita día, horario y/o aula de una fila (una hora), en una transacción con el mismo esquema
   * de locks que `crearBloques` (profesor primero, aula después) y excluyendo la propia fila de
   * los chequeos de superposición y ocupación. Mismos errores que el alta; `NotFoundError` también
   * si la fila ya no existe (P2025 al actualizar).
   */
  async editarBloque(id: number, datos: DatosEditarBloque, actor: Actor): Promise<Bloque> {
    const { diaSemana, horaInicio, horaFin, aulaId } = datos

    return prisma.$transaction(async (tx) => {
      const actual = await tx.bloqueAgenda.findUnique({
        where: { id },
        select: { profesorId: true },
      })
      if (!actual) throw new NotFoundError('Bloque no encontrado')
      const { profesorId } = actual

      await tx.$queryRaw`SELECT id FROM profesor WHERE id = ${profesorId} FOR UPDATE`

      const aulaLock = await tx.$queryRaw<{ id: number; nombre: string }[]>`
        SELECT id, nombre FROM aula WHERE id = ${aulaId} FOR UPDATE
      `
      const aula = aulaLock[0]
      if (!aula) throw new NotFoundError('Aula no encontrada')

      const conflictosProfesor = await buscarConflictos(tx, {
        diaSemana,
        horasPedidas: [horaInicio],
        profesorId,
        excluirId: id,
      })
      if (conflictosProfesor.length > 0) throw errorSuperpuesto(diaSemana, conflictosProfesor)

      const conflictosAula = await buscarConflictos(tx, {
        diaSemana,
        horasPedidas: [horaInicio],
        aulaId,
        excluirId: id,
      })
      if (conflictosAula.length > 0) throw errorAulaOcupada(diaSemana, conflictosAula)

      const fila = await tx.bloqueAgenda.update({
        where: { id },
        data: { diaSemana, horaInicio, horaFin, aulaId, updatedById: actor.userId },
        select: { id: true, diaSemana: true, horaInicio: true, horaFin: true },
      })
      return {
        id: fila.id,
        diaSemana: fila.diaSemana,
        horaInicio: minutosAHora(fila.horaInicio),
        horaFin: minutosAHora(fila.horaFin),
        aula: { id: aulaId, nombre: aula.nombre },
      }
    })
  },

  /**
   * Baja lógica (`estado = INACTIVO`), nunca borrado físico. El service ya validó que no tenga
   * turnos vigentes; acá no se repite esa lectura, así que una reserva simultánea (T-21) se
   * puede colar entre el chequeo y el `UPDATE` (carrera conocida, anotada en su issue: lo mismo
   * vale para la edición y la baja de varias horas). Idempotente: si ya estaba
   * `INACTIVO`, el `UPDATE` no cambia nada. `NotFoundError` si la fila no existe (P2025).
   */
  async eliminarBloque(id: number, actor: Actor): Promise<Bloque> {
    try {
      const fila = await prisma.bloqueAgenda.update({
        where: { id },
        data: { estado: 'INACTIVO', updatedById: actor.userId },
        select: {
          diaSemana: true,
          horaInicio: true,
          horaFin: true,
          aula: { select: { id: true, nombre: true } },
        },
      })
      return {
        id,
        diaSemana: fila.diaSemana,
        horaInicio: minutosAHora(fila.horaInicio),
        horaFin: minutosAHora(fila.horaFin),
        aula: fila.aula,
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundError('Bloque no encontrado', { cause: error })
      }
      throw error
    }
  },

  /**
   * Baja lógica (`estado = INACTIVO`) de varias filas, todas o ninguna, en una transacción, con
   * el mismo criterio que `eliminarBloque`: el service ya validó que existan, estén activas, sean
   * del mismo profesor y no tengan turnos vigentes, y acá no se repite la lectura de turnos. Si
   * entre la validación y el `UPDATE` alguna fila dejó de estar activa (otra baja simultánea), no
   * se actualiza ninguna y se lanza `NotFoundError`. Devuelve las filas ordenadas por día y hora.
   * Auditoría: `updatedById` con el actor.
   */
  async eliminarBloques(ids: number[], actor: Actor): Promise<Bloque[]> {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.bloqueAgenda.updateMany({
        where: { id: { in: ids }, estado: 'ACTIVO' },
        data: { estado: 'INACTIVO', updatedById: actor.userId },
      })
      if (count !== ids.length) throw new NotFoundError('Bloque no encontrado')

      const filas = await tx.bloqueAgenda.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          diaSemana: true,
          horaInicio: true,
          horaFin: true,
          aula: { select: { id: true, nombre: true } },
        },
        orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }, { id: 'asc' }],
      })
      return filas.map((fila) => ({
        id: fila.id,
        diaSemana: fila.diaSemana,
        horaInicio: minutosAHora(fila.horaInicio),
        horaFin: minutosAHora(fila.horaFin),
        aula: fila.aula,
      }))
    })
  },
}

export type BloquesRepository = typeof bloquesRepository
