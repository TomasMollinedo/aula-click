import { format, parseISO } from 'date-fns'

import { nombreDiaSemana } from '@/utils/dias-semana'

import type { BloqueAula, BloqueHorario } from './profesores.types'

// Presentación del horario del profesor. La API guarda y devuelve una fila por hora (T-29); agrupar
// las horas contiguas en un "bloque" es solo visual, no una regla de negocio.

/** Horas contiguas del mismo día y la misma aula, como las muestra la sección "Horario". */
export type BloqueAgrupado = {
  /** Estable mientras no cambien sus horas: sirve de `key` en React. */
  clave: string
  diaSemana: number
  aula: BloqueAula
  horaInicio: string
  horaFin: string
  horas: BloqueHorario[]
}

function compararFilas(a: BloqueHorario, b: BloqueHorario): number {
  // `HH:mm` con dos dígitos: la comparación de textos es la de horas.
  return a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio) || a.id - b.id
}

/**
 * Agrupa las filas del horario en bloques: mismo día, misma aula y horas contiguas (el fin de una es
 * el inicio de la siguiente). Los bloques y sus horas quedan ordenados por día y hora, aunque las
 * filas lleguen en otro orden.
 */
export function agruparHorario(filas: readonly BloqueHorario[]): BloqueAgrupado[] {
  const bloques: BloqueAgrupado[] = []
  for (const fila of [...filas].sort(compararFilas)) {
    const ultimo = bloques.at(-1)
    if (
      ultimo &&
      ultimo.diaSemana === fila.diaSemana &&
      ultimo.aula.id === fila.aula.id &&
      ultimo.horaFin === fila.horaInicio
    ) {
      ultimo.horas.push(fila)
      ultimo.horaFin = fila.horaFin
      ultimo.clave = `${ultimo.clave}-${fila.id}`
    } else {
      bloques.push({
        clave: String(fila.id),
        diaSemana: fila.diaSemana,
        aula: fila.aula,
        horaInicio: fila.horaInicio,
        horaFin: fila.horaFin,
        horas: [fila],
      })
    }
  }
  return bloques
}

/** Horas en punto `HH:00` de `desde` a `hasta` (0 a 23), inclusive. */
function horasEnPunto(desde: number, hasta: number): string[] {
  return Array.from(
    { length: hasta - desde + 1 },
    (_, i) => `${String(desde + i).padStart(2, '0')}:00`,
  )
}

// El contrato acepta `HH:mm` de 00:00 a 23:59 en punto: la última hora que puede empezar es 22:00
// (termina a las 23:00) y la última que puede terminar, 23:00. No hay un horario de apertura.
/** Opciones del selector de hora de inicio: 00:00 a 22:00. */
export const OPCIONES_HORA_INICIO = horasEnPunto(0, 22)
/** Opciones del selector de hora de fin: 01:00 a 23:00. */
export const OPCIONES_HORA_FIN = horasEnPunto(1, 23)

/**
 * `HH:00` una hora después (`'08:00'` → `'09:00'`): la hora de fin de una fila, que siempre dura
 * una hora. `null` si la hora no es una hora en punto que tenga una siguiente dentro del día.
 */
export function unaHoraDespues(hora: string): string | null {
  const indice = OPCIONES_HORA_INICIO.indexOf(hora)
  return indice === -1 ? null : (OPCIONES_HORA_FIN[indice] ?? null)
}

/**
 * A qué fecha corresponde la ocupación de una hora (`proximaFecha`, `YYYY-MM-DD`, que calcula la
 * API): `'próximo lunes 28/09'`, o `'hoy, lunes 22/09'` si es `hoy` (la fecha local, `YYYY-MM-DD`).
 */
export function etiquetaProximaFecha(proximaFecha: string, diaSemana: number, hoy: string): string {
  // parseISO interpreta una fecha sin hora como hora local (nunca `new Date('YYYY-MM-DD')`).
  const fecha = format(parseISO(proximaFecha), 'dd/MM')
  const dia = nombreDiaSemana(diaSemana).toLowerCase()
  return proximaFecha === hoy ? `hoy, ${dia} ${fecha}` : `próximo ${dia} ${fecha}`
}
