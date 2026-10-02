import { prisma } from '@/lib/prisma'
import { ConflictError } from '@/server/errors'
import {
  bloquearParaReserva,
  leerOcurrencias,
  ocupacionEn,
  superposicionesDelAlumno,
  type ClienteOcurrencias,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Actor } from '@/server/shared/actor'
import { fechaADate, type Reloj } from '@/server/shared/fechas'
import { MENSAJE_TURNO_CAMBIO } from './reprogramaciones.reglas'
import type {
  EntradaReprogramacion,
  PlanReprogramacion,
  SnapshotReprogramacion,
} from './reprogramaciones.validation'

// Único lugar de la feature que usa Prisma. Sin reglas de negocio: qué se puede mover y cómo se
// parte la serie lo decide `planificarReprogramacion` (`reprogramaciones.reglas.ts`), que el
// service pasa como callback `planificar`. La ocurrencia, la ocupación y la superposición salen del
// motor de `turnos` (`ocurrencias.condiciones.ts`), nunca de una expansión propia.

/**
 * Timeout más largo que el default de Prisma (5 s): con escrituras simultáneas sobre la misma
 * hora o el mismo alumno, la espera del lock cuenta dentro de la transacción (igual que la
 * reserva y el pago).
 */
const TRANSACCION_REPROGRAMACION = { timeout: 10_000 } as const

/**
 * Lee, con los locks ya tomados, todo lo que `planificarReprogramacion` necesita. La ocupación y la
 * superposición **no cuentan la ocurrencia que se mueve** (`excluir`).
 */
async function leerSnapshot(
  tx: ClienteOcurrencias,
  entrada: EntradaReprogramacion,
  reloj?: Reloj,
): Promise<SnapshotReprogramacion> {
  const { turnoId, fecha, alumnoId, bloqueDestinoId, profesorDestinoId, fechaDestino } = entrada
  const excluir = { turnoId, fecha }

  const [ocurrencia] = await leerOcurrencias(
    tx,
    { desde: fecha, hasta: fecha, turnoIds: [turnoId] },
    reloj,
  )
  const turno = await tx.turno.findUnique({
    where: { id: turnoId },
    select: {
      materiaId: true,
      observaciones: true,
      temas: true,
      finalizacion: { select: { id: true } },
    },
  })
  const destino = await tx.bloqueAgenda.findUnique({
    where: { id: bloqueDestinoId },
    select: {
      id: true,
      estado: true,
      profesorId: true,
      diaSemana: true,
      horaInicio: true,
      horaFin: true,
      aula: { select: { capacidad: true } },
    },
  })
  const profesor = await tx.profesor.findUnique({
    where: { id: profesorDestinoId },
    select: {
      id: true,
      capacidad: true,
      usuario: { select: { estado: true, apellido: true } },
    },
  })
  const materia = turno
    ? await tx.materia.findUnique({ where: { id: turno.materiaId }, select: { estado: true } })
    : null
  const asignacion = turno
    ? await tx.asignacionMateria.findUnique({
        where: {
          profesorId_materiaId: { profesorId: profesorDestinoId, materiaId: turno.materiaId },
        },
        select: { estado: true },
      })
    : null

  // Lo que la ocurrencia dejó libre en su origen se ve porque `excluir` la saca de la cuenta.
  const ocupacionDestino = await ocupacionEn(tx, {
    bloqueAgendaId: bloqueDestinoId,
    fecha: fechaDestino,
    excluir,
  })
  const superpuestas = destino
    ? await superposicionesDelAlumno(
        tx,
        {
          alumnoId,
          fecha: fechaDestino,
          horaInicio: destino.horaInicio,
          horaFin: destino.horaFin,
          excluir,
        },
        reloj,
      )
    : []

  return {
    ocurrencia: ocurrencia ?? null,
    turno: turno && {
      observaciones: turno.observaciones,
      temas: turno.temas,
      tieneFinalizacion: turno.finalizacion !== null,
    },
    destino: destino && {
      id: destino.id,
      estado: destino.estado,
      profesorId: destino.profesorId,
      diaSemana: destino.diaSemana,
      horaInicio: destino.horaInicio,
      horaFin: destino.horaFin,
      aulaCapacidad: destino.aula.capacidad,
    },
    profesor: profesor && {
      id: profesor.id,
      capacidad: profesor.capacidad,
      estado: profesor.usuario.estado,
      apellido: profesor.usuario.apellido,
    },
    materia,
    asignacion,
    ocupacionDestino,
    superpuestas,
  }
}

