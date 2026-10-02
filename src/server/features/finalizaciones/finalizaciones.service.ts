import type { Actor } from '@/server/shared/actor'
import { hoy, type Reloj } from '@/server/shared/fechas'
import type { FinalizacionesRepository } from './finalizaciones.repository'
import { armarPrevia, planificarFinalizacion, validarFinalizacion } from './finalizaciones.reglas'
import type {
  FinalizacionCreada,
  FinalizarTurno,
  PreviaFinalizacion,
  PreviaFinalizacionQuery,
} from './finalizaciones.validation'

// Reglas de negocio de la finalización (HU-14, T-47). No conoce HTTP ni Prisma: lanza AppError o
// sus subclases. Qué se puede finalizar lo deciden las reglas puras de `finalizaciones.reglas.ts`.

/**
 * Crea el service con sus dependencias. El controller arma la instancia con el repository real;
 * los tests, con uno falso y un reloj fijo (`reloj` opcional; por defecto el del sistema).
 */
export function crearFinalizacionesService({
  repository,
  reloj,
}: {
  repository: Pick<FinalizacionesRepository, 'leerSnapshot' | 'finalizar'>
  reloj?: Reloj
}) {
  return {
    /**
     * Qué se libera si se finaliza la hora del turno (todos sus tramos, decisión T-104) desde
     * `fechaDesde`, y qué otras horas de la serie siguen agendadas. Aplica los mismos 404, 409 y 400
     * que `finalizar` (`validarFinalizacion`), salvo las pagadas: van en la lista (`pagadas`,
     * `ultimaFechaPagada`, `fechaDesdeMinima`) y no son un error.
     */
    async previa(query: PreviaFinalizacionQuery): Promise<PreviaFinalizacion> {
      const snapshot = await repository.leerSnapshot(query.turnoId, query.fechaDesde, reloj)
      const conjunto = validarFinalizacion(snapshot, query.fechaDesde, hoy(reloj))
      return armarPrevia(snapshot, conjunto, query.fechaDesde)
    },

    /**
     * Finaliza un turno recurrente desde `fechaDesde`: la hora del turno pedido, en todos los
     * tramos de su serie (decisión T-104). Las otras horas de la serie no se tocan. Chequeos, en
     * orden (el primero que falla gana), sobre ese conjunto de filas:
     * 1. El body ya lo validó Zod (400): formato, `detalle` obligatorio con `OTRO`.
     * 2. Turno inexistente → 404.
     * 3. No es `RECURRENTE`, no está vigente (incluye `Turno.estado = CANCELADO`, anterior al
     *    Sprint 2) o ya fue finalizado → 409.
     * 4. `fechaDesde` anterior a hoy, en otro día de la semana, no posterior al primer inicio o
     *    posterior al último fin → 400 en `["fechaDesde"]`.
     * 5. Ocurrencias pagadas desde `fechaDesde` → 409 `TURNOS_PAGADOS`.
     * 6. `repository.finalizar`, que bloquea el alumno, relee y vuelve a decidir con la misma
     *    regla (2 a 5) antes de escribir.
     */
    async finalizar(datos: FinalizarTurno, actor: Actor): Promise<FinalizacionCreada> {
      const { turnoId, fechaDesde } = datos
      const fechaHoy = hoy(reloj)
      const snapshot = await repository.leerSnapshot(turnoId, fechaDesde, reloj)
      planificarFinalizacion(snapshot, fechaDesde, fechaHoy)
      // No puede faltar: `planificarFinalizacion` lanza 404 si el turno no existe.
      const alumnoId = snapshot.turno?.alumnoId as number

      const { previa } = await repository.finalizar(
        { turnoId, alumnoId, fechaDesde, motivo: datos.motivo, detalle: datos.detalle ?? null },
        (releido) => planificarFinalizacion(releido, fechaDesde, fechaHoy),
        actor,
        reloj,
      )
      return { turnoId, cantidad: previa.cantidad, desde: previa.desde, hasta: previa.hasta }
    },
  }
}

export type FinalizacionesService = ReturnType<typeof crearFinalizacionesService>
