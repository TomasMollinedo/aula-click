import type { OcurrenciaACobrar } from '@/types/pago'

import type { AdeudadoGlobal, OcurrenciaDeCuenta } from './cuentas.types'

// Lo que `cuentas` le pasa al diálogo de cobro de `pagos` (`renderRegistrarPago`). Los importes son
// los que mandó la API (T-53): acá no se calcula nada.

/** Una fila de la cuenta del alumno o de la vista global. */
export type FilaDeCuenta = OcurrenciaDeCuenta | AdeudadoGlobal

/**
 * La fila como `OcurrenciaACobrar`: solo le saca `estado` (y `alumno`, en la vista global), sin
 * transformar nada más (docs/contrato-api.md → Cuentas). Es el único lugar de `cuentas` que la arma.
 * Devuelve un objeto nuevo: es la copia que queda en la selección aunque la fila desaparezca.
 */
export function aCobrar(fila: FilaDeCuenta): OcurrenciaACobrar {
  const { turnoId, fecha, horaInicio, horaFin, materia, profesor, importe } = fila
  return { turnoId, fecha, horaInicio, horaFin, materia, profesor, importe }
}

/**
 * `'41|2026-09-21'`. La ocurrencia es `(turnoId, fecha)` (definición B): un `turnoId` solo no
 * alcanza, porque un recurrente tiene una ocurrencia por semana.
 */
export function claveOcurrencia({ turnoId, fecha }: { turnoId: number; fecha: string }): string {
  return `${turnoId}|${fecha}`
}
