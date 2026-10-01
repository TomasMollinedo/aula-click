import type { Actor } from '@/server/shared/actor'
import type { Reloj } from '@/server/shared/fechas'
import type { CancelacionesRepository } from './cancelaciones.repository'
import { planificarCancelacion } from './cancelaciones.reglas'
import type { CancelacionesCreadas, CancelarTurnos } from './cancelaciones.validation'

// Reglas de negocio de la cancelación (HU-13, T-45). No conoce HTTP ni Prisma: lanza AppError o
// sus subclases. Qué se puede cancelar lo decide `planificarCancelacion` (puro).

/**
 * Crea el service con sus dependencias. El controller arma la instancia con el repository real;
 * los tests, con uno falso y un reloj fijo (`reloj` opcional; por defecto el del sistema).
 */
export function crearCancelacionesService({
  repository,
  reloj,
}: {
  repository: Pick<CancelacionesRepository, 'leerSnapshot' | 'cancelar'>
  reloj?: Reloj
}) {
  return {
    /**
     * Cancela una o varias ocurrencias de un alumno, todo o nada. Chequeos, en orden (el primero
     * que falla gana):
     * 1. El body ya lo validó Zod (400): formato, repetidas, `detalle` obligatorio con `OTRO`.
     * 2. Chequeo previo sin lock (`planificarCancelacion` sobre el snapshot): ocurrencias de más
     *    de un alumno → 400; alguna no cancelable → 409 `TURNOS_NO_CANCELABLES`. De acá sale el
     *    alumno, que el body no trae.
     * 3. `repository.cancelar`, que bloquea el alumno, relee y vuelve a decidir con la misma
     *    regla antes de escribir.
     */
    async cancelar(datos: CancelarTurnos, actor: Actor): Promise<CancelacionesCreadas> {
      const { alumnoId } = planificarCancelacion(
        await repository.leerSnapshot(datos.ocurrencias, reloj),
        datos.ocurrencias,
      )
      const plan = await repository.cancelar(
        {
          alumnoId,
          ocurrencias: datos.ocurrencias,
          motivo: datos.motivo,
          detalle: datos.detalle ?? null,
        },
        (snapshot) => planificarCancelacion(snapshot, datos.ocurrencias),
        actor,
        reloj,
      )
      return { cantidad: plan.lineas.length }
    },
  }
}

export type CancelacionesService = ReturnType<typeof crearCancelacionesService>
