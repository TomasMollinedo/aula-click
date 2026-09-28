import type { BloqueDisponible, HoraDisponible, TurnoDetalle } from './turnos.types'

// Selección de la pantalla de registrar turno: identificar un resultado de disponibilidad, cruzar
// lo tildado con la respuesta nueva y agrupar el alta por hora. Sin reglas: `lleno` lo decide la
// API y acá solo se lee; no se comparan ocupaciones con capacidades ni fechas entre sí.

/**
 * Identidad de un resultado de disponibilidad: sus horas (los `bloqueIds`, ordenados). Es lo que
 * se busca en la respuesta del refresco por fecha: "el mismo bloque" es el que tiene las mismas
 * horas, aunque cambien su `fecha` y su ocupación.
 */
export function claveBloque(bloque: Pick<BloqueDisponible, 'horas'>): string {
  return bloque.horas
    .map((hora) => hora.bloqueId)
    .sort((a, b) => a - b)
    .join('-')
}

/** El resultado con esa clave, o `null` si la respuesta no lo trae. */
export function buscarBloque(
  resultados: readonly BloqueDisponible[] | undefined,
  clave: string,
): BloqueDisponible | null {
  return resultados?.find((bloque) => claveBloque(bloque) === clave) ?? null
}

/** Las horas tildadas que en `bloque` vienen `lleno` (según la API), en el orden del bloque. */
export function tildadasLlenas(
  bloque: Pick<BloqueDisponible, 'horas'>,
  tildadas: readonly number[],
): HoraDisponible[] {
  return bloque.horas.filter((hora) => hora.lleno && tildadas.includes(hora.bloqueId))
}

/** Una hora del alta con sus tramos (un turno por tramo), para la confirmación. */
export type HoraConTramos = {
  bloqueId: number
  horaInicio: string
  horaFin: string
  tramos: TurnoDetalle[]
}

/**
 * Agrupa los turnos creados por hora, en el orden en que los devuelve la API (por hora y fecha de
 * inicio). Cada tramo de un recurrente con fechas salteadas es un turno propio.
 */
export function agruparTurnosPorHora(turnos: readonly TurnoDetalle[]): HoraConTramos[] {
  const horas: HoraConTramos[] = []
  for (const turno of turnos) {
    const hora = horas.find((h) => h.bloqueId === turno.bloqueId)
    if (hora) hora.tramos.push(turno)
    else {
      horas.push({
        bloqueId: turno.bloqueId,
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
        tramos: [turno],
      })
    }
  }
  return horas
}
