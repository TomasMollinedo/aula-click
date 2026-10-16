import { ValidationError } from '@/server/errors'
import {
  OBSERVACION_CIERRE_SISTEMA,
  agruparHorasSeguidas,
  textosDeHorasSeguidas,
  type Ocurrencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import { fechaADate } from '@/server/shared/fechas'
import { mesDe, minutosAHora, primerDiaDelMes, ultimoDiaDelMes } from '@/server/shared/zod'
import type {
  BloqueDelHistorial,
  BloqueDelPortal,
  ClaseDelHistorial,
  GrupoDelHistorial,
  HistorialDelAlumno,
  MiMateriaItem,
  ResumenDelHistorial,
} from './historiales.validation'

// Reglas puras del historial académico (T-108, HU-31 y HU-33): el período que se puede pedir, la
// agrupación por materia y profesor, los bloques de **horas seguidas**, el resumen y el porcentaje.
// Sin Prisma y sin `hoy()` adentro: "hoy" lo pasa el service, como en `tablero.reglas.ts`.
//
// Nada del motor se reimplementa: los grupos salen de `agruparHorasSeguidas` y los textos de
// `textosDeHorasSeguidas` (los dos de `turnos`, T-74 y T-84), y el estado y el plazo de cada hora
// ya vienen calculados en la `Ocurrencia`.

/** Días que puede abarcar el período, extremos incluidos (el mismo tope que el tablero). */
export const MAX_DIAS_HISTORIAL = 366

/** Hasta cuántos días adelante se busca el próximo turno de "Mis materias" (HU-33). */
export const HORIZONTE_PROXIMO_TURNO = 366

// Los mismos textos que `cuentas.validation.ts` y `tablero.reglas.ts`. No se importan: de otra
// feature sólo se importan sus `*.repository` y sus `*.condiciones` (lo hace cumplir ESLint).
export const MENSAJE_RANGO_INVERTIDO = 'La fecha hasta no puede ser anterior a la fecha desde'
export const MENSAJE_RANGO_MAXIMO = `El período no puede superar los ${MAX_DIAS_HISTORIAL} días`

const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Lo que las reglas miran de una ocurrencia (una `Ocurrencia` del motor lo cumple). */
export type OcurrenciaHistorial = Pick<
  Ocurrencia,
  | 'turnoId'
  | 'fecha'
  | 'horaInicio'
  | 'horaFin'
  | 'alumnoId'
  | 'profesorId'
  | 'materiaId'
  | 'estado'
  | 'asistencia'
  | 'plazoAsistencia'
  | 'cancelacion'
> & {
  materia: Pick<Ocurrencia['materia'], 'id' | 'nombre'>
  profesor: Pick<Ocurrencia['profesor'], 'id' | 'nombre' | 'apellido'>
}

// ---------------------------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------------------------

/** Primer y último día del mes `YYYY-MM`, como período `{ desde, hasta }`. */
export function rangoDelMes(mes: string): { desde: string; hasta: string } {
  return { desde: primerDiaDelMes(mes), hasta: ultimoDiaDelMes(mes) }
}

/** El período por defecto de los dos endpoints: el mes en curso completo. */
export function mesEnCurso(fechaHoy: string): { desde: string; hasta: string } {
  return rangoDelMes(mesDe(fechaHoy))
}

/**
 * El período pedido está en orden y no supera `MAX_DIAS_HISTORIAL` días (extremos incluidos); si
 * no, 400 en `hasta`, como el resto de los rangos de la API. El tope existe porque la expansión de
 * las ocurrencias es en memoria (decisión T-147).
 */
export function validarPeriodo(desde: string, hasta: string): void {
  if (hasta < desde) {
    throw new ValidationError(MENSAJE_RANGO_INVERTIDO, {
      details: [{ path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO }],
    })
  }
  const dias = (fechaADate(hasta).getTime() - fechaADate(desde).getTime()) / MS_POR_DIA + 1
  if (dias > MAX_DIAS_HISTORIAL) {
    throw new ValidationError(MENSAJE_RANGO_MAXIMO, {
      details: [{ path: ['hasta'], message: MENSAJE_RANGO_MAXIMO }],
    })
  }
}

// ---------------------------------------------------------------------------------------------
// Estado de una hora
// ---------------------------------------------------------------------------------------------

/**
 * Un "Sin registrar" con el plazo vencido: cerrado por el sistema (decisión T-138). La misma
 * condición que `estaCerradaPorSistema` de `ocurrencias.reglas.ts`, que es privada de esa feature:
 * ESLint no deja importarla, y es una línea.
 */
export function estaCerradaPorSistema(
  ocurrencia: Pick<OcurrenciaHistorial, 'estado' | 'plazoAsistencia'>,
): boolean {
  return ocurrencia.estado === 'SIN_REGISTRAR' && ocurrencia.plazoAsistencia?.vencido === true
}

/**
 * La observación que se muestra de una hora: la de la ausencia, o la del cierre del sistema en un
 * "Sin registrar" vencido. `null` en el resto. Los textos de un presente no van acá: van en los
 * `textos` del bloque (o en sus `textosPropios`).
 */
function observacionDe(ocurrencia: OcurrenciaHistorial): string | null {
  if (ocurrencia.estado === 'AUSENTE') return ocurrencia.asistencia?.observacion ?? null
  return estaCerradaPorSistema(ocurrencia) ? OBSERVACION_CIERRE_SISTEMA : null
}

// ---------------------------------------------------------------------------------------------
// Bloques y grupos
// ---------------------------------------------------------------------------------------------

/** Las horas de un día que van juntas, antes de armar el DTO (horas en minutos, como el motor). */
type GrupoDeHoras = {
  materiaId: number
  profesorId: number
  fecha: string
  horaInicio: number
  horaFin: number
  ocurrencias: OcurrenciaHistorial[]
}

/**
 * Los grupos de horas del alumno: las **horas seguidas** de `agruparHorasSeguidas` (que excluye
 * las canceladas y las usa para cortar la cadena) más **cada cancelada como un bloque de una**, que
 * en el historial igual se muestra con su motivo (HU-13).
 */
function gruposDeHoras(ocurrencias: readonly OcurrenciaHistorial[]): GrupoDeHoras[] {
  const seguidas = agruparHorasSeguidas(ocurrencias).map((grupo) => ({
    materiaId: grupo.materiaId,
    profesorId: grupo.profesorId,
    fecha: grupo.fecha,
    horaInicio: grupo.horaInicio,
    horaFin: grupo.horaFin,
    ocurrencias: grupo.ocurrencias,
  }))
  const canceladas = ocurrencias
    .filter((ocurrencia) => ocurrencia.estado === 'CANCELADO')
    .map((ocurrencia) => ({
      materiaId: ocurrencia.materiaId,
      profesorId: ocurrencia.profesorId,
      fecha: ocurrencia.fecha,
      horaInicio: ocurrencia.horaInicio,
      horaFin: ocurrencia.horaFin,
      ocurrencias: [ocurrencia],
    }))
  return [...seguidas, ...canceladas]
}

/** Un bloque, de la fecha y la hora más recientes a las más antiguas. */
function porFechaYHoraDescendente(a: GrupoDeHoras, b: GrupoDeHoras): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1
  return b.horaInicio - a.horaInicio
}

