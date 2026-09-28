// Fechas de calendario y "hoy" del negocio (docs/convenciones-backend.md → Fechas y horas).
// Una fecha de calendario es un string YYYY-MM-DD; Prisma devuelve `@db.Date` como un Date a las
// 00:00 UTC de ese día.

/** Fuente de la hora actual. Se inyecta en los services para poder testearlos. */
export type Reloj = () => Date

/** Zona horaria del negocio. */
export const ZONA_HORARIA = 'America/Argentina/Salta'

const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/

// Se crea una sola vez. Las partes numéricas no dependen del formato del locale.
const formatoSalta = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// Reloj del sistema: el único `new Date()` sin argumentos de todo src/server/.
const relojDelSistema: Reloj = () => new Date()

/** Fecha de hoy en `America/Argentina/Salta`, como `YYYY-MM-DD`. */
export function hoy(reloj: Reloj = relojDelSistema): string {
  const partes = formatoSalta.formatToParts(reloj())
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? ''
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

/**
 * `YYYY-MM-DD` → `Date` a las 00:00 UTC de ese día (lo que Prisma espera para `@db.Date`).
 * Lanza `RangeError` si el formato es inválido o la fecha no existe (`2026-02-30`).
 */
export function fechaADate(fecha: string): Date {
  const partes = FORMATO_FECHA.exec(fecha)
  if (!partes) throw new RangeError(`Fecha inválida: "${fecha}" (se espera YYYY-MM-DD)`)
  const date = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])))
  // Date.UTC desborda (30 de febrero → 2 de marzo): si no vuelve igual, la fecha no existe.
  if (dateAFecha(date) !== fecha) throw new RangeError(`Fecha inexistente: "${fecha}"`)
  return date
}

/**
 * `Date` → `YYYY-MM-DD` con sus campos UTC (inversa de `fechaADate`).
 * Lanza `RangeError` si es un `Invalid Date`.
 */
export function dateAFecha(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new RangeError('Fecha inválida: Invalid Date')
  const anio = String(date.getUTCFullYear()).padStart(4, '0')
  const mes = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(date.getUTCDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/**
 * `YYYY-MM-DD` → día de la semana ISO: 1 = lunes … 7 = domingo.
 * Lanza `RangeError` si la fecha es inválida.
 */
export function diaSemanaISO(fecha: string): number {
  const dia = fechaADate(fecha).getUTCDay()
  return dia === 0 ? 7 : dia
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * Próxima fecha (`YYYY-MM-DD`) que cae en `diaSemana` (ISO: 1 = lunes … 7 = domingo) a partir de
 * `desde`, **incluido**: si `desde` ya es ese día, lo devuelve. Lanza `RangeError` si `diaSemana`
 * no es un entero de 1 a 7 o si `desde` es inválida.
 */
export function proximaFechaDelDia(diaSemana: number, desde: string): string {
  if (!Number.isInteger(diaSemana) || diaSemana < 1 || diaSemana > 7) {
    throw new RangeError(`Día de la semana inválido: ${diaSemana} (se espera un entero de 1 a 7)`)
  }
  const dias = (diaSemana - diaSemanaISO(desde) + 7) % 7
  return dateAFecha(new Date(fechaADate(desde).getTime() + dias * MS_POR_DIA))
}
