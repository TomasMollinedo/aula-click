import { NotFoundError, ValidationError } from '@/server/errors'
import type { BloquesRepository } from '@/server/features/bloques/bloques.repository'
import type { TurnosRepository } from '@/server/features/turnos/turnos.repository'
import type { Actor } from '@/server/shared/actor'
import { hoy, type Reloj } from '@/server/shared/fechas'
import type { ReprogramacionesRepository } from './reprogramaciones.repository'
import { planificarReprogramacion } from './reprogramaciones.reglas'
import type { ReprogramarTurno, TurnoReprogramado } from './reprogramaciones.validation'

// Reglas de negocio de la reprogramación (HU-20, T-49). No conoce HTTP ni Prisma: lanza AppError o
// sus subclases. Qué se puede mover y cómo se parte la serie lo decide `planificarReprogramacion`
// (puro); del turno y de la hora de destino sólo lee, por sus repositories.

const MENSAJE_FECHA_DESTINO_PASADA = 'La fecha de destino no puede ser anterior a hoy'

/**
 * Crea el service con sus dependencias. El controller arma la instancia con los repositories
 * reales; los tests, con falsos y un reloj fijo (`reloj` opcional; por defecto el del sistema, vía
 * `hoy(reloj)`). Los importa sólo como tipo, así el service no carga Prisma ni `@/config/env`.
 */
export function crearReprogramacionesService({
  repository,
  turnosRepository,
  bloquesRepository,
  reloj,
}: {
  repository: Pick<ReprogramacionesRepository, 'reprogramar'>
  turnosRepository: Pick<TurnosRepository, 'buscarDetalle'>
  bloquesRepository: Pick<BloquesRepository, 'buscarPorIds'>
  reloj?: Reloj
}) {
  return {
    /**
     * Mueve una ocurrencia a otra fecha, hora o profesor. Chequeos, en orden, antes de la
     * transacción (lecturas sin lock, para dar errores claros y saber qué bloquear):
     * 1. `fechaDestino` anterior a hoy → 400.
     * 2. Turno inexistente → 404.
     * 3. Hora de destino inexistente → 404.
     * 4. `repository.reprogramar`, que bloquea, relee y decide con `planificarReprogramacion`:
     *    la ocurrencia (404 / 409), el día del destino (400), profesor y materia (409), la
     *    superposición del alumno y el lugar (409).
     */
    async reprogramar(datos: ReprogramarTurno, actor: Actor): Promise<TurnoReprogramado> {
      if (datos.fechaDestino < hoy(reloj)) {
        throw new ValidationError(MENSAJE_FECHA_DESTINO_PASADA, {
          details: [{ path: ['fechaDestino'], message: MENSAJE_FECHA_DESTINO_PASADA }],
        })
      }

      const turno = await turnosRepository.buscarDetalle(datos.turnoId)
      if (!turno) throw new NotFoundError('Turno no encontrado')
      const [destino] = await bloquesRepository.buscarPorIds([datos.bloqueAgendaDestinoId])
      if (!destino) {
        const mensaje = `El bloque ${datos.bloqueAgendaDestinoId} no existe o fue dado de baja`
        throw new NotFoundError('Bloque no encontrado', {
          details: [{ path: ['bloqueAgendaDestinoId'], message: mensaje }],
        })
      }

      const { fechaDestino } = datos
      return repository.reprogramar(
        {
          turnoId: datos.turnoId,
          fecha: datos.fecha,
          alumnoId: turno.alumno.id,
          bloqueOrigenId: turno.bloqueId,
          bloqueDestinoId: destino.id,
          profesorDestinoId: destino.profesorId,
          fechaDestino,
        },
        (snapshot) => planificarReprogramacion(snapshot, { fechaDestino }),
        actor,
        reloj,
      )
    },
  }
}

export type ReprogramacionesService = ReturnType<typeof crearReprogramacionesService>
