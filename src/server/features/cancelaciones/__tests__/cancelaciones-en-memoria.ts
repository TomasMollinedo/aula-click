import { vi } from 'vitest'
import type { CancelacionesRepository } from '../cancelaciones.repository'
import type { OcurrenciaCancelable } from '../cancelaciones.reglas'
import type { OcurrenciaACancelar } from '../cancelaciones.validation'

// `cancelacionesRepository` en memoria para los tests del service (T-45), con el patrón del pago
// en memoria: `cancelar` ejecuta las escrituras **de a una** con una cola (como el `FOR UPDATE` del
// alumno en Postgres, que es la garantía real), arma el snapshot con los datos de ese momento y
// ejecuta el `verificar` real que le pasa el service. Si `verificar` lanza, no se escribe nada.

export type OcurrenciaEnBase = OcurrenciaCancelable

export function crearCancelacionesEnMemoria(ocurrencias: OcurrenciaEnBase[]) {
  /** Cancelaciones por `(turnoId, fecha)`: el único de `cancelacion_turno`. */
  const canceladas = new Map<string, { motivo: string; detalle: string | null }>()
  const clave = (turnoId: number, fecha: string) => `${turnoId}|${fecha}`

  /** Como `leerOcurrencias` con `turnoIds` y el rango del pedido: estado al momento de leer. */
  function leer(pedidas: readonly OcurrenciaACancelar[]): OcurrenciaCancelable[] {
    const fechas = pedidas.map((o) => o.fecha).sort()
    const turnoIds = new Set(pedidas.map((o) => o.turnoId))
    return ocurrencias
      .filter(
        (o) =>
          turnoIds.has(o.turnoId) &&
          o.fecha >= (fechas[0] ?? '') &&
          o.fecha <= (fechas.at(-1) ?? ''),
      )
      .map((o) => (canceladas.has(clave(o.turnoId, o.fecha)) ? { ...o, estado: 'CANCELADO' } : o))
  }

  let cola: Promise<unknown> = Promise.resolve()
  const cancelar = vi.fn<CancelacionesRepository['cancelar']>((entrada, verificar) => {
    const ejecucion = cola.then(async () => {
      const snapshot = leer(entrada.ocurrencias)
      // Cede el turno entre la lectura y la escritura: sin la cola, otra escritura se colaría acá.
      await new Promise((resolver) => setTimeout(resolver, 0))
      const plan = verificar(snapshot)
      for (const { turnoId, fecha } of plan.lineas) {
        canceladas.set(clave(turnoId, fecha), { motivo: entrada.motivo, detalle: entrada.detalle })
      }
      return plan
    })
    cola = ejecucion.catch(() => undefined)
    return ejecucion
  })

  const leerSnapshot = vi.fn<CancelacionesRepository['leerSnapshot']>(async (pedidas) =>
    leer(pedidas),
  )

  /** Un pago simultáneo: marca la ocurrencia como pagada, en la misma cola que las cancelaciones. */
  function pagar(turnoId: number, fecha: string) {
    cola = cola.then(() => {
      const o = ocurrencias.find((x) => x.turnoId === turnoId && x.fecha === fecha)
      if (o) o.pago = { estado: 'PAGADO', pagoId: 90 }
    })
    return cola
  }

  return { repository: { leerSnapshot, cancelar }, canceladas, pagar }
}
