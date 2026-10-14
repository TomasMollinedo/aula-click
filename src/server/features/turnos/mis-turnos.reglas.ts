import { AppError, ConflictError } from '@/server/errors'
import { CODIGO_ALUMNO_SUPERPUESTO, CODIGO_BLOQUE_LLENO } from './turnos.reglas'
import type {
  DisponibilidadItem,
  MiDisponibilidadItem,
  TurnoReservado,
  TurnosAlta,
} from './turnos.validation'

// Lo propio del portal del alumno al sacar un turno (HU-29). Las reglas del alta son las de HU-08
// (`planificarReserva`, la misma función que usa la mesa): acá sólo está lo que cambia para el
// alumno —las fechas desde mañana, los textos dirigidos a él— y qué datos no se le devuelven
// nunca (cupos, ocupación, observaciones y auditoría; contrato-api.md → Portal del alumno).

export const MENSAJE_DESDE_MANANA = 'Los turnos se sacan desde el día siguiente'

export const MENSAJE_ALUMNO_SUPERPUESTO_PORTAL = 'Ya tenés un turno ese día en ese horario'

/**
 * Un error del alta, como lo ve el alumno. `ALUMNO_SUPERPUESTO` cambia el texto (los turnos en
 * conflicto son suyos: los `details` se conservan); `BLOQUE_LLENO` conserva las fechas llenas
 * ("Reservar sólo las fechas con lugar") pero pierde la capacidad efectiva de cada hora. El resto,
 * igual.
 */
export function errorParaElAlumno(error: unknown): unknown {
  if (!(error instanceof AppError)) return error
  if (error.code === CODIGO_ALUMNO_SUPERPUESTO) {
    return new ConflictError(MENSAJE_ALUMNO_SUPERPUESTO_PORTAL, {
      code: CODIGO_ALUMNO_SUPERPUESTO,
      details: error.details,
    })
  }
  if (error.code === CODIGO_BLOQUE_LLENO && Array.isArray(error.details)) {
    return new ConflictError(error.message, {
      code: CODIGO_BLOQUE_LLENO,
      details: error.details.map((detalle: unknown) => {
        if (typeof detalle !== 'object' || detalle === null) return detalle
        const { capacidadEfectiva, ...resto } = detalle as Record<string, unknown>
        void capacidadEfectiva
        return resto
      }),
    })
  }
  return error
}

/**
 * La disponibilidad de la mesa, como la ve el alumno: cada hora sólo dice si se puede elegir
 * (`disponible = !lleno`), sin capacidad ni ocupación, y cada resultado suma el valor por clase de
 * la materia.
 */
export function disponibilidadParaElAlumno(
  items: DisponibilidadItem[],
  valorPorClase: number | null,
): MiDisponibilidadItem[] {
  return items.map((item) => ({
    profesor: item.profesor,
    diaSemana: item.diaSemana,
    fecha: item.fecha,
    aula: item.aula,
    horaInicio: item.horaInicio,
    horaFin: item.horaFin,
    valorPorClase,
    horas: item.horas.map((hora) => ({
      bloqueId: hora.bloqueId,
      horaInicio: hora.horaInicio,
      horaFin: hora.horaFin,
      disponible: !hora.lleno,
    })),
  }))
}

/**
 * El alta, como la ve el alumno ("Turno reservado"): materia, profesor, aula, día, tipo y temas
 * (iguales en todos los turnos de un alta), cada turno con su hora y sus fechas, y las fechas que
 * quedaron sin turno. Sin observaciones ni auditoría. El alta siempre crea al menos un turno.
 */
export function resumenParaElAlumno(alta: TurnosAlta): TurnoReservado {
  const [primero] = alta.turnos
  if (!primero) throw new AppError('El alta no creó ningún turno')
  return {
    cantidad: alta.cantidad,
    tipo: primero.tipo,
    diaSemana: primero.diaSemana,
    materia: primero.materia,
    profesor: primero.profesor,
    aula: primero.aula,
    temas: primero.temas,
    turnos: alta.turnos.map((turno) => ({
      id: turno.id,
      bloqueId: turno.bloqueId,
      horaInicio: turno.horaInicio,
      horaFin: turno.horaFin,
      fechaInicio: turno.fechaInicio,
      fechaFin: turno.fechaFin,
    })),
    fechasSinTurno: alta.fechasSinTurno,
  }
}
