import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ConflictError } from '@/server/errors'
import {
  bloquearAlumno,
  leerOcurrencias,
  type ClienteOcurrencias,
} from '@/server/features/turnos/ocurrencias.condiciones'
import type { Actor } from '@/server/shared/actor'
import { fechaADate, type Reloj } from '@/server/shared/fechas'
import {
  CODIGO_TURNOS_NO_CANCELABLES,
  MENSAJE_YA_CANCELADO_CONCURRENTE,
  type OcurrenciaCancelable,
  type PlanCancelacion,
} from './cancelaciones.reglas'
import type { EntradaCancelacion, OcurrenciaACancelar } from './cancelaciones.validation'

// Único lugar de la feature que usa Prisma. Sin reglas de negocio: qué se puede cancelar lo decide
// `planificarCancelacion` (`cancelaciones.reglas.ts`), que el service pasa como callback
// `verificar`. Las ocurrencias salen del motor de `turnos` (`ocurrencias.condiciones.ts`), nunca de
// una expansión propia.

/** Timeout más largo que el default de Prisma (5 s): la espera del lock cuenta en la transacción. */
const TRANSACCION_CANCELACION = { timeout: 10_000 } as const

/**
 * Snapshot de la cancelación: **una** llamada a `leerOcurrencias` con los `turnoIds` pedidos y el
 * rango de sus fechas, sin `alumnoId` (así se distingue "de otro alumno" de "no existe").
 */
async function leerSnapshot(
  client: ClienteOcurrencias,
  pedidas: readonly OcurrenciaACancelar[],
  reloj?: Reloj,
): Promise<OcurrenciaCancelable[]> {
  const fechas = pedidas.map((o) => o.fecha).sort()
  if (fechas.length === 0) return []
  return leerOcurrencias(
    client,
    {
      desde: fechas[0] as string,
      hasta: fechas.at(-1) as string,
      turnoIds: [...new Set(pedidas.map((o) => o.turnoId))],
    },
    reloj,
  )
}

export const cancelacionesRepository = {
  /**
   * Snapshot para el chequeo previo del service, **sin lock**: sólo sirve para dar errores claros
   * y para saber de qué alumno son las ocurrencias. La decisión que vale es la de `cancelar`.
   */
  async leerSnapshot(
    pedidas: readonly OcurrenciaACancelar[],
    reloj?: Reloj,
  ): Promise<OcurrenciaCancelable[]> {
    return leerSnapshot(prisma, pedidas, reloj)
  },

  /**
   * Cancela las ocurrencias de forma atómica, todo o nada, en una sola transacción:
   * 1. `bloquearAlumno` (`alumno` `FOR UPDATE`), **antes de cualquier lectura**: serializa con un
   *    pago, otra cancelación, la finalización y la reprogramación de ese alumno (decisión T-59:
   *    las ocurrencias pueden ser de varios profesores y a la cancelación no le importa la
   *    ocupación).
   * 2. Relee con el `tx` las ocurrencias pedidas.
   * 3. `verificar(snapshot)`: si lanza, no se escribe nada.
   * 4. Inserta una `CancelacionTurno` por línea (`fechaOcurrencia` = la fecha de la ocurrencia),
   *    con el motivo, el detalle y el actor como creador.
   * 5. Una P2002 del único de `cancelacion_turno` es la última red contra la doble cancelación:
   *    409 `TURNOS_NO_CANCELABLES` sin detalle por ocurrencia.
   */
  async cancelar(
    entrada: EntradaCancelacion,
    verificar: (snapshot: OcurrenciaCancelable[]) => PlanCancelacion,
    actor: Actor,
    reloj?: Reloj,
  ): Promise<PlanCancelacion> {
    try {
      return await prisma.$transaction(async (tx) => {
        await bloquearAlumno(tx, entrada.alumnoId)

        const plan = verificar(await leerSnapshot(tx, entrada.ocurrencias, reloj))

        await tx.cancelacionTurno.createMany({
          data: plan.lineas.map((linea) => ({
            turnoId: linea.turnoId,
            fechaOcurrencia: fechaADate(linea.fecha),
            motivo: entrada.motivo,
            detalle: entrada.detalle,
            createdById: actor.userId,
          })),
        })
        return plan
      }, TRANSACCION_CANCELACION)
    } catch (error) {
      // El único posible de este insert es (turno_id, fecha_ocurrencia): cualquier P2002 es doble.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(MENSAJE_YA_CANCELADO_CONCURRENTE, {
          code: CODIGO_TURNOS_NO_CANCELABLES,
          cause: error,
        })
      }
      throw error
    }
  },
}

export type CancelacionesRepository = typeof cancelacionesRepository
