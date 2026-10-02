import type { EstadoOcurrencia } from '@/server/features/turnos/ocurrencias.condiciones'
import type { OcurrenciaDelAlumnoItem } from './ocurrencias.validation'

// Lo propio de los documentos PDF de `ocurrencias` que no es dibujo: la forma de lo que el service
// le pasa a la plantilla de los turnos de un alumno y el nombre de archivo de cada documento
// (docs/contrato-api.md → Documentos PDF). `respuestaPdf` los sanea (tildes, espacios, mayúsculas).

/** Lo que va en el PDF de los turnos de un alumno: el alumno, el rango efectivo y los turnos. */
export type TurnosDelAlumnoDocumento = {
  alumno: { nombre: string; apellido: string; dni: string }
  /** El rango que se listó: el pedido o, sin él, la ventana por defecto del listado. */
  desde: string
  hasta: string
  /** Los turnos son los de una selección explícita (el documento lo dice, con cuántos son). */
  porSeleccion: boolean
  /** El estado por el que se filtró; `null` sin filtro o con una selección, que lo ignora. */
  estado: EstadoOcurrencia | null
  turnos: OcurrenciaDelAlumnoItem[]
}

/** `turno-2026-10-01-colque-renata` (sin extensión). */
export function nombreArchivoTurno(turno: {
  fecha: string
  alumno: { nombre: string; apellido: string }
}): string {
  return `turno-${turno.fecha}-${turno.alumno.apellido}-${turno.alumno.nombre}`
}

/** `turnos-alderete-joaquin-2026-10-01_2026-10-31` (sin extensión). */
export function nombreArchivoTurnosDelAlumno(
  documento: Pick<TurnosDelAlumnoDocumento, 'alumno' | 'desde' | 'hasta'>,
): string {
  const { alumno, desde, hasta } = documento
  return `turnos-${alumno.apellido}-${alumno.nombre}-${desde}_${hasta}`
}
