import { fechaConDia } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'

import type { OcurrenciaACancelar } from './cancelaciones.types'

// Presentación de la cancelación: el resumen de confirmación y los mensajes de éxito, como los pide
// la HU. Sin reglas: qué se puede cancelar lo decide la API.

/** `'Matemática del lunes 12/10 de 9:00 a 10:00'`, más `', con Ana Gómez'` si se conoce el profesor. */
export function textoOcurrencia(o: OcurrenciaACancelar): string {
  const con = o.profesor ? `, con ${o.profesor.nombre} ${o.profesor.apellido}` : ''
  return `${o.materia.nombre} del ${fechaConDia(o.fecha)} de ${rangoHoras(o.horaInicio, o.horaFin)}${con}`
}

/**
 * Pregunta de confirmación de una sola ocurrencia: `'¿Cancelar el turno de Matemática de Ana Pérez
 * del lunes 12/10 de 9:00 a 10:00?'`. Sin `alumno` (la lista de turnos de un alumno ya sabe de
 * quién es) se omite.
 */
export function preguntaUna(o: OcurrenciaACancelar, alumno?: string): string {
  const de = alumno ? ` de ${alumno}` : ''
  return `¿Cancelar el turno de ${o.materia.nombre}${de} del ${fechaConDia(o.fecha)} de ${rangoHoras(o.horaInicio, o.horaFin)}?`
}

/** `'¿Cancelar 3 turnos?'`. */
export function preguntaVarias(cantidad: number): string {
  return `¿Cancelar ${cantidad} turnos?`
}

/** Mensaje del toast cuando la API confirma. */
export function mensajeCancelado(cantidad: number): string {
  return cantidad === 1
    ? 'Turno cancelado. El lugar quedó disponible.'
    : `Se cancelaron ${cantidad} turnos. Los lugares quedaron disponibles.`
}
