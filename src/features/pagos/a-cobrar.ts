import type { OcurrenciaDetalle } from '@/types/ocurrencia'
import type { OcurrenciaACobrar } from '@/types/pago'

// Lo que se ofrece cobrar en el diálogo (HU-15). Los importes los manda la API a quien abre el
// diálogo: el detalle del turno con `pago.importeVigente` (T-43) y `cuentas` con los de sus
// adeudados y próximos (T-53). La única cuenta que hace el cliente es sumarlos para el resumen; el
// total real sale de la respuesta del `POST`.

/**
 * La ocurrencia del detalle del turno como `OcurrenciaACobrar`. Es el único lugar de `pagos` que
 * conoce la forma de `OcurrenciaDetalle` (provisoria hasta T-44): usa solo lo mínimo. El importe es
 * el vigente si el pago está `PENDIENTE`; si ya está pagada, `null` (la API la rechaza igual).
 */
export function aCobrarDesdeDetalle(ocurrencia: OcurrenciaDetalle): OcurrenciaACobrar {
  const { turnoId, fecha, horaInicio, horaFin, materia, profesor, pago } = ocurrencia
  return {
    turnoId,
    fecha,
    horaInicio,
    horaFin,
    materia: { id: materia.id, nombre: materia.nombre },
    profesor: { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido },
    importe: pago.estado === 'PENDIENTE' ? pago.importeVigente : null,
  }
}

export type ResumenACobrar = {
  cantidad: number
  /** Suma de los importes que mandó la API, o `null` si alguno no tiene precio. */
  total: number | null
  /** Cuántas vienen sin importe (materia sin precio). */
  sinPrecio: number
}

/**
 * Cantidad y total de lo que se ofrece cobrar. La suma va en centavos, como en la API, para no
 * acumular el error de coma flotante. Sin total si alguna no tiene precio: la API la va a rechazar
 * con `SIN_PRECIO` y el envío no se bloquea.
 */
export function resumenACobrar(
  ocurrencias: readonly Pick<OcurrenciaACobrar, 'importe'>[],
): ResumenACobrar {
  const sinPrecio = ocurrencias.filter((o) => o.importe === null).length
  const centavos = ocurrencias.reduce((suma, o) => suma + Math.round((o.importe ?? 0) * 100), 0)
  return {
    cantidad: ocurrencias.length,
    total: sinPrecio > 0 ? null : centavos / 100,
    sinPrecio,
  }
}
