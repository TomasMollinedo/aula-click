import { ZONA_HORARIA, dateAFecha, fechaADate } from './fechas'

// Textos para los documentos que arma el servidor (los PDF). Devuelven exactamente lo mismo que
// los formateadores del frontend (`src/utils/moneda.ts`, `src/utils/horas.ts` y los `format` de
// date-fns): el backend no importa código del frontend, así que tiene los suyos.

const PESOS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Importe en pesos con dos decimales y separadores de es-AR: `7500` → "$ 7.500,00". Entre el `$`
 * y el número Intl pone un espacio duro (U+00A0).
 */
export function formatearPesos(importe: number): string {
  return PESOS.format(importe)
}

/**
 * Fecha de calendario en un documento: `'2026-10-05'` → `'05/10/2026'`. Lanza `RangeError` si no
 * es `YYYY-MM-DD` o la fecha no existe (lo valida `fechaADate`).
 */
export function fechaDocumento(fecha: string): string {
  const [anio, mes, dia] = dateAFecha(fechaADate(fecha)).split('-')
  return `${dia}/${mes}/${anio}`
}

// Las partes numéricas no dependen del formato del locale.
const formatoFechaHora = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * Un instante en la hora del negocio (`ZONA_HORARIA`), como `dd/MM/yyyy HH:mm`: la fecha de
 * emisión de un documento (`fechaHoraDocumento(ahora())`) o cuándo se registró algo. Lanza
 * `RangeError` si es un `Invalid Date`.
 */
export function fechaHoraDocumento(instante: Date): string {
  if (Number.isNaN(instante.getTime())) throw new RangeError('Instante inválido: Invalid Date')
  const partes = formatoFechaHora.formatToParts(instante)
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? ''
  return `${parte('day')}/${parte('month')}/${parte('year')} ${parte('hour')}:${parte('minute')}`
}

/** `HH:mm` para mostrar, sin el cero adelante de la hora (`'08:00'` → `'8:00'`). */
export function horaCorta(hora: string): string {
  return hora.replace(/^0(\d)/, '$1')
}

/** Rango para mostrar: `'8:00 a 12:00'`. */
export function rangoHoras(horaInicio: string, horaFin: string): string {
  return `${horaCorta(horaInicio)} a ${horaCorta(horaFin)}`
}

/**
 * Nombre y apellido en una sola línea (`'Laura Gómez'`), sin las partes vacías. Es el "Emitido
 * por" de un documento: el usuario de la sesión.
 */
export function nombreCompleto(
  nombre: string | null | undefined,
  apellido: string | null | undefined,
): string {
  return [nombre, apellido].filter(Boolean).join(' ')
}
