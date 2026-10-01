import type { OcurrenciaDetalle } from '@/types/ocurrencia'
import type { OcurrenciaACobrar } from '@/types/pago'
import { sumarImportes } from '@/utils/moneda'

// Lo que se ofrece cobrar en el diálogo (HU-15). Los importes los manda la API a quien abre el
// diálogo: el detalle del turno con `pago.importeVigente` (T-43) y `cuentas` con los de sus
// adeudados y próximos (T-53). La única cuenta que hace el cliente es sumarlos para el resumen; el
// total real sale de la respuesta del `POST`.

/**
 * La ocurrencia del detalle del turno como `OcurrenciaACobrar`. Es el único lugar de `pagos` que
 * conoce la forma de `OcurrenciaDetalle`: usa solo lo mínimo.
 */
export function aCobrarDesdeDetalle(ocurrencia: OcurrenciaDetalle): OcurrenciaACobrar {
  const { turnoId, fecha, horaInicio, horaFin, materia, profesor } = ocurrencia
  return {
    turnoId,
    fecha,
    horaInicio,
    horaFin,
    materia: { id: materia.id, nombre: materia.nombre },
    profesor: { id: profesor.id, nombre: profesor.nombre, apellido: profesor.apellido },
    // TODO integración detalle (prompt 2): `OcurrenciaDetalle` (T-44) ya no trae `pago`, así que el
    // detalle no tiene de dónde sacar el importe. Antes: el vigente si el pago estaba `PENDIENTE` y
    // `null` si ya estaba pagada. Provisorio: siempre `null` (el diálogo lo muestra sin importe).
    importe: null,
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
 * Cantidad y total de lo que se ofrece cobrar. La suma va en centavos, como en la API
 * (`sumarImportes`). Sin total si alguna no tiene precio: la API la va a rechazar con `SIN_PRECIO`
 * y el envío no se bloquea.
 */
export function resumenACobrar(
  ocurrencias: readonly Pick<OcurrenciaACobrar, 'importe'>[],
): ResumenACobrar {
  return { cantidad: ocurrencias.length, ...sumarImportes(ocurrencias.map((o) => o.importe)) }
}
