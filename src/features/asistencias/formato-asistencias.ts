import { format, parseISO } from 'date-fns'

import { rangoHoras } from '@/utils/horas'

import type { AsistenciasPendientes } from './asistencias.types'

// Textos de la pantalla "Asistencia" (HU-22). Sin reglas: estados, plazos y horas seguidas los
// manda la API.

/** Mensaje después de guardar una fila o "Marcar todos presentes". */
export const MENSAJE_REGISTRADA = 'Asistencia registrada'

/** Observación de un "Sin registrar" cerrado por el sistema (`dominio.md` → Asistencia). */
export const OBSERVACION_CIERRE_SISTEMA =
  'No registrada por el profesor en el plazo de 7 días. Cierre automático del sistema'

/** Largos máximos de los textos (los valida la API; acá, el contador y el formulario). */
export const MAX_TEXTO_PRESENTE = 1000
export const MAX_OBSERVACION = 500

/** `DD/MM` de una fecha `YYYY-MM-DD`. */
export function fechaCortaAsistencia(fecha: string): string {
  return format(parseISO(fecha), 'dd/MM')
}

/** El horario de una fila: `'8:00 a 11:00 (3 h)'`. */
export function textoHorarioFila(horaInicio: string, horaFin: string, horas: number): string {
  return `${rangoHoras(horaInicio, horaFin)} (${horas} h)`
}

/**
 * El aviso de pendientes: "Tenés 3 turnos sin registrar de días anteriores. El más antiguo se
 * puede registrar hasta el 12/10". `null` si no hay pendientes.
 */
export function textoPendientes(pendientes: AsistenciasPendientes): string | null {
  const { cantidad, masAntiguo } = pendientes
  if (cantidad === 0 || !masAntiguo) return null
  const turnos = cantidad === 1 ? '1 turno' : `${cantidad} turnos`
  const cual = cantidad === 1 ? 'Se' : 'El más antiguo se'
  return `Tenés ${turnos} sin registrar de días anteriores. ${cual} puede registrar hasta el ${fechaCortaAsistencia(masAntiguo.vence)}`
}

/** Contador de un texto: `'12/1000'`. */
export function textoContador(texto: string, max: number): string {
  return `${texto.length}/${max}`
}