/** El DTO de un bloque: sus clases, con los textos del grupo una sola vez (`textosPropios`). */
function aBloque(grupo: GrupoDeHoras): BloqueDelHistorial {
  const { textos, porHora } = textosDeHorasSeguidas(grupo.ocurrencias)
  const clases: ClaseDelHistorial[] = grupo.ocurrencias.map((ocurrencia, i) => ({
    turnoId: ocurrencia.turnoId,
    fecha: ocurrencia.fecha,
    horaInicio: minutosAHora(ocurrencia.horaInicio),
    horaFin: minutosAHora(ocurrencia.horaFin),
    estado: ocurrencia.estado,
    plazoAsistencia: ocurrencia.plazoAsistencia && {
      vence: ocurrencia.plazoAsistencia.vence,
      vencido: ocurrencia.plazoAsistencia.vencido,
    },
    cerradaPorSistema: estaCerradaPorSistema(ocurrencia),
    textosPropios: porHora[i] ?? null,
    observacion: observacionDe(ocurrencia),
    cancelacion: ocurrencia.cancelacion
      ? { motivo: ocurrencia.cancelacion.motivo, detalle: ocurrencia.cancelacion.detalle }
      : null,
  }))
  return {
    fecha: grupo.fecha,
    horaInicio: minutosAHora(grupo.horaInicio),
    horaFin: minutosAHora(grupo.horaFin),
    horas: clases.length,
    textos,
    clases,
  }
}

