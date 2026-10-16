import { format, parseISO } from 'date-fns'

import type { CodigoFormaPago } from './tablero.types'

// Textos del tablero: cómo se escriben los números y los períodos que manda la API. Solo
// presentación: los cálculos (porcentajes, ocupación, qué cuenta cada indicador) los hace la API.

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

/** `{ apellido: 'Gómez', nombre: 'Ana' }` → `"Gómez, Ana"`, como en el resto de la app. */
export function nombreDeProfesor({
  apellido,
  nombre,
}: {
  apellido: string
  nombre: string
}): string {
  return `${apellido}, ${nombre}`
}

/**
 * Las clases cuyo turno cerró el sistema: `'clases del 14/10/2026'` si es un solo día y `'clases
 * del 10/09/2026 al 14/10/2026'` si son varios.
 */
export function textoClasesCerradas({ desde, hasta }: { desde: string; hasta: string }): string {
  return desde === hasta
    ? `clases del ${fechaCompleta(desde)}`
    : `clases del ${fechaCompleta(desde)} al ${fechaCompleta(hasta)}`
}

/** `1` → `"1 turno"`, `15` → `"15 turnos"`. */
export function textoTurnos(cantidad: number): string {
  return `${formatearCantidad(cantidad)} ${cantidad === 1 ? 'turno' : 'turnos'}`
}

/**
 * La forma de pago para mostrar (HU-39): la API manda sólo el código. Es un `Record` completo, así
 * que una forma nueva en el contrato no compila hasta decidir cómo se escribe.
 */
export const ETIQUETA_FORMA_PAGO: Record<CodigoFormaPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Débito',
}

/**
 * El pie de una tabla paginada: `"Mostrando 1–10 de 23 profesores"`. Los números son los de la
 * `meta` de la API; `nombres` es el sustantivo en singular y en plural.
 */
export function textoMostrando(
  meta: { page: number; pageSize: number; total: number },
  nombres: { singular: string; plural: string },
): string {
  const desde = (meta.page - 1) * meta.pageSize + 1
  const hasta = Math.min(meta.page * meta.pageSize, meta.total)
  const sustantivo = meta.total === 1 ? nombres.singular : nombres.plural
  return `Mostrando ${formatearCantidad(desde)}–${formatearCantidad(hasta)} de ${formatearCantidad(meta.total)} ${sustantivo}`
}