export const reprogramacionesRepository = {
  /**
   * Reprograma una ocurrencia de forma atómica: todo o nada, en una sola transacción. Las reglas
   * las decide `planificar` (callback puro que pasa el service); acá sólo se garantiza que decida
   * sobre datos que nadie puede cambiar hasta el commit.
   *
   * 1. Locks con `bloquearParaReserva` (profesor del destino `FOR SHARE`, las horas de origen y
   *    destino por id `FOR UPDATE` y el alumno `FOR UPDATE`), **antes de cualquier lectura**.
   * 2. Relee con los locks (`leerSnapshot`). Si el turno ya no está en la hora de origen que
   *    leyó el service (otra reprogramación lo movió antes del lock), 409: los locks tomados ya
   *    no son los que corresponden.
   * 3. `planificar(snapshot)`: si lanza, no se escribe nada.
   * 4. Aplica el plan: crea el tramo nuevo y la sesión única (creador = actor), edita el original
   *    (`updatedById` = actor; `updatedAt` lo pone Prisma) y re-apunta cancelaciones, pagos y
   *    finalización.
   *
   * Devuelve el id del turno de la fecha movida y el texto del cambio.
   */
  async reprogramar(
    entrada: EntradaReprogramacion,
    planificar: (snapshot: SnapshotReprogramacion) => PlanReprogramacion,
    actor: Actor,
    reloj?: Reloj,
  ): Promise<{ turnoId: number; cambio: string }> {
    const { turnoId, fecha, alumnoId, bloqueOrigenId, bloqueDestinoId, fechaDestino } = entrada

    return prisma.$transaction(async (tx) => {
      await bloquearParaReserva(tx, {
        profesorId: entrada.profesorDestinoId,
        bloqueAgendaIds: [bloqueOrigenId, bloqueDestinoId],
        alumnoId,
      })

      const snapshot = await leerSnapshot(tx, entrada, reloj)
      if (snapshot.ocurrencia && snapshot.ocurrencia.bloqueAgendaId !== bloqueOrigenId) {
        throw new ConflictError(MENSAJE_TURNO_CAMBIO)
      }
      const plan = planificar(snapshot)
      // `planificar` ya verificó que la ocurrencia y el turno existen.
      const ocurrencia = snapshot.ocurrencia
      const turno = snapshot.turno
      if (!ocurrencia || !turno) throw new ConflictError(MENSAJE_TURNO_CAMBIO)

      const auditoria = { createdById: actor.userId, updatedById: actor.userId }
      const copia = {
        alumnoId: ocurrencia.alumnoId,
        materiaId: ocurrencia.materiaId,
        estado: 'ACTIVO' as const,
        observaciones: turno.observaciones,
        temas: turno.temas,
        ...auditoria,
      }

      const tramo = plan.tramoNuevo
        ? await tx.turno.create({
            data: {
              ...copia,
              bloqueAgendaId: ocurrencia.bloqueAgendaId,
              tipo: 'RECURRENTE',
              serieId: plan.tramoNuevo.serieId,
              fechaInicio: fechaADate(plan.tramoNuevo.fechaInicio),
              fechaFin: plan.tramoNuevo.fechaFin && fechaADate(plan.tramoNuevo.fechaFin),
            },
            select: { id: true },
          })
        : null
      const sesion = plan.sesionNueva
        ? await tx.turno.create({
            data: {
              ...copia,
              bloqueAgendaId: bloqueDestinoId,
              tipo: 'SESION_UNICA',
              serieId: null,
              fechaInicio: fechaADate(fechaDestino),
              fechaFin: fechaADate(fechaDestino),
            },
            select: { id: true },
          })
        : null

      const { original } = plan
      await tx.turno.update({
        where: { id: turnoId },
        data: {
          ...(original.tipo === undefined ? {} : { tipo: original.tipo }),
          ...(original.bloqueAgendaId === undefined
            ? {}
            : { bloqueAgendaId: original.bloqueAgendaId }),
          ...(original.fechaInicio === undefined
            ? {}
            : { fechaInicio: fechaADate(original.fechaInicio) }),
          ...(original.fechaFin === undefined
            ? {}
            : { fechaFin: original.fechaFin && fechaADate(original.fechaFin) }),
          ...(original.serieId === undefined ? {} : { serieId: original.serieId }),
          updatedById: actor.userId,
        },
      })

      // Las fechas posteriores a la movida pasan al tramo nuevo con el resto de la serie.
      if (tramo && plan.reapuntarPosterioresAlTramo) {
        const posteriores = { turnoId, fechaOcurrencia: { gt: fechaADate(fecha) } }
        await tx.cancelacionTurno.updateMany({ where: posteriores, data: { turnoId: tramo.id } })
        await tx.pagoTurno.updateMany({ where: posteriores, data: { turnoId: tramo.id } })
      }
      if (tramo && plan.finalizacionAlTramo) {
        await tx.finalizacionRecurrencia.updateMany({
          where: { turnoId },
          data: { turnoId: tramo.id },
        })
      }
      if (plan.borrarFinalizacion) {
        await tx.finalizacionRecurrencia.deleteMany({ where: { turnoId } })
      }

      // El pago acompaña a la ocurrencia: al turno resultante, con la fecha nueva.
      const turnoResultante = sesion?.id ?? turnoId
      if (plan.moverPago) {
        await tx.pagoTurno.updateMany({
          where: { turnoId, fechaOcurrencia: fechaADate(fecha) },
          data: { turnoId: turnoResultante, fechaOcurrencia: fechaADate(fechaDestino) },
        })
      }

      return { turnoId: turnoResultante, cambio: plan.cambio }
    }, TRANSACCION_REPROGRAMACION)
  },
}

export type ReprogramacionesRepository = typeof reprogramacionesRepository
