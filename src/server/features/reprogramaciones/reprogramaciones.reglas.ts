import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import {
  CODIGO_ALUMNO_SUPERPUESTO,
  CODIGO_BLOQUE_LLENO,
  CODIGO_MATERIA_INACTIVA,
  CODIGO_MATERIA_NO_ASIGNADA,
  CODIGO_PROFESOR_INACTIVO,
  MENSAJE_ALUMNO_SUPERPUESTO,
  MENSAJE_BLOQUE_NO_ENCONTRADO,
  MENSAJE_MATERIA_INACTIVA,
  MENSAJE_MATERIA_NO_ASIGNADA,
  MENSAJE_PROFESOR_INACTIVO,
  MENSAJE_PROFESOR_NO_ENCONTRADO,
  nombreDia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import { diaSemanaISO, sumarDias } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import type { PlanReprogramacion, SnapshotReprogramacion } from './reprogramaciones.validation'

// Reglas puras de la reprogramación (HU-20, T-49): qué se puede mover, adónde y cómo se parte la
// serie. Sin Prisma y sin `hoy()` adentro. Las usa el repository, con lo releído bajo lock, como
// callback `planificar` (una sola implementación, igual que la reserva). Los códigos y mensajes del
// destino son los del alta (`turnos`): los re-exporta el motor de ocurrencias.

export const MENSAJE_OCURRENCIA_NO_ENCONTRADA = 'La ocurrencia no existe'
export const MENSAJE_OCURRENCIA_CANCELADA = 'La ocurrencia está cancelada: no se puede reprogramar'
export const MENSAJE_OCURRENCIA_PASADA = 'La ocurrencia ya pasó: no se puede reprogramar'
export const MENSAJE_MISMO_LUGAR = 'El turno ya está en esa fecha y horario'
export const MENSAJE_TURNO_CAMBIO = 'El turno cambió mientras se reprogramaba: probá de nuevo'
export const MENSAJE_SIN_LUGAR_DESTINO = 'La hora de destino no tiene lugar en esa fecha'

/** `YYYY-MM-DD` → `DD/MM`. */
function diaMes(fecha: string): string {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`
}

/** `HH:mm` sin el cero adelante de la hora (`09:00` → `9:00`). */
function horaCorta(minutos: number): string {
  return minutosAHora(minutos).replace(/^0(\d)/, '$1')
}

function describir(fecha: string, horaInicio: number, horaFin: number, apellido: string): string {
  const dia = nombreDia(diaSemanaISO(fecha))
  return `${dia} ${diaMes(fecha)} ${horaCorta(horaInicio)}–${horaCorta(horaFin)} con Prof. ${apellido}`
}

/**
 * Decide una reprogramación con lo leído bajo lock (`snapshot`). Orden:
 * 1. La ocurrencia no existe (404), está cancelada o ya pasó (409). Una pagada se puede mover.
 * 2. Destino inexistente o dado de baja (404); `fechaDestino` fuera del día de la hora (400) o
 *    igual a la de origen en la misma hora (400).
 * 3. Profesor inexistente (404) o inactivo (409 `PROFESOR_INACTIVO`); materia inactiva (409
 *    `MATERIA_INACTIVA`) o sin asignación activa (409 `MATERIA_NO_ASIGNADA`).
 * 4. Superposición del alumno, sin contar la ocurrencia que se mueve (409 `ALUMNO_SUPERPUESTO`).
 * 5. Lugar en el destino, sin contar la ocurrencia que se mueve (409 `BLOQUE_LLENO`).
 * 6. Plan: sesión única (se edita el turno) o recurrente (se parte la serie, sin turnos vacíos).
 *
 * "Hoy" no entra acá: `estado` de la ocurrencia ya lo distingue (`AGENDADO` = de hoy o posterior).
 */
export function planificarReprogramacion(
  snapshot: SnapshotReprogramacion,
  pedido: { fechaDestino: string },
): PlanReprogramacion {
  const { ocurrencia, turno, destino, profesor } = snapshot
  const { fechaDestino } = pedido

  // 1. La ocurrencia.
  if (!ocurrencia || !turno) throw new NotFoundError(MENSAJE_OCURRENCIA_NO_ENCONTRADA)
  if (ocurrencia.estado === 'CANCELADO') throw new ConflictError(MENSAJE_OCURRENCIA_CANCELADA)
  if (ocurrencia.estado !== 'AGENDADO') throw new ConflictError(MENSAJE_OCURRENCIA_PASADA)

  // 2. El destino.
  if (!destino || destino.estado !== 'ACTIVO') {
    throw new NotFoundError(MENSAJE_BLOQUE_NO_ENCONTRADO, {
      details: [{ path: ['bloqueAgendaDestinoId'], message: MENSAJE_BLOQUE_NO_ENCONTRADO }],
    })
  }
  if (diaSemanaISO(fechaDestino) !== destino.diaSemana) {
    const mensaje = `La fecha debe caer en ${nombreDia(destino.diaSemana)}`
    throw new ValidationError(mensaje, { details: [{ path: ['fechaDestino'], message: mensaje }] })
  }
  if (destino.id === ocurrencia.bloqueAgendaId && fechaDestino === ocurrencia.fecha) {
    throw new ValidationError(MENSAJE_MISMO_LUGAR, {
      details: [{ path: ['fechaDestino'], message: MENSAJE_MISMO_LUGAR }],
    })
  }

  // 3. Profesor y materia del destino.
  if (!profesor) throw new NotFoundError(MENSAJE_PROFESOR_NO_ENCONTRADO)
  if (profesor.estado !== 'ACTIVO') {
    throw new ConflictError(MENSAJE_PROFESOR_INACTIVO, { code: CODIGO_PROFESOR_INACTIVO })
  }
  if (snapshot.materia?.estado !== 'ACTIVO') {
    throw new ConflictError(MENSAJE_MATERIA_INACTIVA, {
      code: CODIGO_MATERIA_INACTIVA,
      details: [{ path: ['bloqueAgendaDestinoId'], message: MENSAJE_MATERIA_INACTIVA }],
    })
  }
  if (snapshot.asignacion?.estado !== 'ACTIVO') {
    throw new ConflictError(MENSAJE_MATERIA_NO_ASIGNADA, {
      code: CODIGO_MATERIA_NO_ASIGNADA,
      details: [{ path: ['bloqueAgendaDestinoId'], message: MENSAJE_MATERIA_NO_ASIGNADA }],
    })
  }

  // 4. Superposición del alumno.
  if (snapshot.superpuestas.length > 0) {
    throw new ConflictError(MENSAJE_ALUMNO_SUPERPUESTO, {
      code: CODIGO_ALUMNO_SUPERPUESTO,
      details: snapshot.superpuestas.map((o) => ({
        turnoId: o.turnoId,
        tipo: o.tipo,
        fechaInicio: o.serie.fechaInicio,
        fechaFin: o.serie.fechaFin,
        diaSemana: o.diaSemana,
        horaInicio: minutosAHora(o.horaInicio),
        horaFin: minutosAHora(o.horaFin),
        profesor: { id: o.profesor.id, nombre: o.profesor.nombre, apellido: o.profesor.apellido },
        materia: o.materia,
      })),
    })
  }

  // 5. Capacidad efectiva: la menor entre la del profesor y la del aula.
  const capacidadEfectiva = Math.min(profesor.capacidad, destino.aulaCapacidad)
  if (snapshot.ocupacionDestino >= capacidadEfectiva) {
    throw new ConflictError(MENSAJE_SIN_LUGAR_DESTINO, {
      code: CODIGO_BLOQUE_LLENO,
      details: [
        {
          path: ['bloqueAgendaDestinoId'],
          message: `La hora de ${horaCorta(destino.horaInicio)} a ${horaCorta(destino.horaFin)} está completa el ${nombreDia(destino.diaSemana)} ${diaMes(fechaDestino)}`,
          bloqueId: destino.id,
          capacidadEfectiva,
          ocupacion: snapshot.ocupacionDestino,
        },
      ],
    })
  }

  // 6. Plan.
  const cambio = `Del ${describir(ocurrencia.fecha, ocurrencia.horaInicio, ocurrencia.horaFin, ocurrencia.profesor.apellido)} al ${describir(fechaDestino, destino.horaInicio, destino.horaFin, profesor.apellido)}`
  const sinCambios = {
    tramoNuevo: null,
    sesionNueva: false,
    finalizacionAlTramo: false,
    borrarFinalizacion: false,
    reapuntarPosterioresAlTramo: false,
    moverPago: ocurrencia.pago.estado === 'PAGADO',
    cambio,
  } satisfies Omit<PlanReprogramacion, 'original'>

  const { fecha, serie } = ocurrencia
  const editaLaFecha = {
    bloqueAgendaId: destino.id,
    fechaInicio: fechaDestino,
    fechaFin: fechaDestino,
  }
  if (ocurrencia.tipo === 'SESION_UNICA') {
    return { ...sinCambios, original: editaLaFecha }
  }

  // Recurrente: hay ocurrencia anterior / siguiente según el inicio y el fin efectivo de la serie.
  const anterior = sumarDias(fecha, -7)
  const siguiente = sumarDias(fecha, 7)
  const hayAnterior = anterior >= serie.fechaInicio
  const haySiguiente = serie.finEfectivo === null || siguiente <= serie.finEfectivo

  if (!hayAnterior && !haySiguiente) {
    // Su única fecha: no queda ninguna ocurrencia en el original, se edita como sesión única. Su
    // finalización ya no tiene sentido (y podría cortar la fecha movida): se borra.
    return {
      ...sinCambios,
      original: { tipo: 'SESION_UNICA', ...editaLaFecha },
      borrarFinalizacion: turno.tieneFinalizacion,
    }
  }
  if (!hayAnterior) {
    // La primera fecha: el original arranca en la siguiente; no hay tramo nuevo.
    return { ...sinCambios, original: { fechaInicio: siguiente }, sesionNueva: true }
  }
  if (!haySiguiente) {
    // La última: el original termina en la anterior; la finalización, si hay, queda con él.
    return { ...sinCambios, original: { fechaFin: anterior }, sesionNueva: true }
  }
  // En el medio: original hasta la anterior, tramo nuevo desde la siguiente hasta el fin original.
  return {
    ...sinCambios,
    original: { fechaFin: anterior },
    tramoNuevo: { fechaInicio: siguiente, fechaFin: serie.fechaFin },
    sesionNueva: true,
    finalizacionAlTramo: turno.tieneFinalizacion,
    reapuntarPosterioresAlTramo: true,
  }
}
