import { ConflictError, ValidationError } from '@/server/errors'
import type { Ocurrencia } from '@/server/features/turnos/ocurrencias.condiciones'
import { detallesPorPosicion } from '@/server/shared/detalles'
import { sumarDias } from '@/server/shared/fechas'
import { IMPORTE_MAX } from '@/server/shared/zod'
import type { OcurrenciaPedida } from './pagos.validation'

// Reglas puras del cobro (HU-15, T-51): qué ocurrencias se pueden cobrar, cuánto cuesta cada una,
// el total y el vuelto. Sin Prisma y sin `hoy()` adentro: "hoy" lo pasa el service con su reloj.
// Las usan el service (chequeo previo, sin lock) y el repository (con lo releído bajo lock, como
// callback `verificar`): una sola implementación.

export const CODIGO_TURNOS_NO_COBRABLES = 'TURNOS_NO_COBRABLES'

/** Tope de cobro de una ocurrencia futura: hoy + 56 días (8 semanas, decisión T-60). */
export const DIAS_MAXIMOS_COBRO = 56

export const MOTIVOS_NO_COBRABLE = [
  'NO_EXISTE',
  'CANCELADO',
  'YA_PAGADO',
  'FUERA_DE_RANGO',
  'SIN_PRECIO',
] as const
export type MotivoNoCobrable = (typeof MOTIVOS_NO_COBRABLE)[number]

/** Mensaje de cada motivo, en el orden en que se evalúan (el primero que se cumple gana). */
export const MENSAJES_NO_COBRABLE: Record<MotivoNoCobrable, string> = {
  NO_EXISTE: 'El turno no existe en esa fecha',
  CANCELADO: 'El turno está cancelado',
  YA_PAGADO: 'El turno ya está pagado',
  FUERA_DE_RANGO: 'Sólo se pueden cobrar turnos de las próximas 8 semanas',
  SIN_PRECIO: 'La materia no tiene precio cargado',
}

export const MENSAJE_TURNOS_NO_COBRABLES = 'Algunos turnos no se pueden cobrar'
/** 409 de la última red (P2002 del único de `pago_turno`): sin detalle por ocurrencia. */
export const MENSAJE_YA_PAGADO_CONCURRENTE = 'Alguno de los turnos ya fue pagado'
export const MENSAJE_DE_OTRO_ALUMNO = 'El turno no es del alumno'
export const MENSAJE_FECHA_PAGO_FUTURA = 'La fecha de pago no puede ser posterior a hoy'

/** Lo que el cobro necesita de una ocurrencia (una `Ocurrencia` del motor lo cumple). */
export type OcurrenciaCobro = Pick<
  Ocurrencia,
  'turnoId' | 'fecha' | 'alumnoId' | 'materiaId' | 'estado'
> & { pago: Pick<Ocurrencia['pago'], 'estado' | 'pagoId'> }

/**
 * Datos sobre los que se decide: las ocurrencias leídas (con `turnoIds` del pedido y el rango de
 * sus fechas, sin filtrar por alumno) y el precio por hora **vigente** de cada materia (`null` =
 * sin precio; una materia que no está en el `Map` cuenta igual).
 */
export type SnapshotPago = {
  ocurrencias: readonly OcurrenciaCobro[]
  precios: ReadonlyMap<number, number | null>
}

export type PedidoPago = {
  alumnoId: number
  ocurrencias: readonly OcurrenciaPedida[]
  montoRecibido: number | null
}

export type LineaPago = { turnoId: number; fecha: string; importe: number }

/** Resultado del cobro. Los importes, en pesos con hasta dos decimales. */
export type PlanPago = { lineas: LineaPago[]; total: number; vuelto: number | null }

const centavos = (importe: number) => Math.round(importe * 100)
const clave = (turnoId: number, fecha: string) => `${turnoId}|${fecha}`

/** Última fecha que se puede cobrar: `hoy + DIAS_MAXIMOS_COBRO`. */
export function limiteDeCobro(hoy: string): string {
  return sumarDias(hoy, DIAS_MAXIMOS_COBRO)
}

/**
 * Suma de importes en centavos (convenciones-backend.md → Importes), para no acumular el error de
 * coma flotante: `10000.5 × 3` da `30001.5` exacto.
 */
export function sumarImportes(importes: readonly number[]): number {
  return importes.reduce((suma, importe) => suma + centavos(importe), 0) / 100
}

/** `montoRecibido - total` en centavos, o `null` si no se informó el monto. No se guarda. */
export function calcularVuelto(montoRecibido: number | null, total: number): number | null {
  return montoRecibido === null ? null : (centavos(montoRecibido) - centavos(total)) / 100
}

/**
 * Pesos para los mensajes de error, con el formato de Argentina armado a mano (no depende del ICU
 * del entorno): `$ 32.000`, `$ 30.000,50`.
 */
