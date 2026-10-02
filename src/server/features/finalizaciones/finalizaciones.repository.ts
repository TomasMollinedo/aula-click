import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ConflictError } from '@/server/errors'
import {
  bloquearAlumno,
  leerFilasDeLaSerie,
  leerOcurrencias,
  type ClienteOcurrencias,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Actor } from '@/server/shared/actor'
import { dateAFecha, fechaADate, hoy, type Reloj } from '@/server/shared/fechas'
import {
  MENSAJE_YA_FINALIZADO,
  type PlanFinalizacion,
  type SnapshotFinalizacion,
} from './finalizaciones.reglas'
import type { EntradaFinalizacion } from './finalizaciones.validation'

// Único lugar de la feature que usa Prisma. Sin reglas de negocio: qué se puede finalizar lo
// decide `planificarFinalizacion` (`finalizaciones.reglas.ts`), que el service pasa como callback
// `verificar`. Las filas de la serie y las ocurrencias salen del motor de `turnos`
// (`ocurrencias.condiciones.ts`), nunca de una expansión propia. Nunca se modifica `Turno`
// (definición C): el fin efectivo lo aplica el motor con sólo existir la `FinalizacionRecurrencia`.

/** Timeout más largo que el default de Prisma (5 s): la espera del lock cuenta en la transacción. */
const TRANSACCION_FINALIZACION = { timeout: 10_000 } as const

const maxFecha = (...fechas: string[]) => fechas.reduce((a, b) => (a > b ? a : b))

/**
 * Snapshot de la finalización, en una cantidad fija de consultas (una sola si el turno no existe):
 * 1. El turno y las filas de su serie, de todas sus horas y sus tramos (`leerFilasDeLaSerie`).
 * 2. El último pago de esas filas.
 * 3. Sus ocurrencias desde la mayor entre hoy y `fechaDesde` (`leerOcurrencias`; las anteriores no
 *    se usan: la vigencia sale de `fechaFin` y la previa mira `>= fechaDesde`, así que una
 *    `fechaDesde` lejana no expande las semanas intermedias). El motor exige `hasta`: es la mayor
 *    fecha finita que interviene (ese `desde`, los inicios y los fines guardados de las filas y el
 *    último pago). Después de ella sólo quedan tramos sin fin, sin pagos: lo que se libera ya no
 *    cambia.
 */
async function leerSnapshot(
  client: ClienteOcurrencias,
  turnoId: number,
  fechaDesde: string,
  reloj?: Reloj,
): Promise<SnapshotFinalizacion> {
  const serie = await leerFilasDeLaSerie(client, turnoId)
  if (!serie) return { turno: null, filas: [], ocurrencias: [] }
  const { turno, filas } = serie
  if (filas.length === 0) return { turno, filas, ocurrencias: [] }

  const turnoIds = filas.map((fila) => fila.turnoId)
  const ultimoPago = await client.pagoTurno.findFirst({
    where: { turnoId: { in: turnoIds } },
    orderBy: { fechaOcurrencia: 'desc' },
    select: { fechaOcurrencia: true },
  })
  const desde = maxFecha(hoy(reloj), fechaDesde)
  const hasta = maxFecha(
    desde,
    ...filas.flatMap((fila) => [fila.fechaInicio, ...(fila.fechaFin ? [fila.fechaFin] : [])]),
    ...(ultimoPago ? [dateAFecha(ultimoPago.fechaOcurrencia)] : []),
  )
  const ocurrencias = await leerOcurrencias(client, { desde, hasta, turnoIds }, reloj)

  return {
    turno,
    filas,
    ocurrencias: ocurrencias.map((o) => ({
      turnoId: o.turnoId,
      fecha: o.fecha,
      horaInicio: o.horaInicio,
      horaFin: o.horaFin,
      estado: o.estado,
      pago: { estado: o.pago.estado, importeAplicado: o.pago.importeAplicado },
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
   * Finaliza la hora del turno de forma atómica, en una sola transacción:
   * 1. `bloquearAlumno` (`alumno` `FOR UPDATE`), **antes de cualquier lectura**: serializa con un
   *    pago, una cancelación, una reprogramación y otra finalización de ese alumno (también la de
   *    otro tramo de la misma hora). El `alumnoId` sale del chequeo previo: el alumno de un turno
   *    no cambia nunca.
   * 2. Relee el snapshot con el `tx`: una reprogramación pudo partir la serie, convertir el turno
   *    en sesión única o mover su finalización, y pudo aparecer un pago.
   * 3. `verificar(snapshot)`: si lanza, no se escribe nada.
   * 4. Inserta una `FinalizacionRecurrencia` con la misma `fechaDesde` en cada turno del plan (los
   *    tramos de esa hora con fechas desde ahí), con el actor como creador. **No toca `Turno`**.
   * 5. El único posible de ese insert es `turno_id`: cualquier P2002 es una doble finalización
   *    (última red; con el lock no debería pasar) → 409 "El turno ya fue finalizado".
   */
  async finalizar(
    entrada: EntradaFinalizacion,
    verificar: (snapshot: SnapshotFinalizacion) => PlanFinalizacion,
    actor: Actor,
    reloj?: Reloj,
  ): Promise<PlanFinalizacion> {
    try {
      return await prisma.$transaction(async (tx) => {
        await bloquearAlumno(tx, entrada.alumnoId)

        const plan = verificar(await leerSnapshot(tx, entrada.turnoId, entrada.fechaDesde, reloj))

        await tx.finalizacionRecurrencia.createMany({
          data: plan.turnoIds.map((turnoId) => ({
            turnoId,
            fechaDesde: fechaADate(entrada.fechaDesde),
            motivo: entrada.motivo,
            detalle: entrada.detalle,
            createdById: actor.userId,
          })),
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
