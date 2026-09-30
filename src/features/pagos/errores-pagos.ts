import { isValid, parseISO } from 'date-fns'

import type { OcurrenciaACobrar } from '@/types/pago'
import { ApiError } from '@/utils/fetch-json'
import { fechaConDia } from '@/utils/formato-fechas'

import { textoHorario } from './formato-pagos'
import { CAMPOS_PAGO_FORM, type CampoPagoForm } from './pagos.schema'
import type { MotivoNoCobrable } from './pagos.types'

// Errores de `POST /pagos` (docs/contrato-api.md → Pagos y Errores) en lo que muestra el diálogo.
// Es el único lugar que conoce la forma de sus `details`: el diálogo hace un `switch` sobre `tipo`
// y no revisa códigos. Un `details` sin la forma esperada cae a `general` con el `message`.

export const CODIGO_TURNOS_NO_COBRABLES = 'TURNOS_NO_COBRABLES'

const MOTIVOS: readonly MotivoNoCobrable[] = [
  'NO_EXISTE',
  'CANCELADO',
  'YA_PAGADO',
  'FUERA_DE_RANGO',
  'SIN_PRECIO',
]

const MENSAJE_SIN_PERMISO = 'No tenés permiso para esta operación'
const MENSAJE_SIN_CONEXION = 'No se pudo registrar el pago. Revisá la conexión e intentá de nuevo.'

/** Un turno que la API rechazó, resuelto contra la lista que muestra el diálogo. */
export type TurnoRechazado = {
  turnoId: number
  fecha: string
  /** El `message` de la API, tal cual ("El turno ya está pagado"). */
  mensaje: string
  /** Solo en el 409 `TURNOS_NO_COBRABLES`. */
  motivo: MotivoNoCobrable | null
  /** Solo con `YA_PAGADO`: el pago que ya la cubre. */
  pagoId: number | null
  /** La ocurrencia de la lista mostrada, o `null` si no está en ella. */
  ocurrencia: OcurrenciaACobrar | null
  /**
   * `'lunes 12/10 de 9:00 a 10:00 · Matemática — El turno ya está pagado'`; si no está en la lista,
   * solo con la fecha de la API (`'lunes 19/10 — El turno no existe en esa fecha'`).
   */
  linea: string
}

export type ErrorPago =
  /** 400 por campo del formulario. `mensaje`: lo que no corresponde a un campo, o `null`. */
  | { tipo: 'campos'; campos: { campo: CampoPagoForm; mensaje: string }[]; mensaje: string | null }
  /** Turnos que no se pueden cobrar (409) o que no son del alumno (400): no se registra ninguno. */
  | { tipo: 'turnos'; mensaje: string; turnos: TurnoRechazado[] }
  /** 409 sin `details`: otro pago los registró al mismo tiempo (la última red de la base). */
  | { tipo: 'yaPagado'; mensaje: string }
  | { tipo: 'general'; mensaje: string }

type Registro = Record<string, unknown>

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null
}

function esFecha(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && isValid(parseISO(valor))
}

const camposValidos = new Set<string>(CAMPOS_PAGO_FORM)

/** Un detalle con la forma de Zod: `path` arreglo y `message` texto. */
function esDetalle(d: unknown): d is Registro & { path: unknown[]; message: string } {
  return esRegistro(d) && Array.isArray(d.path) && typeof d.message === 'string'
}

/** `['ocurrencias', <posición>]`: el detalle es de un turno de la lista. */
function posicionDeOcurrencia(path: unknown[]): number | null {
  return path.length === 2 && path[0] === 'ocurrencias' && Number.isInteger(path[1])
    ? (path[1] as number)
    : null
}

function linea(fecha: string, ocurrencia: OcurrenciaACobrar | null, mensaje: string): string {
  const cuando = ocurrencia
    ? `${fechaConDia(fecha)} ${textoHorario(ocurrencia.horaInicio, ocurrencia.horaFin)} · ${ocurrencia.materia.nombre}`
    : fechaConDia(fecha)
  return `${cuando} — ${mensaje}`
}

/**
 * Resuelve un detalle de turno contra la lista mostrada, o `null` si no tiene la forma esperada.
 * Con `turnoId` y `fecha` se busca por esos dos datos (no por la posición): si no está en la lista,
 * la línea sale igual con la fecha de la API. Sin ellos (la ocurrencia repetida del 400 de Zod) se
 * resuelve por la posición del `path`, que es la de la lista (`armarRegistrarPago` respeta el
 * orden); si esa posición no existe, `null`.
 */
