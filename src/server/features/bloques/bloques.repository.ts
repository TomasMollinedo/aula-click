import { prisma } from '@/lib/prisma'
import { ConflictError, NotFoundError } from '@/server/errors'
import type { Actor } from '@/server/shared/actor'
import { minutosAHora } from '@/server/shared/zod'
import type { BloqueCreado, DatosCrearBloques } from './bloques.validation'

// Único lugar de la feature que usa Prisma. También lee `Aula` directo (`prisma.aula`): todavía
// no tiene una feature propia (T-17 punto 2 la va a crear, sólo de lectura, y va a leer de acá).
// Sin reglas de negocio propias: las de profesor (activo, con materias) las decide el service con
// una lectura de `profesores.repository`. Lo que sí vive acá es lo que tiene que ser atómico con
// el `INSERT` (superposición y ocupación), porque no hay forma de garantizarlo si se separa.

const MENSAJE_AULA_OCUPADA =
  'No hay un aula disponible en ese horario. Por favor, elija otro horario.'

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
  async crearBloques(datos: DatosCrearBloques, actor: Actor): Promise<BloqueCreado[]> {
    const { profesorId, aulaId, diaSemana, horas } = datos
    const horasPedidas = horas.map((hora) => hora.horaInicio)

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM profesor WHERE id = ${profesorId} FOR UPDATE`

      const aulaLock = await tx.$queryRaw<{ id: number; nombre: string }[]>`
        SELECT id, nombre FROM aula WHERE id = ${aulaId} FOR UPDATE
      `
      const aula = aulaLock[0]
      if (!aula) throw new NotFoundError('Aula no encontrada')

      const conflictosProfesor = await tx.bloqueAgenda.findMany({
        where: { profesorId, diaSemana, estado: 'ACTIVO', horaInicio: { in: horasPedidas } },
        select: { id: true, horaInicio: true, horaFin: true },
      })
      if (conflictosProfesor.length > 0) {
        throw new ConflictError('El profesor ya tiene un bloque en ese horario', {
          code: 'BLOQUE_SUPERPUESTO',
          details: conflictosProfesor.map((conflicto) => ({
            diaSemana,
            horaInicio: minutosAHora(conflicto.horaInicio),
            horaFin: minutosAHora(conflicto.horaFin),
            bloqueExistenteId: conflicto.id,
          })),
        })
      }

      const conflictosAula = await tx.bloqueAgenda.findMany({
        where: { aulaId, diaSemana, estado: 'ACTIVO', horaInicio: { in: horasPedidas } },
        select: { id: true, horaInicio: true, horaFin: true, profesorId: true },
      })
      if (conflictosAula.length > 0) {
        throw new ConflictError(MENSAJE_AULA_OCUPADA, {
          code: 'AULA_OCUPADA',
          details: conflictosAula.map((conflicto) => ({
            diaSemana,
            horaInicio: minutosAHora(conflicto.horaInicio),
            horaFin: minutosAHora(conflicto.horaFin),
            profesorId: conflicto.profesorId,
          })),
        })
      }

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
}

export type BloquesRepository = typeof bloquesRepository
