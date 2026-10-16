import { diaSemanaISO, sumarDias } from '@/server/shared/fechas'
import { fechaConDia, fechaCorta, fechaDocumento } from '@/server/shared/formato'

// Los textos del documento PDF del tablero (T-130). Devuelven lo mismo que los de la pantalla
// (`src/features/tablero/formato-tablero.ts`): el backend no importa código del frontend, así que
// tiene los suyos. Funciones puras.

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

/**
 * El período con el que se rotula un indicador: `'02/10/2026'` si es un solo día, `'28/09 al
 * 04/10/2026'` si los dos extremos son del mismo año y `'28/12/2025 al 04/01/2026'` si no.
 */
export function textoPeriodo(desde: string, hasta: string): string {
  if (desde === hasta) return fechaDocumento(desde)
  const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4)
  return `${mismoAnio ? fechaCorta(desde) : fechaDocumento(desde)} al ${fechaDocumento(hasta)}`
}

/** El período con los dos años, para el encabezado del documento. */
export function periodoCompleto(desde: string, hasta: string): string {
  return desde === hasta
    ? fechaDocumento(desde)
    : `${fechaDocumento(desde)} al ${fechaDocumento(hasta)}`
}

/**
 * De qué tipo es el período, para el título del documento: `diario` (un solo día), `semanal` (de
 * lunes a domingo), `mensual` (del primero al último día de un mes) u `otro`. Solo es un rótulo:
 * qué cuenta cada indicador no depende de esto.
 */
export function tipoDePeriodo(
  desde: string,
  hasta: string,
): 'diario' | 'semanal' | 'mensual' | 'otro' {
  if (desde === hasta) return 'diario'
  if (diaSemanaISO(desde) === 1 && hasta === sumarDias(desde, 6)) return 'semanal'
  // `hasta` es el último día del mes si el día siguiente ya es el primero de otro.
  if (
    desde.endsWith('-01') &&
    hasta.slice(0, 7) === desde.slice(0, 7) &&
    sumarDias(hasta, 1).endsWith('-01')
  ) {
    return 'mensual'
  }
  return 'otro'
}

/** El título del documento según el período: "Tablero semanal", "Tablero diario"… */
export function tituloTablero(desde: string, hasta: string): string {
  switch (tipoDePeriodo(desde, hasta)) {
    case 'diario':
      return 'Tablero diario'
    case 'semanal':
      return 'Tablero semanal'
    case 'mensual':
      return 'Tablero mensual'
    case 'otro':
      return 'Tablero del período'
  }
}

/** `'2026-09-28'` → `'lunes 28/09/2026'`: el día de la semana y la fecha con el año. */
function fechaConDiaYAnio(fecha: string): string {
  const [dia = ''] = fechaConDia(fecha).split(' ')
  return `${dia} ${fechaDocumento(fecha)}`
}

/**
 * De qué día a qué día son los datos: `'Datos del lunes 28/09/2026 al domingo 04/10/2026'`, o
 * `'Datos del viernes 02/10/2026'` si es un solo día.
 */
export function textoRangoConDias(desde: string, hasta: string): string {
  return desde === hasta
    ? `Datos del ${fechaConDiaYAnio(desde)}`
    : `Datos del ${fechaConDiaYAnio(desde)} al ${fechaConDiaYAnio(hasta)}`
}

/** `{ apellido: 'Gómez', nombre: 'Ana' }` → `"Gómez, Ana"`. */
export function nombreProfesor({ apellido, nombre }: { apellido: string; nombre: string }): string {
  return `${apellido}, ${nombre}`
}

/** El título del documento de asistencia según el período: "Asistencia semanal"… */
export function tituloTableroAsistencia(desde: string, hasta: string): string {
  switch (tipoDePeriodo(desde, hasta)) {
    case 'diario':
      return 'Asistencia diaria'
    case 'semanal':
      return 'Asistencia semanal'
    case 'mensual':
      return 'Asistencia mensual'
    case 'otro':
      return 'Asistencia del período'
  }
}

/** El título del documento de finanzas según el período: "Finanzas semanal"… */
export function tituloTableroFinanzas(desde: string, hasta: string): string {
  switch (tipoDePeriodo(desde, hasta)) {
    case 'diario':
      return 'Finanzas diaria'
    case 'semanal':
      return 'Finanzas semanal'
    case 'mensual':
      return 'Finanzas mensual'
    case 'otro':
      return 'Finanzas del período'
  }
}

/** Cómo se escribe cada forma de pago en el documento. */
export const NOMBRE_FORMA_DE_PAGO = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Tarjeta de débito',
} as const

/**
 * El nombre del archivo (sin extensión): `tablero-2026-09-28_2026-10-04` para "General",
 * `tablero-asistencia-2026-09-28_2026-10-04` para "Asistencia" y `tablero-finanzas-…` para
 * "Finanzas". El guion bajo separa las dos fechas.
 */
export function nombreArchivoTablero(
  { desde, hasta }: { desde: string; hasta: string },
  seccion: 'general' | 'asistencia' | 'finanzas' = 'general',
): string {
  return `${seccion === 'general' ? 'tablero' : `tablero-${seccion}`}-${desde}_${hasta}`
}
