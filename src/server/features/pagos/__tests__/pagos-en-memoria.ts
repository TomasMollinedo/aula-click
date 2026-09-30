import { vi } from 'vitest'
import type { PagosRepository } from '../pagos.repository'
import type { OcurrenciaCobro, PlanPago, SnapshotPago } from '../pagos.reglas'
import type { ComprobanteGuardado, EntradaPago, OcurrenciaPedida } from '../pagos.validation'

// `pagosRepository` en memoria para los tests del service (T-51), con el patrón de la reserva en
// memoria de `turnos.service.test.ts`: `registrar` ejecuta los pagos **de a uno** con una cola
// (como el `FOR UPDATE` del alumno en Postgres, que es la garantía real), arma el snapshot con los
// datos de ese momento y ejecuta el `verificar` real que le pasa el service. Si `verificar` lanza,
// no se escribe nada.

/** Una ocurrencia de la "base": lo que devuelve el motor, más los datos del comprobante. */
export type OcurrenciaEnBase = OcurrenciaCobro & {
  horaInicio: number
  profesor: { id: number; nombre: string; apellido: string }
}

type PagoEnBase = { id: number; numeroComprobante: number; entrada: EntradaPago; plan: PlanPago }

export function crearPagosEnMemoria(
  ocurrencias: OcurrenciaEnBase[],
  precios: Map<number, number | null>,
) {
  const pagos: PagoEnBase[] = []
  /** Pagos por `(turnoId, fecha)`: el único de `pago_turno`. */
  const pagadas = new Map<string, number>()
  const clave = (turnoId: number, fecha: string) => `${turnoId}|${fecha}`

  /** Como `leerOcurrencias` con `turnoIds` y el rango del pedido: estado de pago al momento. */
  function leer(pedidas: readonly OcurrenciaPedida[]): SnapshotPago {
    const fechas = pedidas.map((o) => o.fecha).sort()
    const turnoIds = new Set(pedidas.map((o) => o.turnoId))
    return {
      ocurrencias: ocurrencias
        .filter(
          (o) =>
            turnoIds.has(o.turnoId) &&
            o.fecha >= (fechas[0] ?? '') &&
            o.fecha <= (fechas.at(-1) ?? ''),
        )
        .map((o) => {
          const pagoId = pagadas.get(clave(o.turnoId, o.fecha))
          return {
            ...o,
            pago: pagoId === undefined ? o.pago : { estado: 'PAGADO' as const, pagoId },
          }
        }),
      precios: new Map(precios),
    }
  }

  let cola: Promise<unknown> = Promise.resolve()
  const registrar = vi.fn<PagosRepository['registrar']>((entrada, verificar) => {
    const ejecucion = cola.then(async () => {
      const snapshot = leer(entrada.ocurrencias)
      // Cede el turno entre la lectura y la escritura: sin la cola, otro pago se colaría acá.
      await new Promise((resolver) => setTimeout(resolver, 0))
      const plan = verificar(snapshot)
      const pago: PagoEnBase = {
        id: 31 + pagos.length,
        numeroComprobante: 1024 + pagos.length,
        entrada,
        plan,
      }
      pagos.push(pago)
      for (const linea of plan.lineas) pagadas.set(clave(linea.turnoId, linea.fecha), pago.id)
      return { pagoId: pago.id, numeroComprobante: pago.numeroComprobante, plan }
    })
    cola = ejecucion.catch(() => undefined)
    return ejecucion
  })

  const leerSnapshot = vi.fn<PagosRepository['leerSnapshot']>(async (pedidas) => leer(pedidas))

  const buscarComprobante = vi.fn<PagosRepository['buscarComprobante']>(async (id) => {
    const pago = pagos.find((p) => p.id === id)
    if (!pago) return null
    const hhmm = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    const comprobante: ComprobanteGuardado = {
      id: pago.id,
      numeroComprobante: pago.numeroComprobante,
      fechaPago: pago.entrada.fechaPago,
      alumno: { id: pago.entrada.alumnoId, nombre: 'Lucía', apellido: 'Álvarez', dni: '52345678' },
      turnos: pago.plan.lineas.map((linea) => {
        const o = ocurrencias.find((x) => x.turnoId === linea.turnoId && x.fecha === linea.fecha)
        return {
          turnoId: linea.turnoId,
          fecha: linea.fecha,
          horaInicio: hhmm(o?.horaInicio ?? 0),
          horaFin: hhmm((o?.horaInicio ?? 0) + 60),
          materia: { id: o?.materiaId ?? 0, nombre: 'Matemática' },
          profesor: o?.profesor ?? { id: 0, nombre: '', apellido: '' },
          importe: linea.importe,
        }
      }),
      total: pago.plan.total,
      montoRecibido: pago.entrada.montoRecibido,
      formaPago: { id: 1, nombre: 'Efectivo' },
      observaciones: pago.entrada.observaciones,
      registradoPor: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
      registradoEl: '2026-10-05T15:00:00.000Z',
    }
    return comprobante
  })

  return { repository: { leerSnapshot, registrar, buscarComprobante }, pagos, pagadas }
}