function resolverTurno(
  d: Registro & { message: string },
  posicion: number,
  ocurrencias: readonly OcurrenciaACobrar[],
): TurnoRechazado | null {
  const motivo = d.motivo === undefined ? null : d.motivo
  if (motivo !== null && !MOTIVOS.includes(motivo as MotivoNoCobrable)) return null
  const pagoId = d.pagoId === undefined ? null : d.pagoId
  if (pagoId !== null && !Number.isInteger(pagoId)) return null

  let turnoId: number
  let fecha: string
  let ocurrencia: OcurrenciaACobrar | null
  if (d.turnoId === undefined && d.fecha === undefined) {
    ocurrencia = ocurrencias[posicion] ?? null
    if (!ocurrencia) return null
    ;({ turnoId, fecha } = ocurrencia)
  } else {
    if (!Number.isInteger(d.turnoId) || !esFecha(d.fecha)) return null
    turnoId = d.turnoId as number
    fecha = d.fecha
    ocurrencia = ocurrencias.find((o) => o.turnoId === turnoId && o.fecha === fecha) ?? null
  }

  return {
    turnoId,
    fecha,
    mensaje: d.message,
    motivo: motivo as MotivoNoCobrable | null,
    pagoId: pagoId as number | null,
    ocurrencia,
    linea: linea(fecha, ocurrencia, d.message),
  }
}

/** Los detalles de turnos, o `null` si alguno no tiene la forma esperada. */
function resolverTurnos(
  detalles: readonly (Registro & { path: unknown[]; message: string })[],
  ocurrencias: readonly OcurrenciaACobrar[],
): TurnoRechazado[] | null {
  const turnos: TurnoRechazado[] = []
  for (const d of detalles) {
    const posicion = posicionDeOcurrencia(d.path)
    const turno = posicion === null ? null : resolverTurno(d, posicion, ocurrencias)
    if (!turno) return null
    turnos.push(turno)
  }
  return turnos
}

function interpretarValidacion(
  error: ApiError,
  ocurrencias: readonly OcurrenciaACobrar[],
): ErrorPago {
  const details = error.details
  if (!Array.isArray(details) || details.length === 0 || !details.every(esDetalle)) {
    return { tipo: 'general', mensaje: error.message }
  }

  const deTurnos = details.filter((d) => posicionDeOcurrencia(d.path) !== null)
  if (deTurnos.length > 0) {
    // Turnos de otro alumno (o repetidos): no hay nada que corregir en el formulario.
    const turnos = resolverTurnos(deTurnos, ocurrencias)
    return turnos
      ? { tipo: 'turnos', mensaje: error.message, turnos }
      : { tipo: 'general', mensaje: error.message }
  }

  const campos: { campo: CampoPagoForm; mensaje: string }[] = []
  let mensaje: string | null = null
  for (const d of details) {
    const raiz = d.path[0]
    if (d.path.length === 1 && typeof raiz === 'string' && camposValidos.has(raiz)) {
      if (!campos.some((c) => c.campo === raiz)) {
        campos.push({ campo: raiz as CampoPagoForm, mensaje: d.message })
      }
    } else {
      // Por ejemplo `['ocurrencias']`: el total supera el máximo de un pago.
      mensaje = mensaje ?? d.message
    }
  }

  if (campos.length === 0) return { tipo: 'general', mensaje: mensaje ?? error.message }
  return { tipo: 'campos', campos, mensaje }
}

function interpretarNoCobrables(
  error: ApiError,
  ocurrencias: readonly OcurrenciaACobrar[],
): ErrorPago {
  // Sin `details`: la última red de la base (otro pago las registró al mismo tiempo).
  if (error.details === undefined || error.details === null) {
    return { tipo: 'yaPagado', mensaje: error.message }
  }
  const details = error.details
  if (!Array.isArray(details) || details.length === 0 || !details.every(esDetalle)) {
    return { tipo: 'general', mensaje: error.message }
  }
  const turnos = resolverTurnos(details, ocurrencias)
  if (!turnos || turnos.some((t) => t.motivo === null)) {
    return { tipo: 'general', mensaje: error.message }
  }
  return { tipo: 'turnos', mensaje: error.message, turnos }
}

/**
 * Convierte el error de `POST /pagos` en lo que muestra el diálogo. `ocurrencias` es la lista que
 * muestra, en el mismo orden en que se mandó. Acepta cualquier error: uno que no sea un `ApiError`
 * (red) cae a `general`. El 401 lo redirige `providers.tsx`; acá cae a `general` igual.
 */
export function interpretarErrorPago(
  error: unknown,
  ocurrencias: readonly OcurrenciaACobrar[],
): ErrorPago {
  if (!(error instanceof ApiError)) return { tipo: 'general', mensaje: MENSAJE_SIN_CONEXION }

  if (error.status === 403 && error.code === 'SIN_PERMISO') {
    return { tipo: 'general', mensaje: MENSAJE_SIN_PERMISO }
  }
  if (error.status === 400 && error.code === 'VALIDACION') {
    return interpretarValidacion(error, ocurrencias)
  }
  if (error.status === 409 && error.code === CODIGO_TURNOS_NO_COBRABLES) {
    return interpretarNoCobrables(error, ocurrencias)
  }
  // 404 del alumno, 401, 500 y lo desconocido.
  return { tipo: 'general', mensaje: error.message }
}
