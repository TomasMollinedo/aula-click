import { addMonths, format, isValid, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'

import { fechaConDia } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'

import { mesDe } from './filtros-historial'
import type { BloqueDelPortal, MateriaDelPortal, TextosDelHistorial } from './historiales.types'

// "Mis materias" del portal del alumno (HU-33). Presentación y el mes de la URL (`?mes=AAAA-MM`):
// el próximo turno, el porcentaje, las indicaciones y los bloques los decide la API. "Hoy" se recibe.

/**
 * El mes de la URL si es un `AAAA-MM` real y no es posterior al de `hoy` (el historial llega hasta
 * hoy); si no, el mes en curso.
 */
export function parsearMes(valor: string | null, hoy: string): string {
  const actual = mesDe(hoy)
  if (valor === null || !/^\d{4}-\d{2}$/.test(valor)) return actual
  const fecha = parseISO(`${valor}-01`)
  if (!isValid(fecha) || format(fecha, 'yyyy-MM') !== valor) return actual
  return valor > actual ? actual : valor
}

/** El mes `AAAA-MM` que está `pasos` meses antes (negativo) o después (positivo). */
export function moverMes(mes: string, pasos: number): string {
  return format(addMonths(parseISO(`${mes}-01`), pasos), 'yyyy-MM')
}

/** `'2026-10'` → `'Octubre 2026'`. */
export function tituloDelMes(mes: string): string {
  const texto = format(parseISO(`${mes}-01`), 'LLLL yyyy', { locale: es })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** El próximo turno de una materia: `'martes 20/10 · 16:00 a 17:00'`, o `null` si no tiene. */
export function textoProximoTurno(proximo: MateriaDelPortal['proximoTurno']): string | null {
  if (proximo === null) return null
  return `${fechaConDia(proximo.fecha)} · ${rangoHoras(proximo.horaInicio, proximo.horaFin)}`
}

/** `null` si no trae ningún texto (la API puede mandar `{ trabajado: null, indicaciones: null }`). */
function conTexto(textos: TextosDelHistorial | null): TextosDelHistorial | null {
  return textos && (textos.trabajado !== null || textos.indicaciones !== null) ? textos : null
}

/**
 * Dónde van los textos de un bloque del portal. Si todas las horas tienen los mismos, van **una vez
 * arriba** (`arriba`). Si alguna tiene otros (la API manda sus `textosPropios`), no va nada arriba y
 * **cada hora muestra los suyos** (`porClase`, alineado con `bloque.clases`): una realizada sin
 * `textosPropios` tiene los del bloque (la API sólo los manda cuando difieren). Una ausente o
 * cancelada no tiene. No se comparan textos: lo que difiere lo dice la API.
 */
export function textosDelBloque(bloque: BloqueDelPortal): {
  arriba: TextosDelHistorial | null
  porClase: (TextosDelHistorial | null)[]
} {
  const porHora = bloque.clases.some((clase) => conTexto(clase.textosPropios) !== null)
  if (!porHora) return { arriba: conTexto(bloque.textos), porClase: bloque.clases.map(() => null) }
  return {
    arriba: null,
    porClase: bloque.clases.map((clase) =>
      clase.estado === 'REALIZADO' ? conTexto(clase.textosPropios ?? bloque.textos) : null,
    ),
  }
}