export function formatearPesos(importe: number): string {
  const total = Math.abs(centavos(importe))
  const enteros = String(Math.floor(total / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const resto = total % 100
  const signo = importe < 0 ? '-' : ''
  return `${signo}$ ${enteros}${resto === 0 ? '' : `,${String(resto).padStart(2, '0')}`}`
}

/** Motivo por el que no se puede cobrar (el primero, en el orden de la tabla), o `null`. */
function motivoNoCobrable(
  ocurrencia: OcurrenciaCobro | undefined,
  precios: SnapshotPago['precios'],
  limite: string,
): MotivoNoCobrable | null {
  if (!ocurrencia) return 'NO_EXISTE'
  if (ocurrencia.estado === 'CANCELADO') return 'CANCELADO'
  if (ocurrencia.pago.estado === 'PAGADO') return 'YA_PAGADO'
  if (ocurrencia.fecha > limite) return 'FUERA_DE_RANGO'
  if ((precios.get(ocurrencia.materiaId) ?? null) === null) return 'SIN_PRECIO'
  return null
}

/**
 * Decide un cobro, todo o nada. Lanza, en este orden:
 * 1. 400 `VALIDACION` en `ocurrencias` si alguna ocurrencia existente es de otro alumno (un
 *    detalle por cada una, con su posición en el body).
 * 2. 409 `TURNOS_NO_COBRABLES` con un detalle por **cada** ocurrencia que no se puede cobrar, con
 *    un solo motivo por ocurrencia (el primero de `MOTIVOS_NO_COBRABLE`). Cobrable = existe (el
 *    motor la devuelve), estado `AGENDADO` o `SIN_REGISTRAR`, pago `PENDIENTE`, fecha <= hoy + 56
 *    días (las pasadas no tienen tope) y su materia tiene precio (esté activa o no).
 * 3. 400 `VALIDACION` en `ocurrencias` si el total no entra en `Decimal(10,2)` (decisión T-64).
 * 4. 400 `VALIDACION` en `montoRecibido` si es menor al total, con los dos importes en el mensaje.
 *
 * Si no lanza: una línea por ocurrencia, en el orden del pedido, con el precio vigente de su
 * materia; el total sumado en centavos; y el vuelto (`null` sin `montoRecibido`).
 */
export function planificarPago(snapshot: SnapshotPago, pedido: PedidoPago, hoy: string): PlanPago {
  const porClave = new Map(snapshot.ocurrencias.map((o) => [clave(o.turnoId, o.fecha), o]))
  const encontradas = pedido.ocurrencias.map((p) => porClave.get(clave(p.turnoId, p.fecha)))
  const posiciones = pedido.ocurrencias.map((_, i) => i)
  const identidad = (i: number) => ({
    turnoId: pedido.ocurrencias[i]?.turnoId,
    fecha: pedido.ocurrencias[i]?.fecha,
  })

  const ajenas = detallesPorPosicion(
    'ocurrencias',
    posiciones,
    (i) => {
      const ocurrencia = encontradas[i]
      return ocurrencia !== undefined && ocurrencia.alumnoId !== pedido.alumnoId
    },
    () => MENSAJE_DE_OTRO_ALUMNO,
    identidad,
  )
  if (ajenas.length > 0) throw new ValidationError(MENSAJE_DE_OTRO_ALUMNO, { details: ajenas })

  const limite = limiteDeCobro(hoy)
  const motivos = encontradas.map((o) => motivoNoCobrable(o, snapshot.precios, limite))
  const noCobrables = detallesPorPosicion(
    'ocurrencias',
    posiciones,
    (i) => motivos[i] !== null,
    (i) => MENSAJES_NO_COBRABLE[motivos[i] as MotivoNoCobrable],
    (i) => ({
      ...identidad(i),
      motivo: motivos[i],
      ...(motivos[i] === 'YA_PAGADO' ? { pagoId: encontradas[i]?.pago.pagoId } : {}),
    }),
  )
  if (noCobrables.length > 0) {
    throw new ConflictError(MENSAJE_TURNOS_NO_COBRABLES, {
      code: CODIGO_TURNOS_NO_COBRABLES,
      details: noCobrables,
    })
  }

  // Todas existen, son del alumno y tienen precio (lo garantiza el chequeo de arriba).
  const lineas = encontradas.map((o) => {
    const ocurrencia = o as OcurrenciaCobro
    return {
      turnoId: ocurrencia.turnoId,
      fecha: ocurrencia.fecha,
      importe: snapshot.precios.get(ocurrencia.materiaId) as number,
    }
  })
  const total = sumarImportes(lineas.map((linea) => linea.importe))

  if (centavos(total) > centavos(IMPORTE_MAX)) {
    const mensaje = `El total del pago (${formatearPesos(total)}) supera el máximo de un pago (${formatearPesos(IMPORTE_MAX)}): dividilo en varios pagos`
    throw new ValidationError(mensaje, { details: [{ path: ['ocurrencias'], message: mensaje }] })
  }

  if (pedido.montoRecibido !== null && centavos(pedido.montoRecibido) < centavos(total)) {
    const mensaje = `El monto recibido (${formatearPesos(pedido.montoRecibido)}) es menor al total (${formatearPesos(total)})`
    throw new ValidationError(mensaje, { details: [{ path: ['montoRecibido'], message: mensaje }] })
  }

  return { lineas, total, vuelto: calcularVuelto(pedido.montoRecibido, total) }
}
