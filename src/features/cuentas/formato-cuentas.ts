import { format, parseISO } from 'date-fns'

import { fechaConDia } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'
import { formatearPesos } from '@/utils/moneda'

import type { FilaDeCuenta } from './a-cobrar'
import { type FiltrosCuenta, type SeccionDeCuenta, hayFiltros, hayPeriodo } from './filtros-cuenta'
import type { ResumenSeleccion } from './seleccion'

// Textos de la pestaña "Pagos" y de la vista global (HU-16). Los importes son los de la API.

type Periodo = Pick<FiltrosCuenta, 'desde' | 'hasta'>

/** `'1 turno seleccionado'` / `'4 turnos seleccionados'`. */
export function textoTurnosSeleccionados(cantidad: number): string {
  return cantidad === 1 ? '1 turno seleccionado' : `${cantidad} turnos seleccionados`
}

/**
 * El total a pagar de lo tildado: `'$ 32.000,00'`, o `'Sin calcular'` si alguno de los turnos no
 * tiene precio (la API no deja cobrarlo: el total real sale de la respuesta del pago).
 */
export function textoTotalAPagar({ total }: Pick<ResumenSeleccion, 'total'>): string {
  return total === null ? 'Sin calcular' : formatearPesos(total)
}

/** `'1 turno sin precio'` / `'2 turnos sin precio'`, o `null` si todos tienen. */
export function textoSinPrecio({ sinPrecio }: Pick<ResumenSeleccion, 'sinPrecio'>): string | null {
  if (sinPrecio === 0) return null
  return sinPrecio === 1 ? '1 turno sin precio' : `${sinPrecio} turnos sin precio`
}

/** Una fecha con el año, para el período y el tope: `'2026-10-01'` → `'01/10/2026'`. */
export function textoFecha(fecha: string): string {
  return format(parseISO(fecha), 'dd/MM/yyyy')
}

/**
 * La ocurrencia en palabras, para los `aria-label` de la casilla y de la acción de cada fila:
 * `'lunes 05/10 de 9:00 a 10:00, Matemática'`. Con `conAlumno` (vista global sin filtro, donde las
 * filas son de varios alumnos) suma el alumno: `'Lucía Álvarez, lunes 05/10 de 9:00 a 10:00, …'`.
 */
export function textoOcurrencia(fila: FilaDeCuenta, conAlumno = false): string {
  const turno = `${fechaConDia(fila.fecha)} de ${rangoHoras(fila.horaInicio, fila.horaFin)}, ${fila.materia.nombre}`
  if (!conAlumno || !('alumno' in fila)) return turno
  return `${fila.alumno.nombre} ${fila.alumno.apellido}, ${turno}`
}

/**
 * La etiqueta del total: con `desde` o `hasta` es la deuda **de ese período**, no la general. El
 * importe es el de la API, que ya respeta todos los filtros.
 */
export function etiquetaTotal(periodo: Periodo): string {
  return hayPeriodo(periodo) ? 'Total adeudado del período' : 'Total adeudado'
}

/** `'Del 01/09/2026 al 30/09/2026'`, `'Desde el 01/09/2026'`, `'Hasta el 30/09/2026'` o `null`. */
export function textoPeriodo({ desde, hasta }: Periodo): string | null {
  if (desde !== null && hasta !== null) return `Del ${textoFecha(desde)} al ${textoFecha(hasta)}`
  if (desde !== null) return `Desde el ${textoFecha(desde)}`
  if (hasta !== null) return `Hasta el ${textoFecha(hasta)}`
  return null
}

/**
 * Los filtros activos en una línea, para debajo del total (así no se lee como el total general):
 * `'Lucía Álvarez · Del 01/09/2026 al 30/09/2026 · Matemática · Prof. Ana Gómez'`. Recibe los
 * nombres ya resueltos (`null` = sin ese filtro). Sin ningún filtro, `null`.
 */
export function textoFiltrosActivos({
  alumno = null,
  desde,
  hasta,
  materia,
  profesor,
}: Periodo & { alumno?: string | null; materia: string | null; profesor: string | null }):
  string | null {
  const partes = [
    alumno,
    textoPeriodo({ desde, hasta }),
    materia,
    profesor === null ? null : `Prof. ${profesor}`,
  ].filter((parte): parte is string => parte !== null)
  return partes.length === 0 ? null : partes.join(' · ')
}

/**
 * El aviso de los próximos cuando el período pedido pasa el tope de cobro (o empieza después):
 * `'Los próximos turnos se pueden cobrar hasta el 26/11/2026'`, con la fecha de la API
 * (`limiteCobro`). Si el período no lo pasa, `null`. Solo tiene sentido si la sección aplica: quien
 * llama no lo pide con `proximos: null` o `aplica: false`.
 */
export function avisoDelTope({ desde, hasta }: Periodo, limiteCobro: string): string | null {
  const loPasa = (hasta !== null && hasta > limiteCobro) || (desde !== null && desde > limiteCobro)
  return loPasa ? `Los próximos turnos se pueden cobrar hasta el ${textoFecha(limiteCobro)}` : null
}

const SIN_FILAS: Record<SeccionDeCuenta, string> = {
  adeudados: 'Sin turnos adeudados',
  proximos: 'Sin próximos turnos',
}

/**
 * El vacío de una sección que aplica y no tiene filas: `'Sin turnos adeudados en el período'` con
 * un período, `'… con los filtros elegidos'` con materia o profesor y, sin filtros,
 * `'Sin turnos adeudados'` / `'Sin próximos turnos para cobrar'`.
 */
export function textoSinFilas(seccion: SeccionDeCuenta, filtros: FiltrosCuenta): string {
  if (hayPeriodo(filtros)) return `${SIN_FILAS[seccion]} en el período`
  if (hayFiltros({ materiaId: filtros.materiaId, profesorId: filtros.profesorId })) {
    return `${SIN_FILAS[seccion]} con los filtros elegidos`
  }
  return seccion === 'proximos' ? `${SIN_FILAS.proximos} para cobrar` : SIN_FILAS.adeudados
}