/**
 * El resumen de unas horas: cada hora cuenta como un turno. Los cancelados, los sin registrar y
 * los agendados **no cuentan** para el porcentaje (HU-31).
 */
export function resumirHoras(ocurrencias: readonly OcurrenciaHistorial[]): ResumenDelHistorial {
  const realizadas = ocurrencias.filter((o) => o.estado === 'REALIZADO').length
  const ausencias = ocurrencias.filter((o) => o.estado === 'AUSENTE').length
  return { realizadas, ausencias, porcentaje: porcentajeAsistencia(realizadas, ausencias) }
}

/**
 * Presentes sobre presentes más ausentes, de 0 a 100 con un decimal (1 de 3 → 33.3); **0 sin
 * base**, como pide HU-31. La misma cuenta que `porcentaje` del tablero.
 */
export function porcentajeAsistencia(realizadas: number, ausencias: number): number {
  const base = realizadas + ausencias
  return base === 0 ? 0 : Math.round((realizadas / base) * 1000) / 10
}

/** La clave de un grupo del historial: una materia con un profesor. */
function claveDelGrupo(ocurrencia: { materiaId: number; profesorId: number }): string {
  return `${ocurrencia.materiaId}-${ocurrencia.profesorId}`
}

/**
 * El historial agrupado **por materia y profesor** ("Matemática — Prof. Gómez"): cada grupo con su
 * resumen y sus bloques de horas seguidas, de la fecha más reciente a la más antigua. Los grupos
 * van por nombre de materia, apellido y nombre del profesor.
 *
 * Es la única forma de armar el historial: la usan la ficha (HU-31), el portal (HU-33) y, cuando
 * llegue, su PDF (T-110).
 */
export function armarGrupos(ocurrencias: readonly OcurrenciaHistorial[]): GrupoDelHistorial[] {
  type EnConstruccion = {
    primera: OcurrenciaHistorial
    horas: OcurrenciaHistorial[]
    bloques: GrupoDeHoras[]
  }
  const porGrupo = new Map<string, EnConstruccion>()

  for (const ocurrencia of ocurrencias) {
    const clave = claveDelGrupo(ocurrencia)
    const grupo = porGrupo.get(clave)
    if (grupo) grupo.horas.push(ocurrencia)
    else porGrupo.set(clave, { primera: ocurrencia, horas: [ocurrencia], bloques: [] })
  }
  for (const bloque of gruposDeHoras(ocurrencias)) {
    porGrupo.get(claveDelGrupo(bloque))?.bloques.push(bloque)
  }

  return [...porGrupo.values()]
    .map(({ primera, horas, bloques }) => ({
      materia: { id: primera.materia.id, nombre: primera.materia.nombre },
      profesor: {
        id: primera.profesor.id,
        nombre: primera.profesor.nombre,
        apellido: primera.profesor.apellido,
      },
      resumen: resumirHoras(horas),
      bloques: bloques.sort(porFechaYHoraDescendente).map(aBloque),
    }))
    .sort(
      (a, b) =>
        a.materia.nombre.localeCompare(b.materia.nombre, 'es') ||
        a.profesor.apellido.localeCompare(b.profesor.apellido, 'es') ||
        a.profesor.nombre.localeCompare(b.profesor.nombre, 'es') ||
        a.materia.id - b.materia.id ||
        a.profesor.id - b.profesor.id,
    )
}

/**
 * Materias y profesores del historial, para los filtros de la pantalla: salen de los grupos del
 * historial **completo**, no del período que se está viendo, así el filtro no se queda sin opciones
 * al elegir un mes sin clases. Sin repetir y en el orden de los grupos.
 */
