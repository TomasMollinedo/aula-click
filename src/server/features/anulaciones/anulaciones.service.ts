import type { Actor } from '@/server/shared/actor'
import { hoy, type Reloj } from '@/server/shared/fechas'
import type { AnulacionesRepository } from './anulaciones.repository'
import { armarPrevia, exigirAnulable } from './anulaciones.reglas'
import type { AnularPago, PagoAnulado, PreviaAnulacion } from './anulaciones.validation'

// Reglas de negocio de la anulación de pagos (HU-42, T-104). No conoce HTTP ni Prisma: lanza
// AppError o sus subclases. Si el pago se puede anular y los avisos los deciden `exigirAnulable` y
// `armarPrevia` (puros).

/**
 * Crea el service con sus dependencias. El controller arma la instancia con el repository real;
 * los tests, con uno falso y un reloj fijo (`reloj` opcional; por defecto el del sistema).
 */
export function crearAnulacionesService({
  repository,
  reloj,
}: {
  repository: Pick<AnulacionesRepository, 'leerPago' | 'leerContextoDePrevia' | 'anular'>
  reloj?: Reloj
}) {
  return {
    /**
     * La confirmación de la anulación: el resumen del pago y los avisos (deuda, precio y
     * transferencia compartida), que informan sin bloquear. Pago inexistente → 404; ya anulado →
     * 409 `PAGO_ANULADO`; con turnos ya dictados → 409 `TURNOS_DICTADOS` (no hay nada que
     * confirmar). Lee sin lock: es información, la decisión que vale es la de `anular`.
     */
    async previa(pagoId: number): Promise<PreviaAnulacion> {
      const pago = exigirAnulable(await repository.leerPago(pagoId))
      const fechaHoy = hoy(reloj)
      const contexto = await repository.leerContextoDePrevia(pago, fechaHoy)
      return armarPrevia({ pago, ...contexto, hoy: fechaHoy })
    },

    /**
     * Anula el pago completo, nunca un turno suelto. Chequeos, en orden (el primero que falla gana):
     * 1. El body ya lo validó Zod (400): el motivo del enum y el `detalle` de hasta 500, obligatorio
     *    con `OTRO`.
     * 2. Chequeo previo sin lock (`exigirAnulable`): pago inexistente → 404; ya anulado → 409
     *    `PAGO_ANULADO`; algún turno con asistencia → 409 `TURNOS_DICTADOS`. De acá sale el
     *    alumno, que el body no trae.
     * 3. `repository.anular`, que bloquea el alumno, relee el pago (con la asistencia de sus
     *    turnos) y vuelve a decidir con la misma regla antes de escribir: una asistencia registrada
     *    entre el chequeo previo y el lock también da `TURNOS_DICTADOS`. Los turnos quedan
     *    pendientes en la siguiente lectura del motor.
     */
    async anular(datos: AnularPago, actor: Actor): Promise<PagoAnulado> {
      const pago = exigirAnulable(await repository.leerPago(datos.pagoId))
      const cantidad = await repository.anular(
        {
          pagoId: datos.pagoId,
          alumnoId: pago.alumno.id,
          motivo: datos.motivo,
          detalle: datos.detalle ?? null,
        },
        exigirAnulable,
        actor,
      )
      return { pagoId: datos.pagoId, cantidad }
    },
  }
}

export type AnulacionesService = ReturnType<typeof crearAnulacionesService>
