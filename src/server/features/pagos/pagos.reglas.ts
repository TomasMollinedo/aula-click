import { AppError, ConflictError, ValidationError } from '@/server/errors'
import { repartoDeTurno, sumarReparto } from '@/server/features/reparto/reparto.condiciones'
import type { Ocurrencia } from '@/server/features/turnos/ocurrencias.condiciones'
import type { Role } from '@/server/shared/actor'
import { detallesPorPosicion } from '@/server/shared/detalles'
import { sumarDias } from '@/server/shared/fechas'
import { IMPORTE_MAX } from '@/server/shared/zod'
import type {
  AccionesPago,
  CodigoFormaPago,
  MedioPago,
  OcurrenciaPedida,
  RegistrarPago,
  RepartoPago,
  TurnoGuardado,
} from './pagos.validation'

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

/**
 * Las formas de pago del catálogo no están como las carga el seed (decisión T-134): falta la de
 * `codigo` activa, o hay una sin código. Es un error de configuración, no del pedido: 500. Lo usan
 * el registro, el comprobante y el total por forma, con el mismo texto.
 */
export function errorFormasDePago(codigo?: CodigoFormaPago): AppError {
  const problema = codigo
    ? `Falta la forma de pago ${codigo} activa`
    : 'Hay una forma de pago sin código'
  return new AppError(`${problema}: corré \`pnpm db:seed\``, 500)
}

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
  /** Sólo en efectivo (HU-23): con transferencia o débito, `null`, y no hay vuelto. */
  montoRecibido: number | null
}

export type LineaPago = { turnoId: number; fecha: string; importe: number }

/**
 * Resultado del cobro. Los importes, en pesos con hasta dos decimales. `vuelto` es `null` fuera del
 * efectivo.
 */
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

/**
 * `montoRecibido - total` en centavos. No se guarda. `null` sin monto recibido: sólo le pasa al
 * comprobante de un pago anterior a que el monto fuera obligatorio.
 */
export function calcularVuelto(montoRecibido: number, total: number): number
export function calcularVuelto(montoRecibido: number | null, total: number): number | null
export function calcularVuelto(montoRecibido: number | null, total: number): number | null {
  return montoRecibido === null ? null : (centavos(montoRecibido) - centavos(total)) / 100
}

/**
 * Pesos para los mensajes de error, con el formato de Argentina y siempre dos decimales, como los
 * muestra la UI: `$ 32.000,00`, `$ 30.000,50`. Armado a mano (no depende del ICU del servidor) y
 * con un espacio normal entre `$` y el número: es un texto que viaja en JSON.
 */