export function opcionesDeLosGrupos(
  grupos: readonly GrupoDelHistorial[],
): HistorialDelAlumno['opciones'] {
  const materias = new Map<number, HistorialDelAlumno['opciones']['materias'][number]>()
  const profesores = new Map<number, HistorialDelAlumno['opciones']['profesores'][number]>()
  for (const grupo of grupos) {
    if (!materias.has(grupo.materia.id)) materias.set(grupo.materia.id, grupo.materia)
    if (!profesores.has(grupo.profesor.id)) profesores.set(grupo.profesor.id, grupo.profesor)
  }
  return {
    materias: [...materias.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    profesores: [...profesores.values()].sort(
      (a, b) =>
        a.apellido.localeCompare(b.apellido, 'es') || a.nombre.localeCompare(b.nombre, 'es'),
    ),
  }
}

// ---------------------------------------------------------------------------------------------
// Portal del alumno (HU-33)
// ---------------------------------------------------------------------------------------------

/**
 * Los estados que el alumno ve de una clase (decisión T-169): también los "Sin registrar", para que
 * vea la hora que el profesor no registró (no cuenta para su porcentaje). Los agendados de hoy, no.
 */
const ESTADOS_DEL_PORTAL: readonly ClaseDelHistorial['estado'][] = [
  'REALIZADO',
  'AUSENTE',
  'CANCELADO',
  'SIN_REGISTRAR',
]

/**
 * Los bloques del portal: los mismos bloques y los mismos textos, **sin** la observación interna,
 * el motivo de la cancelación, el plazo ni el cierre del sistema, y sin las clases agendadas (una de
 * hoy todavía sin registrar, decisión T-148). Las "Sin registrar" sí se muestran (decisión T-169).
 * Un bloque que se queda sin clases no se muestra.
 */
export function bloquesDelPortal(bloques: readonly BloqueDelHistorial[]): BloqueDelPortal[] {
  return bloques
    .map((bloque) => {
      const clases = bloque.clases
        .filter((clase) => ESTADOS_DEL_PORTAL.includes(clase.estado))
        .map((clase) => ({
          turnoId: clase.turnoId,
          fecha: clase.fecha,
          horaInicio: clase.horaInicio,
          horaFin: clase.horaFin,
          estado: clase.estado,
          textosPropios: clase.textosPropios,
        }))
      return { ...bloque, clases }
    })
    .filter((bloque) => bloque.clases.length > 0)
}

/** Una clase próxima de "Mis materias": fecha y horario, sin estado (todavía no pasó). */
type ProximoTurno = NonNullable<MiMateriaItem['proximoTurno']>

/**
 * "Mis materias" (HU-33): cada materia y profesor en los que el alumno **tiene o tuvo** turnos, con
 * su próximo turno y su porcentaje sobre todo su historial.
 *
 * `grupos` es el historial completo (hasta hoy) y `futuras`, las ocurrencias de hoy en adelante
 * dentro del horizonte: una materia y profesor cuyo único turno todavía no pasó también aparece,
 * con porcentaje 0. El próximo turno es la primera ocurrencia **no cancelada**, que ya vienen
 * ordenadas por fecha y hora desde el motor.
 */
export function armarMisMaterias(
  grupos: readonly GrupoDelHistorial[],
  futuras: readonly OcurrenciaHistorial[],
): MiMateriaItem[] {
  const proximos = new Map<string, ProximoTurno>()
  const items = new Map<string, MiMateriaItem>()

  for (const ocurrencia of futuras) {
    const clave = claveDelGrupo(ocurrencia)
    if (ocurrencia.estado === 'CANCELADO' || proximos.has(clave)) continue
    proximos.set(clave, {
      fecha: ocurrencia.fecha,
      horaInicio: minutosAHora(ocurrencia.horaInicio),
      horaFin: minutosAHora(ocurrencia.horaFin),
    })
  }

  for (const grupo of grupos) {
    const clave = claveDelGrupo({ materiaId: grupo.materia.id, profesorId: grupo.profesor.id })
    items.set(clave, {
      materia: grupo.materia,
      profesor: grupo.profesor,
      proximoTurno: proximos.get(clave) ?? null,
      porcentaje: grupo.resumen.porcentaje,
    })
  }
  // Una materia y profesor que todavía no tienen ninguna clase dada: sólo están entre las futuras.
  for (const ocurrencia of futuras) {
    const clave = claveDelGrupo(ocurrencia)
    if (items.has(clave)) continue
    items.set(clave, {
      materia: { id: ocurrencia.materia.id, nombre: ocurrencia.materia.nombre },
      profesor: {
        id: ocurrencia.profesor.id,
        nombre: ocurrencia.profesor.nombre,
        apellido: ocurrencia.profesor.apellido,
      },
      proximoTurno: proximos.get(clave) ?? null,
      porcentaje: 0,
    })
  }

  return [...items.values()].sort(
    (a, b) =>
      a.materia.nombre.localeCompare(b.materia.nombre, 'es') ||
      a.profesor.apellido.localeCompare(b.profesor.apellido, 'es') ||
      a.profesor.nombre.localeCompare(b.profesor.nombre, 'es') ||
      a.materia.id - b.materia.id ||
      a.profesor.id - b.profesor.id,
  )
}
