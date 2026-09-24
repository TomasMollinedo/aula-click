import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ConflictError, NotFoundError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { minutosAHora } from '@/server/shared/zod'
import type {
  Bloque,
  BloqueGuardado,
  DatosCrearBloques,
  DatosEditarBloque,
} from './bloques.validation'

// Único lugar de la feature que usa Prisma. También lee `Aula` directo (`prisma.aula`): todavía
// no tiene una feature propia (T-17 punto 2 la va a crear, sólo de lectura, y va a leer de acá).
// Sin reglas de negocio propias: las de profesor (activo, con materias) y turnos vigentes las
// decide el service con lecturas de `profesores.repository` y `turnos.repository`. Lo que sí vive
// acá es lo que tiene que ser atómico con el `INSERT`/`UPDATE` (superposición y ocupación), porque
// no hay forma de garantizarlo si se separa.

const MENSAJE_AULA_OCUPADA =
  'No hay un aula disponible en ese horario. Por favor, elija otro horario.'

type ConflictoFila = { id: number; horaInicio: number; horaFin: number; profesorId: number }

/**
 * Filas activas que ya ocupan alguna de `horasPedidas` ese día, para el profesor y/o el aula
 * dados (al menos uno de los dos). `excluirId` saca la propia fila de la búsqueda (edición).
 */
async function buscarConflictos(
  tx: Prisma.TransactionClient,
  filtro: {
    diaSemana: number
    horasPedidas: number[]
    profesorId?: number
    aulaId?: number
    excluirId?: number
  },
): Promise<ConflictoFila[]> {
  return tx.bloqueAgenda.findMany({
    where: {
      diaSemana: filtro.diaSemana,
      estado: 'ACTIVO',
      horaInicio: { in: filtro.horasPedidas },
      ...(filtro.profesorId === undefined ? {} : { profesorId: filtro.profesorId }),
      ...(filtro.aulaId === undefined ? {} : { aulaId: filtro.aulaId }),
      ...(filtro.excluirId === undefined ? {} : { id: { not: filtro.excluirId } }),
    },
    select: { id: true, horaInicio: true, horaFin: true, profesorId: true },
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

  /** La fila con sus datos en minutos, o `null` si no existe. Para editar o dar de baja. */
  async buscarPorId(id: number): Promise<BloqueGuardado | null> {
    return prisma.bloqueAgenda.findUnique({
      where: { id },
      select: {
        id: true,
        profesorId: true,
        aulaId: true,
        diaSemana: true,
        horaInicio: true,
        horaFin: true,
        estado: true,
      },
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
   * turnos ni excepciones vigentes; acá no se repite esa lectura (no hay ningún escritor
   * concurrente de turnos todavía: T-21 no está implementado). Idempotente: si ya estaba
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
}

export type BloquesRepository = typeof bloquesRepository
