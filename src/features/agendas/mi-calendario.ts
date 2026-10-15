import type { OcurrenciaDelPortal } from '@/types/ocurrencia'

import type { ModoAgenda } from './modo-agenda'

// "Mi calendario" del portal del alumno (HU-30). Solo presentación: qué turnos tiene y con qué
// estado lo decide la API (`GET /ocurrencias/mis-turnos`); acá se ordenan por día para la lista.
// Las fechas son `YYYY-MM-DD`; ninguna función usa `new Date()`: "hoy" se recibe.

/** Un día de la lista de "Mi calendario" con sus turnos. */
export type DiaDeMisTurnos = {
  fecha: string
  esHoy: boolean
  /** Anterior a hoy: se atenúa, como en el calendario. */
  esPasado: boolean
  turnos: OcurrenciaDelPortal[]
}

/**
 * El modo en que abre "Mi calendario" sin `?modo=`: el portal se usa sobre todo en el celular, donde
 * la grilla de la semana no entra y abre la lista; en una pantalla grande, el calendario.
 */
export function modoPorDefectoDeMiCalendario(esCelular: boolean): ModoAgenda {
  return esCelular ? 'lista' : 'calendario'
}

/**
 * Los turnos que se ven: sin `incluirCancelados`, las canceladas no (como en las agendas). La API las
 * manda siempre, así que se filtran acá, sobre lo que llegó.
 */
export function filtrarMisTurnos(
  turnos: readonly OcurrenciaDelPortal[],
  incluirCancelados: boolean,
): OcurrenciaDelPortal[] {
  return incluirCancelados ? [...turnos] : turnos.filter((turno) => turno.estado !== 'CANCELADO')
}

/**
 * Los turnos de la semana agrupados por día, de lunes a domingo, solo los días que tienen alguno.
 * Dentro de un día van por hora de inicio. Las canceladas quedan: el alumno las ve siempre.
 */
export function agruparMisTurnosPorDia(
  turnos: readonly OcurrenciaDelPortal[],
  hoy: string,
): DiaDeMisTurnos[] {
  const porFecha = new Map<string, OcurrenciaDelPortal[]>()
  for (const turno of turnos)
    porFecha.set(turno.fecha, [...(porFecha.get(turno.fecha) ?? []), turno])

  // `YYYY-MM-DD` y `HH:mm`: ordenar los textos es ordenar las fechas y las horas.
  return [...porFecha.keys()].sort().map((fecha) => ({
    fecha,
    esHoy: fecha === hoy,
    esPasado: fecha < hoy,
    turnos: [...porFecha.get(fecha)!].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
  }))
}
