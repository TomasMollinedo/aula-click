import { ConflictError, NotFoundError } from '@/server/errors'
import { DIAS_DEUDA_VENCIDA } from '@/server/features/cuentas/cuentas.condiciones'
import {
  sumarImportes,
  type PagoDeLaMismaTransferencia,
  type PagoParaAnular,
} from '@/server/features/pagos/pagos.condiciones'
import { sumarDias } from '@/server/shared/fechas'
import type { PreviaAnulacion } from './anulaciones.validation'

// Reglas puras de la anulación de un pago (HU-42, T-104): si un pago se puede anular y los avisos de
// la confirmación. Sin Prisma y sin `hoy()` adentro: "hoy" lo pasa el service con su reloj. Las usan
// el service (chequeo previo, sin lock) y el repository (con lo releído bajo lock, como callback
// `verificar`): una sola implementación.

export const CODIGO_PAGO_ANULADO = 'PAGO_ANULADO'
export const MENSAJE_PAGO_ANULADO = 'Un pago anulado no se puede volver a activar'
export const MENSAJE_PAGO_NO_ENCONTRADO = 'Pago no encontrado'

/**
 * El pago a anular, o el error que corresponde: no existe → 404; ya está anulado → 409
 * `PAGO_ANULADO` (no se deshace). Es el `verificar` que el repository corre bajo el lock del
 * alumno.
 */
export function exigirAnulable(pago: PagoParaAnular | null): PagoParaAnular {
  if (!pago) throw new NotFoundError(MENSAJE_PAGO_NO_ENCONTRADO)
  if (pago.estado === 'ANULADO') {
    throw new ConflictError(MENSAJE_PAGO_ANULADO, { code: CODIGO_PAGO_ANULADO })
  }
  return pago
}

/** Datos sobre los que se arma la confirmación: el pago, la deuda de hoy, los precios y los otros pagos. */
export type DatosDePrevia = {
  pago: PagoParaAnular
  /** Deuda vencida del alumno **antes** de anular (`deudaVencida` de `cuentas`, T-76). */
  deudaVencida: { cantidad: number; total: number }
  /** Precio por hora vigente de cada materia del pago (`null` o ausente = sin precio). */
  precios: ReadonlyMap<number, number | null>
  /** Otros pagos vigentes con la misma operación y banco (vacío si no es una transferencia). */
  otrosPagos: readonly PagoDeLaMismaTransferencia[]
  hoy: string
}

const centavos = (importe: number) => Math.round(importe * 100)

/**
 * Aviso de deuda: la deuda vencida de hoy más los turnos del pago con fecha de `DIAS_DEUDA_VENCIDA`
 * días o más (`fecha <= hoy - 30`), que al anular dejan de estar pagos, a precio vigente (los de una
 * materia sin precio cuentan como turno pero no suman al total). `null` si el alumno no quedaría
 * con deuda vencida.
 */
function avisoDeuda({ pago, deudaVencida, precios, hoy }: DatosDePrevia) {
  const limite = sumarDias(hoy, -DIAS_DEUDA_VENCIDA)
  const vencidos = pago.turnos.filter((turno) => turno.fecha <= limite)
  const cantidad = deudaVencida.cantidad + vencidos.length
  if (cantidad === 0) return null
  const sumaDelPago = vencidos.flatMap((turno) => precios.get(turno.materia.id) ?? [])
  return {
    cantidad,
    total: sumarImportes([deudaVencida.total, ...sumaDelPago]),
    turnosDelPago: vencidos.length,
  }
}

/**
 * Aviso de precio: por materia (y precio cobrado), si el vigente es distinto del que se cobró. Con
 * `vigente = null` la materia no tiene precio y sus turnos no se podrían volver a cobrar. Por
 * nombre de materia y precio cobrado.
 */
function avisosDePrecio({ pago, precios }: DatosDePrevia) {
  const distintos = new Map<
    string,
    { materia: { id: number; nombre: string }; cobrado: number; vigente: number | null }
  >()
  for (const { materia, importe } of pago.turnos) {
    const vigente = precios.get(materia.id) ?? null
    if (vigente !== null && centavos(vigente) === centavos(importe)) continue
    distintos.set(`${materia.id}|${centavos(importe)}`, { materia, cobrado: importe, vigente })
  }
  return [...distintos.values()].sort(
    (a, b) => a.materia.nombre.localeCompare(b.materia.nombre) || a.cobrado - b.cobrado,
  )
}

/** Aviso de transferencia compartida: los otros pagos vigentes de la misma operación y banco. */
function avisoTransferencia({ pago, otrosPagos }: DatosDePrevia) {
  if (!pago.transferencia || otrosPagos.length === 0) return null
  return {
    operacion: pago.transferencia.operacion,
    banco: pago.transferencia.banco,
    pagos: otrosPagos.map(({ id, numeroComprobante, alumno }) => ({
      pagoId: id,
      numeroComprobante,
      alumno,
    })),
  }
}

/** La confirmación de `GET /anulaciones/previa`: el resumen del pago y los tres avisos. */
export function armarPrevia(datos: DatosDePrevia): PreviaAnulacion {
  const { pago } = datos
  return {
    pago: {
      id: pago.id,
      numeroComprobante: pago.numeroComprobante,
      alumno: pago.alumno,
      total: pago.total,
      cantidad: pago.turnos.length,
    },
    avisos: {
      deuda: avisoDeuda(datos),
      precios: avisosDePrecio(datos),
      transferenciaCompartida: avisoTransferencia(datos),
    },
  }
}
