import { addDays, format, isSameMonth, isSameYear, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'

import type { FiltrosAgenda } from '@/types/agenda'
import { diaSemanaDeFecha } from '@/utils/dias-semana'

import { esRangoActual, normalizarFecha } from './agenda-propia'
import type { CalendarioItem, CalendarioParams, CupoClase, OrigenAgenda } from './agendas.types'

// El calendario semanal de una agenda (HU-19). Solo presentación: qué ocurrencias hay en la semana,
// con qué estado y con qué prioridad lo decide la API; acá se agrupan en clases y se ubican en la
// grilla. Las fechas son `YYYY-MM-DD` y se leen con `parseISO` (hora local), nunca con
// `new Date('YYYY-MM-DD')`. Ninguna función usa `new Date()`: "hoy" se recibe.

type Referencia = { id: number; nombre: string }
type Persona = { id: number; apellido: string; nombre: string }

/**
 * Una **clase**: una hora de un bloque en una fecha, con su profesor y su aula. Un bloque del horario
 * es una hora exacta, así que `fecha` + `bloqueAgendaId` la identifican (docs/contrato-api.md → La
 * ocurrencia de una agenda). Los turnos de la clase conservan cada uno su estado y su prioridad: la
 * clase no tiene un estado ni una prioridad propios.
 */
export type ClaseCalendario = {
  /** `fecha|bloqueAgendaId`: sirve de key y para saber cuáles están expandidas. */
  clave: string
  fecha: string
  bloqueAgendaId: number
  /** Hora en punto en la que cae la clase (la fila de la grilla). */
  hora: number
  horaInicio: string
  horaFin: string
  aula: Referencia
  /** Cuánto lugar tiene la clase, completo (no solo el de los turnos que quedan visibles). */
  cupo: CupoClase
  /** Solo la agenda del centro lo trae; en las de un profesor es siempre el mismo. */
  profesor: Persona | null
  /** Las materias distintas de sus turnos: un profesor puede dar varias en la misma hora. */
  materias: Referencia[]
  /** Por apellido y nombre. */
  turnos: CalendarioItem[]
}

export type DiaCalendario = {
  fecha: string
  /** ISO: 1 = lunes … 7 = domingo. */
  diaSemana: number
  esHoy: boolean
  /** Anterior a hoy: el calendario lo atenúa, ya no tiene relevancia. */
  esPasado: boolean
}

export type SemanaCalendario = {
  /** Solo los días con clases, de lunes a domingo. */
  dias: DiaCalendario[]
  /** Desde la hora de la primera clase de la semana hasta la de la última, sin saltear ninguna. */
  horas: number[]
  /** Las clases de cada celda (día y hora), por `claveDeCelda`. */
  celdas: ReadonlyMap<string, ClaseCalendario[]>
  totalClases: number
  totalTurnos: number
}

/** La hora en punto de un `HH:mm`: `'14:00'` → `14`. */
export function horaDe(horaInicio: string): number {
  return Number(horaInicio.slice(0, 2))
}

/** La hora para el encabezado de una fila: `8` → `'8:00'`. */
export function etiquetaDeHora(hora: number): string {
  return `${hora}:00`
}

export function claveDeCelda(fecha: string, hora: number): string {
  return `${fecha}|${hora}`
}

function compararAlumnos(a: CalendarioItem, b: CalendarioItem): number {
  return (
    a.alumno.apellido.localeCompare(b.alumno.apellido, 'es') ||
    a.alumno.nombre.localeCompare(b.alumno.nombre, 'es') ||
    a.turnoId - b.turnoId
  )
}

/**
 * Agrupa las ocurrencias en clases (misma fecha y mismo bloque). Conserva el orden en que llegan las
 * clases (la API ordena por fecha, hora y profesor) y ordena los alumnos de cada una. Una clase sin
 * ocurrencias no existe: no hay forma de que aparezca vacía.
 */
export function agruparClases(items: readonly CalendarioItem[]): ClaseCalendario[] {
  const clases = new Map<string, ClaseCalendario>()
  for (const item of items) {
    const clave = `${item.fecha}|${item.bloqueAgendaId}`
    const clase = clases.get(clave)
    if (!clase) {
      clases.set(clave, {
        clave,
        fecha: item.fecha,
        bloqueAgendaId: item.bloqueAgendaId,
        hora: horaDe(item.horaInicio),
        horaInicio: item.horaInicio,
        horaFin: item.horaFin,
        aula: item.aula,
        cupo: item.cupo,
        profesor: item.profesor ?? null,
        materias: [item.materia],
        turnos: [item],
      })
      continue
    }
    clase.turnos.push(item)
    if (!clase.materias.some((materia) => materia.id === item.materia.id)) {
      clase.materias.push(item.materia)
    }
  }
  for (const clase of clases.values()) clase.turnos.sort(compararAlumnos)
  return [...clases.values()]
}

/**
 * Ubica las clases de una semana en la grilla: los días que tienen clases (de lunes a domingo), las
 * horas desde la primera hasta la última y las clases de cada celda. Los días salen de las propias
 * ocurrencias, no de la semana pedida: mientras llega otra semana (`keepPreviousData`) la grilla
 * sigue mostrando la anterior completa.
 */
export function armarSemana(items: readonly CalendarioItem[], hoy: string): SemanaCalendario {
  const clases = agruparClases(items)
  const celdas = new Map<string, ClaseCalendario[]>()
  for (const clase of clases) {
    const clave = claveDeCelda(clase.fecha, clase.hora)
    celdas.set(clave, [...(celdas.get(clave) ?? []), clase])
  }

  // `YYYY-MM-DD`: ordenar los textos es ordenar las fechas.
  const fechas = [...new Set(clases.map((clase) => clase.fecha))].sort()
  const dias = fechas.map((fecha) => ({
    fecha,
    diaSemana: diaSemanaDeFecha(fecha),
    esHoy: fecha === hoy,
    // `YYYY-MM-DD`: comparar los textos es comparar las fechas.
    esPasado: fecha < hoy,
  }))

  const horasConClases = clases.map((clase) => clase.hora)
  const primera = Math.min(...horasConClases)
  const ultima = Math.max(...horasConClases)
  const horas =
    clases.length === 0 ? [] : Array.from({ length: ultima - primera + 1 }, (_, i) => primera + i)

  return { dias, horas, celdas, totalClases: clases.length, totalTurnos: items.length }
}

/** `1` → `'1 alumno'`, `3` → `'3 alumnos'`. */
export function textoAlumnos(cantidad: number): string {
  return cantidad === 1 ? '1 alumno' : `${cantidad} alumnos`
}

/** Cómo viene la ocupación de una clase: normal, casi llena (queda poco lugar) o llena. */
export type NivelDeCupo = 'llena' | 'casi' | 'normal'

// Desde esta ocupación (o cuando queda un solo lugar) la clase se marca como casi llena.
const OCUPACION_CASI_LLENA = 0.75

/**
 * La ocupación de la clase a partir de su cupo (los números los calcula la API): llena si
 * `ocupados >= capacidad` (la misma regla del alta de turnos); casi llena si queda un solo lugar o
 * se ocupó el 75 % o más. `libres` nunca es negativo.
 */
export function disponibilidadDeClase(cupo: CupoClase): { nivel: NivelDeCupo; libres: number } {
  const libres = Math.max(cupo.capacidad - cupo.ocupados, 0)
  if (cupo.ocupados >= cupo.capacidad) return { nivel: 'llena', libres: 0 }
  const casiLlena =
    libres === 1 || cupo.ocupados / Math.max(cupo.capacidad, 1) >= OCUPACION_CASI_LLENA
  return { nivel: casiLlena ? 'casi' : 'normal', libres }
}

/** `'Llena'`, `'1 cupo libre'`, `'4 cupos libres'`: acompaña a "2/6 ocupados". */
export function textoDisponibilidad({ nivel, libres }: { nivel: NivelDeCupo; libres: number }) {
  if (nivel === 'llena') return 'Llena'
  return libres === 1 ? '1 cupo libre' : `${libres} cupos libres`
}

/** Cuántos de los turnos de la clase están cancelados. */
export function cantidadCancelados(clase: ClaseCalendario): number {
  return clase.turnos.filter((turno) => turno.estado === 'CANCELADO').length
}

/** Cuántos turnos de la clase tienen prioridad alta y cuántos media (los cancelados no tienen). */
export function cantidadPorPrioridad(clase: ClaseCalendario): { alta: number; media: number } {
  return {
    alta: clase.turnos.filter((turno) => turno.prioridad === 'ALTA').length,
    media: clase.turnos.filter((turno) => turno.prioridad === 'MEDIA').length,
  }
}

/**
 * Los filtros que valen en el origen: el de profesor solo lo tiene el centro. En las agendas de un
 * profesor (la ficha y "Mi agenda") ese profesor ya está fijado, y un `?profesorId=` en la URL no
 * tiene que cambiar nada.
 */
export function filtrosDelOrigen(origen: OrigenAgenda, filtros: FiltrosAgenda): FiltrosAgenda {
  return origen.tipo === 'centro' ? filtros : { ...filtros, profesorId: null }
}

/** Lo que se le pide a la API para una semana: el origen, el rango y los filtros (lo vacío no viaja). */
export function paramsDelCalendario(
  origen: OrigenAgenda,
  rango: { desde: string; hasta: string },
  filtros: FiltrosAgenda,
): CalendarioParams {
  const efectivos = filtrosDelOrigen(origen, filtros)
  return {
    origen,
    desde: rango.desde,
    hasta: rango.hasta,
    profesorId: efectivos.profesorId ?? undefined,
    incluirCancelados: efectivos.incluirCancelados || undefined,
    prioridad: efectivos.prioridad ?? undefined,
  }
}

/**
 * Query params de la URL para mostrar la semana de `fecha`, a partir de los actuales (sin mutarlos):
 * conserva los demás (modo, filtros, tab) y omite `fecha` si es la semana de `hoy`. Guarda el lunes.
 * No toca `vista`, que es de la lista: al volver a ella se conserva.
 */
export function paramsDeSemana(
  actuales: URLSearchParams,
  fecha: string,
  hoy: string,
): URLSearchParams {
  const params = new URLSearchParams(actuales)
  const lunes = normalizarFecha('semana', fecha)
  if (esRangoActual('semana', lunes, hoy)) params.delete('fecha')
  else params.set('fecha', lunes)
  return params
}

/**
 * La semana que empieza en `desde` (un lunes), para el encabezado, abreviada para que entre en una
 * pantalla angosta: `'5 – 11 oct 2026'`, `'28 sep – 4 oct 2026'`, `'28 dic 2026 – 3 ene 2027'`.
 */
export function tituloDeSemana(desde: string): string {
  const inicio = parseISO(desde)
  const fin = addDays(inicio, 6)
  const conAnio = 'd MMM yyyy'
  if (isSameMonth(inicio, fin)) {
    return `${format(inicio, 'd')} – ${format(fin, conAnio, { locale: es })}`
  }
  if (isSameYear(inicio, fin)) {
    return `${format(inicio, 'd MMM', { locale: es })} – ${format(fin, conAnio, { locale: es })}`
  }
  return `${format(inicio, conAnio, { locale: es })} – ${format(fin, conAnio, { locale: es })}`
}

// ---------------------------------------------------------------------------------------------
// Filtros de la grilla: materia, aula y alumno
// ---------------------------------------------------------------------------------------------

// Se aplican acá, sobre la semana que ya llegó, y no en la API: son coincidencias de id
// sin reglas de negocio, así responden al instante y los selectores se arman con lo que hay en la
// semana. Los de estado, prioridad y profesor siguen siendo de la API (`useFiltrosAgenda`).

export type FiltrosGrilla = {
  materia: Referencia | null
  aula: Referencia | null
  /** El alumno elegido (`nombre` es "Apellido, Nombre"); `null` = todos. */
  alumno: Referencia | null
}

export const FILTROS_GRILLA_VACIOS: FiltrosGrilla = { materia: null, aula: null, alumno: null }

export function hayFiltrosGrilla(filtros: FiltrosGrilla): boolean {
  return filtros.materia !== null || filtros.aula !== null || filtros.alumno !== null
}

/** Cómo se llama un alumno en el selector y en el calendario: "Apellido, Nombre". */
function nombreDeAlumno({ apellido, nombre }: { apellido: string; nombre: string }): string {
  return `${apellido}, ${nombre}`
}

/**
 * Las ocurrencias que pasan los filtros de la grilla, en el mismo orden. Los tres son un valor
 * elegido de un selector (materia, aula y alumno) y se combinan.
 */
export function filtrarOcurrencias(
  items: readonly CalendarioItem[],
  { materia, aula, alumno }: FiltrosGrilla,
): CalendarioItem[] {
  return items.filter(
    (item) =>
      (materia === null || item.materia.id === materia.id) &&
      (aula === null || item.aula.id === aula.id) &&
      (alumno === null || item.alumno.id === alumno.id),
  )
}

/**
 * Las materias, las aulas y los alumnos de la semana, para los selectores, ordenados por nombre.
 * Salen de lo que llegó de la API, antes de filtrar con la grilla: elegir una no deja a las demás
 * sin opción.
 */
export function opcionesDeFiltros(items: readonly CalendarioItem[]): {
  materias: Referencia[]
  aulas: Referencia[]
  alumnos: Referencia[]
} {
  const materias = new Map<number, Referencia>()
  const aulas = new Map<number, Referencia>()
  const alumnos = new Map<number, Referencia>()
  for (const { materia, aula, alumno } of items) {
    materias.set(materia.id, materia)
    aulas.set(aula.id, aula)
    alumnos.set(alumno.id, { id: alumno.id, nombre: nombreDeAlumno(alumno) })
  }
  const porNombre = (a: Referencia, b: Referencia) => a.nombre.localeCompare(b.nombre, 'es')
  return {
    materias: [...materias.values()].sort(porNombre),
    aulas: [...aulas.values()].sort(porNombre),
    alumnos: [...alumnos.values()].sort(porNombre),
  }
}
