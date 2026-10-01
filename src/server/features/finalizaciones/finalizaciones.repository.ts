import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ConflictError } from '@/server/errors'
import {
  bloquearAlumno,
  leerOcurrencias,
  type ClienteOcurrencias,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Actor } from '@/server/shared/actor'
import { dateAFecha, fechaADate, hoy, type Reloj } from '@/server/shared/fechas'
import { MENSAJE_YA_FINALIZADO, type SnapshotFinalizacion } from './finalizaciones.reglas'
import type { EntradaFinalizacion, PreviaFinalizacion } from './finalizaciones.validation'

// Único lugar de la feature que usa Prisma. Sin reglas de negocio: qué se puede finalizar lo
// decide `planificarFinalizacion` (`finalizaciones.reglas.ts`), que el service pasa como callback
// `verificar`. Las ocurrencias salen del motor de `turnos` (`ocurrencias.condiciones.ts`), nunca
// de una expansión propia. Nunca se modifica `Turno` (definición C): el fin efectivo lo aplica el
// motor con sólo existir la `FinalizacionRecurrencia`.

/** Timeout más largo que el default de Prisma (5 s): la espera del lock cuenta en la transacción. */
const TRANSACCION_FINALIZACION = { timeout: 10_000 } as const

const maxFecha = (...fechas: string[]) => fechas.reduce((a, b) => (a > b ? a : b))

/**
 * Snapshot de la finalización, en **tres consultas** fijas (una sola si el turno no existe):
 * 1. El turno, con el día de su bloque, si tiene finalización y su último pago.
 * 2. Sus ocurrencias desde la mayor entre hoy y `fechaDesde` (`leerOcurrencias`; las anteriores no
 *    se usan: la vigencia sale de `fechaFin` y la previa filtra `>= fechaDesde`). El motor exige `hasta`: con `fechaFin`, es
 *    `fechaFin`; sin fin, la mayor entre ese `desde` y la fecha del último pago del turno
 *    (después del último pago, lo que se libera ya no cambia).
 * 3. Los tramos posteriores: `RECURRENTE` `ACTIVO` del mismo alumno, materia y hora (mismo
 *    `bloqueAgendaId`, como los arman el alta y la reprogramación), que empiezan después de este,
 *    sin finalización y con `fechaFin` nula o `>=` hoy y `fechaDesde`.
 */
async function leerSnapshot(
  client: ClienteOcurrencias,
  turnoId: number,
  fechaDesde: string,
  reloj?: Reloj,
): Promise<SnapshotFinalizacion> {
  const fila = await client.turno.findUnique({
    where: { id: turnoId },
    select: {
      id: true,
      alumnoId: true,
      materiaId: true,
      bloqueAgendaId: true,
      tipo: true,
      estado: true,
      fechaInicio: true,
      fechaFin: true,
      bloqueAgenda: { select: { diaSemana: true } },
      finalizacion: { select: { id: true } },
      pagoTurnos: {
        orderBy: { fechaOcurrencia: 'desc' },
        take: 1,
        select: { fechaOcurrencia: true },
      },
    },
  })
  if (!fila) return { turno: null, ocurrencias: [], otrosTramos: [] }

  const desde = maxFecha(hoy(reloj), fechaDesde)
  const fechaFin = fila.fechaFin && dateAFecha(fila.fechaFin)
  const ultimoPago = fila.pagoTurnos[0]
  const hasta =
    fechaFin ?? maxFecha(desde, ...(ultimoPago ? [dateAFecha(ultimoPago.fechaOcurrencia)] : []))

  const ocurrencias = await leerOcurrencias(client, { desde, hasta, turnoIds: [turnoId] }, reloj)
  const tramos = await client.turno.findMany({
    where: {
      tipo: 'RECURRENTE',
      estado: 'ACTIVO',
      alumnoId: fila.alumnoId,
      materiaId: fila.materiaId,
      bloqueAgendaId: fila.bloqueAgendaId,
      fechaInicio: { gt: fila.fechaInicio },
      finalizacion: { is: null },
      OR: [{ fechaFin: null }, { fechaFin: { gte: fechaADate(desde) } }],
    },
    select: { id: true, fechaInicio: true, fechaFin: true },
    orderBy: [{ fechaInicio: 'asc' }, { id: 'asc' }],
  })

  return {
    turno: {
      id: fila.id,
      alumnoId: fila.alumnoId,
      tipo: fila.tipo,
      activo: fila.estado === 'ACTIVO',
      fechaInicio: dateAFecha(fila.fechaInicio),
      fechaFin,
      diaSemana: fila.bloqueAgenda.diaSemana,
      tieneFinalizacion: fila.finalizacion !== null,
    },
    ocurrencias: ocurrencias.map((o) => ({
      fecha: o.fecha,
      horaInicio: o.horaInicio,
      horaFin: o.horaFin,
      estado: o.estado,
      pago: { estado: o.pago.estado, importeAplicado: o.pago.importeAplicado },
    })),
    otrosTramos: tramos.map((tramo) => ({
      turnoId: tramo.id,
      fechaInicio: dateAFecha(tramo.fechaInicio),
      fechaFin: tramo.fechaFin && dateAFecha(tramo.fechaFin),
    })),
  }
}

export const finalizacionesRepository = {
  /**
   * Snapshot para la previa y para el chequeo previo del service, **sin lock**: sólo sirve para
   * dar errores claros y para saber de qué alumno es el turno. La decisión que vale es la de
   * `finalizar`.
   */
  async leerSnapshot(
    turnoId: number,
    fechaDesde: string,
    reloj?: Reloj,
  ): Promise<SnapshotFinalizacion> {
    return leerSnapshot(prisma, turnoId, fechaDesde, reloj)
  },

  /**
   * Finaliza el turno de forma atómica, en una sola transacción:
   * 1. `bloquearAlumno` (`alumno` `FOR UPDATE`), **antes de cualquier lectura**: serializa con un
   *    pago, una cancelación, una reprogramación y otra finalización de ese alumno. El `alumnoId`
   *    sale del chequeo previo: el alumno de un turno no cambia nunca.
   * 2. Relee el snapshot con el `tx`: una reprogramación pudo convertir el turno en sesión única,
   *    acortarlo o mover su finalización, y pudo aparecer un pago.
   * 3. `verificar(snapshot)`: si lanza, no se escribe nada.
   * 4. Inserta la `FinalizacionRecurrencia` con el actor como creador. **No toca `Turno`**.
   * 5. El único posible de ese insert es `turno_id`: cualquier P2002 es una doble finalización
   *    (última red; con el lock no debería pasar) → 409 "El turno ya fue finalizado".
   */
  async finalizar(
    entrada: EntradaFinalizacion,
    verificar: (snapshot: SnapshotFinalizacion) => PreviaFinalizacion,
    actor: Actor,
    reloj?: Reloj,
  ): Promise<PreviaFinalizacion> {
    try {
      return await prisma.$transaction(async (tx) => {
        await bloquearAlumno(tx, entrada.alumnoId)

        const plan = verificar(await leerSnapshot(tx, entrada.turnoId, entrada.fechaDesde, reloj))

        await tx.finalizacionRecurrencia.create({
          data: {
            turnoId: entrada.turnoId,
            fechaDesde: fechaADate(entrada.fechaDesde),
            motivo: entrada.motivo,
            detalle: entrada.detalle,
            createdById: actor.userId,
          },
        })
        return plan
      }, TRANSACCION_FINALIZACION)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(MENSAJE_YA_FINALIZADO, { cause: error })
      }
      throw error
    }
  },
}

export type FinalizacionesRepository = typeof finalizacionesRepository