export function formatearPesos(importe: number): string {
  const total = Math.abs(centavos(importe))
  const enteros = String(Math.floor(total / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const resto = String(total % 100).padStart(2, '0')
  const signo = importe < 0 ? '-' : ''
  return `${signo}$ ${enteros},${resto}`
}

/**
 * El medio del body ya validado (`registrarPagoSchema` garantiza que cada forma de pago trae sus
 * datos y sólo los suyos): lo que el repository guarda.
 */
export function medioDelPedido(datos: RegistrarPago): MedioPago {
  switch (datos.formaPago) {
    case 'EFECTIVO':
      return { formaPago: 'EFECTIVO', montoRecibido: datos.montoRecibido as number }
    case 'TRANSFERENCIA':
      return {
        formaPago: 'TRANSFERENCIA',
        transferencia: datos.transferencia as NonNullable<RegistrarPago['transferencia']>,
        comprobanteAdjuntoId: datos.comprobanteAdjuntoId as number,
      }
    case 'DEBITO':
      return {
        formaPago: 'DEBITO',
        debito: datos.debito as NonNullable<RegistrarPago['debito']>,
        comprobanteAdjuntoId: datos.comprobanteAdjuntoId ?? null,
      }
  }
}

/** El monto recibido de un medio: el del efectivo, o `null` (no hay con transferencia ni débito). */
export function montoRecibidoDe(medio: MedioPago): number | null {
  return medio.formaPago === 'EFECTIVO' ? medio.montoRecibido : null
}

/** Los turnos de una materia, con su subtotal (HU-25). */
export type GrupoDeMateria<T> = {
  materia: { id: number; nombre: string }
  turnos: T[]
  /** La suma de los importes de esos turnos en centavos (`sumarImportes`); los `null` no suman. */
  subtotal: number
}

/**
 * Turnos agrupados por materia (HU-25): las materias por nombre (y por id si se repite) y, dentro
 * de cada una, los turnos en el orden en que llegan. El subtotal es la suma de sus importes, sin
 * recalcular nada: un importe `null` (una materia sin precio, en una cuenta) no suma. La única
 * implementación: la usan el comprobante en PDF (lo cobrado) y la cuenta del portal (`cuentas`,
 * por `pagos.condiciones`; lo que se debe).
 */
export function agruparPorMateria<
  T extends { materia: { id: number; nombre: string }; importe: number | null },
>(turnos: readonly T[]): GrupoDeMateria<T>[] {
  const grupos = new Map<number, { materia: T['materia']; turnos: T[] }>()
  for (const turno of turnos) {
    const grupo = grupos.get(turno.materia.id) ?? { materia: turno.materia, turnos: [] as T[] }
    grupo.turnos.push(turno)
    grupos.set(turno.materia.id, grupo)
  }
  return [...grupos.values()]
    .map(({ materia, turnos: deLaMateria }) => ({
      materia: { id: materia.id, nombre: materia.nombre },
      turnos: deLaMateria,
      subtotal: sumarImportes(deLaMateria.flatMap((t) => (t.importe === null ? [] : [t.importe]))),
    }))
    .sort(
      (a, b) =>
        a.materia.nombre.localeCompare(b.materia.nombre, 'es') || a.materia.id - b.materia.id,
    )
}

/**
 * Motivo por el que no se puede cobrar (el primero, en el orden de la tabla), o `null`. El estado
 * de asistencia no importa: un `REALIZADO` o un `AUSENTE` impago se cobra igual (HU-22), y una
 * ocurrencia de un pago anulado vuelve a estar `PENDIENTE` (lo resuelve el motor, T-74).
 */
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
 *    motor la devuelve), no está cancelada (`AGENDADO`, `SIN_REGISTRAR`, `REALIZADO` o `AUSENTE`),
 *    pago `PENDIENTE` (también la de un pago anulado), fecha <= hoy + 56 días (las pasadas no
 *    tienen tope) y su materia tiene precio (esté activa o no).
 * 3. 400 `VALIDACION` en `ocurrencias` si el total no entra en `Decimal(10,2)` (decisión T-64).
 * 4. Sólo en efectivo: 400 `VALIDACION` en `montoRecibido` si es menor al total, con los dos
 *    importes en el mensaje. Con transferencia o débito no se compara ningún monto (HU-23).
 *
 * Si no lanza: una línea por ocurrencia, en el orden del pedido, con el precio vigente de su
 * materia; el total sumado en centavos; y el vuelto (`null` fuera del efectivo).
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

  const { montoRecibido } = pedido
  if (montoRecibido !== null && centavos(montoRecibido) < centavos(total)) {
    const mensaje = `El monto recibido (${formatearPesos(montoRecibido)}) es menor al total (${formatearPesos(total)})`
    throw new ValidationError(mensaje, { details: [{ path: ['montoRecibido'], message: mensaje }] })
  }

  return { lineas, total, vuelto: calcularVuelto(montoRecibido, total) }
}

/** Lo que decide las acciones del detalle de un pago (HU-36): quién lo pide y cómo está el pago. */
export type EntradaAccionesPago = {
  rol: Role
  estado: 'VIGENTE' | 'ANULADO'
  formaPago: CodigoFormaPago
  /** Si tiene un comprobante adjunto activo. */
  tieneAdjunto: boolean
}

/**
 * Las acciones del detalle de un pago (`PagoParaAcciones` del frontend). Coinciden con lo que
 * aceptan `POST /anulaciones` y `PUT`/`DELETE /adjuntos/pagos/{pagoId}` (T-95): un pago anulado
 * conserva todo como estaba, un efectivo no lleva adjunto y uno por transferencia no puede quedar
 * sin comprobante. Sólo la mesa de entradas actúa; el gerente ve en sólo lectura (todas en `false`).
 * - `anular`: vigente.
 * - `reemplazarAdjunto`: vigente y con transferencia o débito (en un débito sin adjunto es
 *   "adjuntar").
 * - `quitarAdjunto`: vigente, con débito y con adjunto.
 */
export function accionesDelPago({
  rol,
  estado,
  formaPago,
  tieneAdjunto,
}: EntradaAccionesPago): AccionesPago {
  const puede = rol === 'MESA_ENTRADAS' && estado === 'VIGENTE'
  return {
    anular: puede,
    reemplazarAdjunto: puede && formaPago !== 'EFECTIVO',
    quitarAdjunto: puede && formaPago === 'DEBITO' && tieneAdjunto,
  }
}

/**
 * El reparto del pago (HU-43) entre el centro y cada profesor, con el porcentaje que guardó cada
 * cobro: una fila por turno, en el mismo orden, y los totales. Sólo arma: el cálculo es el de
 * `repartoDeTurno` y `sumarReparto` (de `reparto`), la única regla del reparto.
 */
export function repartoDelPago(turnos: readonly TurnoGuardado[]): RepartoPago {
  const filas = turnos.map((turno) => ({
    turnoId: turno.turnoId,
    fecha: turno.fecha,
    profesor: turno.profesor,
    ...repartoDeTurno(turno.importe, turno.porcentaje),
  }))
  return { turnos: filas, totales: sumarReparto(filas) }
}
