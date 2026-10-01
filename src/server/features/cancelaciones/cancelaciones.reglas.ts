import { ConflictError, ValidationError } from '@/server/errors'
import type { Ocurrencia } from '@/server/features/turnos/ocurrencias.condiciones'
import { detallesPorPosicion } from '@/server/shared/detalles'
import type { OcurrenciaACancelar } from './cancelaciones.validation'

// Reglas puras de la cancelación (HU-13, T-45): qué ocurrencias se pueden cancelar. Sin Prisma y
// sin `hoy()` adentro: "hoy" ya lo resolvió el motor en el `estado` de cada ocurrencia. Las usan el
// service (chequeo previo, sin lock) y el repository (con lo releído bajo lock, como callback
// `verificar`): una sola implementación.

export const CODIGO_TURNOS_NO_CANCELABLES = 'TURNOS_NO_CANCELABLES'

export const MOTIVOS_NO_CANCELABLE = ['NO_EXISTE', 'YA_CANCELADO', 'PAGADO', 'PASADO'] as const
export type MotivoNoCancelable = (typeof MOTIVOS_NO_CANCELABLE)[number]

/** Mensaje de cada motivo, en el orden en que se evalúan (el primero que se cumple gana). */
export const MENSAJES_NO_CANCELABLE: Record<MotivoNoCancelable, string> = {
  NO_EXISTE: 'El turno no existe en esa fecha',
  YA_CANCELADO: 'El turno ya está cancelado',
  PAGADO: 'El turno está pagado: no se puede cancelar',
  PASADO: 'El turno ya pasó: no se puede cancelar',
}

export const MENSAJE_TURNOS_NO_CANCELABLES = 'Algunos turnos no se pueden cancelar'
/** 409 de la última red (P2002 del único de `cancelacion_turno`): sin detalle por ocurrencia. */
export const MENSAJE_YA_CANCELADO_CONCURRENTE = 'Alguno de los turnos ya fue cancelado'
export const MENSAJE_DE_OTRO_ALUMNO = 'Los turnos deben ser del mismo alumno'

/** Lo que las reglas necesitan de una ocurrencia leída por el motor. */
export type OcurrenciaCancelable = Pick<Ocurrencia, 'turnoId' | 'fecha' | 'alumnoId' | 'estado'> & {
  pago: Pick<Ocurrencia['pago'], 'estado' | 'pagoId'>
}

export type LineaCancelacion = { turnoId: number; fecha: string }

/** Resultado de la decisión: el alumno (dueño de todas) y una línea por ocurrencia, en orden. */
export type PlanCancelacion = { alumnoId: number; lineas: LineaCancelacion[] }

const clave = (turnoId: number, fecha: string) => `${turnoId}|${fecha}`

/** Motivo por el que no se puede cancelar (el primero, en el orden de la tabla), o `null`. */
function motivoNoCancelable(
  ocurrencia: OcurrenciaCancelable | undefined,
): MotivoNoCancelable | null {
  if (!ocurrencia) return 'NO_EXISTE'
  if (ocurrencia.estado === 'CANCELADO') return 'YA_CANCELADO'
  if (ocurrencia.pago.estado === 'PAGADO') return 'PAGADO'
  if (ocurrencia.estado === 'SIN_REGISTRAR') return 'PASADO'
  return null
}

/**
 * Decide una cancelación, todo o nada, sobre las ocurrencias leídas (con los `turnoIds` del pedido
 * y el rango de sus fechas, sin filtrar por alumno). Lanza, en este orden:
 * 1. 400 `VALIDACION` en `ocurrencias` si las que existen son de más de un alumno (un detalle por
 *    cada una que no es del alumno de la primera, con su posición en el body).
 * 2. 409 `TURNOS_NO_CANCELABLES` con un detalle por **cada** ocurrencia que no se puede cancelar,
 *    con un solo motivo por ocurrencia (el primero de `MOTIVOS_NO_CANCELABLE`). Cancelable =
 *    existe, está `AGENDADO` (no cancelada y de hoy en adelante) y su pago está `PENDIENTE`
 *    (definición D: un turno pagado no se cancela).
 *
 * Si no lanza: el alumno y una línea por ocurrencia, en el orden del pedido.
 */
export function planificarCancelacion(
  snapshot: readonly OcurrenciaCancelable[],
  pedidas: readonly OcurrenciaACancelar[],
): PlanCancelacion {
  const porClave = new Map(snapshot.map((o) => [clave(o.turnoId, o.fecha), o]))
  const encontradas = pedidas.map((p) => porClave.get(clave(p.turnoId, p.fecha)))
  const posiciones = pedidas.map((_, i) => i)
  const identidad = (i: number) => ({ turnoId: pedidas[i]?.turnoId, fecha: pedidas[i]?.fecha })

  const alumnoId = encontradas.find((o) => o !== undefined)?.alumnoId
  const ajenas = detallesPorPosicion(
    'ocurrencias',
    posiciones,
    (i) => {
      const ocurrencia = encontradas[i]
      return ocurrencia !== undefined && ocurrencia.alumnoId !== alumnoId
    },
    () => MENSAJE_DE_OTRO_ALUMNO,
    identidad,
  )
  if (ajenas.length > 0) throw new ValidationError(MENSAJE_DE_OTRO_ALUMNO, { details: ajenas })

  const motivos = encontradas.map(motivoNoCancelable)
  const noCancelables = detallesPorPosicion(
    'ocurrencias',
    posiciones,
    (i) => motivos[i] !== null,
    (i) => MENSAJES_NO_CANCELABLE[motivos[i] as MotivoNoCancelable],
    (i) => ({
      ...identidad(i),
      motivo: motivos[i],
      ...(motivos[i] === 'PAGADO' ? { pagoId: encontradas[i]?.pago.pagoId } : {}),
    }),
  )
  if (noCancelables.length > 0 || alumnoId === undefined) {
    throw new ConflictError(MENSAJE_TURNOS_NO_CANCELABLES, {
      code: CODIGO_TURNOS_NO_CANCELABLES,
      details: noCancelables,
    })
  }

  return { alumnoId, lineas: pedidas.map(({ turnoId, fecha }) => ({ turnoId, fecha })) }
}
