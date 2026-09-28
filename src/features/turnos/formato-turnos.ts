import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'

import { rangoHoras } from '@/utils/horas'

import type { FechasSinTurno, TipoTurno } from './turnos.types'

// Presentación de turnos: fechas, horarios y rangos como los pide la HU. Sin reglas: qué fechas
// quedan sin turno, la capacidad y la vigencia las decide la API. Las fechas son `YYYY-MM-DD` y se
// leen con `parseISO` (hora local), nunca con `new Date('YYYY-MM-DD')`.

/** `'08:00'`, `'12:00'` → `'de 8:00 a 12:00'`. */
export function textoHorario(horaInicio: string, horaFin: string): string {
  return `de ${rangoHoras(horaInicio, horaFin)}`
}

/** `'2026-10-12'` → `'12/10'`. */
export function fechaCorta(fecha: string): string {
  return format(parseISO(fecha), 'dd/MM')
}

/** `'2026-10-12'` → `'lunes 12/10'`. */
export function fechaConDia(fecha: string): string {
  return format(parseISO(fecha), 'EEEE dd/MM', { locale: es })
}

/**
 * Etiqueta de la ocupación de un resultado de disponibilidad: `'Ocupación del lunes 28/09'`.
 * Recibe siempre la `fecha` que devolvió la API en ese resultado, nunca la fecha pedida.
 */
export function etiquetaOcupacion(fechaDelResultado: string): string {
  return `Ocupación del ${fechaConDia(fechaDelResultado)}`
}

/**
 * Rango de fechas de un turno: `'sesión única del 12/10'`, `'recurrente del 05/10 al 30/11'` o
 * `'recurrente desde el 05/10, sin fin'`.
 */
export function textoRangoTurno(turno: {
  tipo: TipoTurno
  fechaInicio: string
  fechaFin: string | null
}): string {
  if (turno.tipo === 'SESION_UNICA') return `sesión única del ${fechaCorta(turno.fechaInicio)}`
  if (turno.fechaFin === null)
    return `recurrente desde el ${fechaCorta(turno.fechaInicio)}, sin fin`
  return `recurrente del ${fechaCorta(turno.fechaInicio)} al ${fechaCorta(turno.fechaFin)}`
}

/**
 * Rango pedido en el alta, para la confirmación: `'el 12/10'` (sesión única), `'desde el 05/10
 * hasta el 30/11'` o `'desde el 05/10, sin fecha de fin'`.
 */
export function textoRangoPedido(pedido: {
  tipo: TipoTurno
  fechaInicio: string
  fechaFin?: string | null
}): string {
  const inicio = fechaCorta(pedido.fechaInicio)
  if (pedido.tipo === 'SESION_UNICA') return `el ${inicio}`
  if (!pedido.fechaFin) return `desde el ${inicio}, sin fecha de fin`
  return `desde el ${inicio} hasta el ${fechaCorta(pedido.fechaFin)}`
}

/**
 * Aviso de una hora tildada que en la ocupación de otra fecha viene `lleno` (lo decide la API):
 * `'La hora de 9:00 a 10:00 está completa el lunes 05/10'`.
 */
export function avisoHoraCompleta(
  hora: { horaInicio: string; horaFin: string },
  fecha: string,
): string {
  return `La hora ${textoHorario(hora.horaInicio, hora.horaFin)} está completa el ${fechaConDia(fecha)}`
}

/** `['a']` → `'a'`; `['a', 'b', 'c']` → `'a, b y c'`. */
function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`
}

/**
 * Una línea por hora con fechas sin turno, para la confirmación del alta: `'De 9:00 a 10:00:
 * lunes 26/10 y lunes 09/11'`, con `completoDesde` como `'desde el lunes 02/11 en adelante'`. Las
 * horas sin fechas ni `completoDesde` no generan línea.
 */
export function lineasFechasSinTurno(fechasSinTurno: readonly FechasSinTurno[]): string[] {
  return fechasSinTurno.flatMap((hora) => {
    const partes = hora.fechas.map(fechaConDia)
    if (hora.completoDesde !== null) {
      partes.push(`desde el ${fechaConDia(hora.completoDesde)} en adelante`)
    }
    if (partes.length === 0) return []
    return [`De ${rangoHoras(hora.horaInicio, hora.horaFin)}: ${enumerar(partes)}`]
  })
}
