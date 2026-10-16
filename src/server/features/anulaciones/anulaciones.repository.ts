import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ConflictError } from '@/server/errors'
import { deudaVencida } from '@/server/features/cuentas/cuentas.condiciones'
import {
  leerPagoParaAnular,
  pagosConMismaTransferencia,
  type PagoParaAnular,
} from '@/server/features/pagos/pagos.condiciones'
import { bloquearAlumno } from '@/server/features/turnos/ocurrencias.condiciones'
import type { Actor } from '@/server/shared/actor'
import { CODIGO_PAGO_ANULADO, MENSAJE_PAGO_ANULADO, type DatosDePrevia } from './anulaciones.reglas'
import type { EntradaAnulacion } from './anulaciones.validation'

// Único lugar de la feature que usa Prisma. Sin reglas de negocio: si un pago se puede anular lo
// decide `exigirAnulable` (`anulaciones.reglas.ts`), que el service pasa como callback `verificar`.
// El pago, la deuda y la otra transferencia salen de las `*.condiciones` de `pagos` y `cuentas`
// (una sola implementación), nunca de una consulta propia.

/** Timeout más largo que el default de Prisma (5 s): la espera del lock cuenta en la transacción. */
const TRANSACCION_ANULACION = { timeout: 10_000 } as const

export const anulacionesRepository = {
  /** El pago con sus turnos, o `null` si no existe. Sin lock: sólo para el chequeo previo y la previa. */
  async leerPago(pagoId: number): Promise<PagoParaAnular | null> {
    return leerPagoParaAnular(prisma, pagoId)
  },

  /**
   * Lo que la confirmación necesita además del pago, sin lock (informa, no decide): la deuda
   * vencida de hoy del alumno, el precio vigente de las materias del pago y los otros pagos
   * vigentes de la misma transferencia.
   */
  async leerContextoDePrevia(
    pago: PagoParaAnular,
    hoy: string,
  ): Promise<Pick<DatosDePrevia, 'deudaVencida' | 'precios' | 'otrosPagos'>> {
    const materiaIds = [...new Set(pago.turnos.map((turno) => turno.materia.id))]
    const [deuda, materias, otrosPagos] = await Promise.all([
      deudaVencida(prisma, { alumnoId: pago.alumno.id, hoy }),
      materiaIds.length === 0
        ? []
        : prisma.materia.findMany({
            where: { id: { in: materiaIds } },
            select: { id: true, precioHora: true },
          }),
      pago.transferencia
        ? pagosConMismaTransferencia(prisma, { ...pago.transferencia, excluirPagoId: pago.id })
        : [],
    ])
    return {
      deudaVencida: deuda,
      precios: new Map(materias.map((m) => [m.id, m.precioHora ? m.precioHora.toNumber() : null])),
      otrosPagos,
    }
  },

  /**
   * Anula el pago completo de forma atómica, en una sola transacción:
   * 1. `bloquearAlumno` (`alumno` `FOR UPDATE`), **antes de cualquier lectura**: serializa con un
   *    pago, una cancelación, la finalización, la reprogramación y el registro de asistencia de ese
   *    alumno. Un pago nuevo de las mismas ocurrencias espera a que ésta termine (o ya falló con
   *    `YA_PAGADO`), y una asistencia registrada antes de tomar el lock se ve en la relectura.
   * 2. Relee el pago y la asistencia de sus turnos con el `tx`.
   * 3. `verificar(pago)`: si lanza (no existe, ya anulado, turnos dictados), no se escribe nada.
   * 4. `Pago.estado = ANULADO` (con `updatedById`), una `AnulacionPago` y `vigente = null` en todos
   *    sus `PagoTurno`: sus turnos vuelven a estar pendientes y se pueden cobrar de nuevo. El pago
   *    conserva todos sus datos, su forma de pago y su comprobante adjunto.
   * 5. Una P2002 del único `pagoId` de `anulacion_pago` es la última red contra la doble anulación:
   *    409 `PAGO_ANULADO`.
   *
   * Devuelve cuántos turnos volvieron a quedar pendientes.
   */
  async anular(
    entrada: EntradaAnulacion,
    verificar: (pago: PagoParaAnular | null) => PagoParaAnular,
    actor: Actor,
  ): Promise<number> {
    try {
      return await prisma.$transaction(async (tx) => {
        await bloquearAlumno(tx, entrada.alumnoId)

        const pago = verificar(await leerPagoParaAnular(tx, entrada.pagoId))

        await tx.pago.update({
          where: { id: pago.id },
          data: { estado: 'ANULADO', updatedById: actor.userId },
        })
        await tx.anulacionPago.create({
          data: {
            pagoId: pago.id,
            motivo: entrada.motivo,
            detalle: entrada.detalle,
            createdById: actor.userId,
          },
        })
        const { count } = await tx.pagoTurno.updateMany({
          where: { pagoId: pago.id },
          data: { vigente: null },
        })
        return count
      }, TRANSACCION_ANULACION)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError(MENSAJE_PAGO_ANULADO, { code: CODIGO_PAGO_ANULADO, cause: error })
      }
      throw error
    }
  },
}

export type AnulacionesRepository = typeof anulacionesRepository
