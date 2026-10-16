import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'

// Los selectores de "Mes" y "Año" que reemplazan a un campo `YYYY-MM` (el historial académico y el
// listado de liquidaciones): funciones puras sobre un mes `YYYY-MM`. Ninguna usa `new Date()`:
// "hoy" se recibe (docs/arquitectura-frontend.md → Fechas y horas).

/** Cuántos años ofrece el selector del año, contando el actual. */
export const ANIOS_OFRECIDOS = 3

/** Los doce meses del año, por número (1 = enero), para el selector del mes. */
export const MESES_DEL_ANIO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/** El año de un mes `YYYY-MM` (o de una fecha `YYYY-MM-DD`). */
export function anioDe(mes: string): number {
  return Number(mes.slice(0, 4))
}

/** El número de mes (1 = enero) de un mes `YYYY-MM` (o de una fecha `YYYY-MM-DD`). */
export function numeroDeMes(mes: string): number {
  return Number(mes.slice(5, 7))
}

/** El mes `YYYY-MM` que forman un año y un número de mes. */
export function mesDeAnioYNumero(anio: number, numero: number): string {
  return `${String(anio).padStart(4, '0')}-${String(numero).padStart(2, '0')}`
}

/** `1` → `'enero'`. El año no entra: lo muestra el otro selector. */
export function etiquetaNumeroMes(numero: number): string {
  return format(parseISO(`2000-${String(numero).padStart(2, '0')}-01`), 'LLLL', { locale: es })
}

/**
 * Los años que ofrece el selector: el de `hoy` y los `ANIOS_OFRECIDOS - 1` anteriores, del más
 * reciente al más antiguo. Un año que viene en la URL y no está en la lista se agrega, así un
 * enlace a un mes viejo se sigue viendo elegido.
 */
export function aniosOfrecidos(hoy: string, mesElegido?: string): number[] {
  const actual = anioDe(hoy)
  const anios = Array.from({ length: ANIOS_OFRECIDOS }, (_, i) => actual - i)
  if (mesElegido === undefined) return anios
  const elegido = anioDe(mesElegido)
  if (anios.includes(elegido)) return anios
  return [...anios, elegido].sort((a, b) => b - a)
}

/** Si el mes `YYYY-MM` es posterior al de `hoy` (`YYYY-MM-DD`): los selectores no lo ofrecen. */
export function esMesFuturo(mes: string, hoy: string): boolean {
  return mes > hoy.slice(0, 7)
}
