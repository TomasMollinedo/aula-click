import { format, parseISO } from 'date-fns'

// Textos del tablero: cómo se escriben los números y los períodos que manda la API. Solo
// presentación: los cálculos (porcentajes, ocupación, qué cuenta cada indicador) los hace la API.

export const TEXTO_NO_DISPONIBLE = 'Disponible cuando se registre la asistencia'

const CANTIDAD = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const PORCENTAJE = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

/** `1234` → `"1.234"`. */
export function formatearCantidad(cantidad: number): string {
  return CANTIDAD.format(cantidad)
}

/** El porcentaje de la API (0 a 100, un decimal) con coma y sin ceros de más: `33.3` → `"33,3 %"`. */
export function formatearPorcentaje(porcentaje: number): string {
  return `${PORCENTAJE.format(porcentaje)} %`
}

/** `'2026-10-02'` → `'02/10/2026'`. */
export function fechaCompleta(fecha: string): string {
  return format(parseISO(fecha), 'dd/MM/yyyy')
}

/**
 * El período con el que se rotula un indicador: `'02/10/2026'` si es un solo día, `'28/09 al
 * 04/10/2026'` si los dos extremos son del mismo año y `'28/12/2025 al 04/01/2026'` si no.
 */
export function textoPeriodo(desde: string, hasta: string): string {
  if (desde === hasta) return fechaCompleta(desde)
  const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4)
  const inicio = mismoAnio ? format(parseISO(desde), 'dd/MM') : fechaCompleta(desde)
  return `${inicio} al ${fechaCompleta(hasta)}`
}

/** El rótulo de un indicador que corresponde al período de la respuesta. */
export function rotuloDelPeriodo(periodo: { desde: string; hasta: string }): string {
  return `Período: ${textoPeriodo(periodo.desde, periodo.hasta)}`
}

/** El rótulo del total adeudado: es la deuda a la fecha `hoy`, no la del período. */
export function rotuloALaFecha(hoy: string): string {
  return `A la fecha: ${fechaCompleta(hoy)}`
}

/** El ancho (0 a 100) de la barra de una materia respecto de la que más demanda tiene. */
export function anchoDeBarra(cantidad: number, maximo: number): number {
  return maximo <= 0 ? 0 : Math.round((cantidad / maximo) * 100)
}

/** `1` → `"1 turno"`, `15` → `"15 turnos"`. */
export function textoTurnos(cantidad: number): string {
  return `${formatearCantidad(cantidad)} ${cantidad === 1 ? 'turno' : 'turnos'}`
}
