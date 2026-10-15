import { vi } from 'vitest'
import { ConflictError } from '@/server/errors'
import type { PagoParaAnular } from '@/server/features/pagos/pagos.condiciones'
import type { AnulacionesRepository } from '../anulaciones.repository'

// `anulacionesRepository` en memoria para los tests del service (T-104), con el patrón del pago y la
// cancelación en memoria: `anular` ejecuta las escrituras **de a una** con una cola (como el
// `FOR UPDATE` del alumno en Postgres, que es la garantía real), relee el pago con los datos de ese
// momento y ejecuta el `verificar` real que le pasa el service. Si `verificar` lanza, no se escribe
// nada. Una ocurrencia está pagada si algún pago **vigente** la incluye (como `PagoTurno.vigente`
// en el motor); `cobrar` simula un pago nuevo en la misma cola.

export type PagoEnBase = PagoParaAnular

export type DatosDePreviaEnBase = {
  deudaVencida?: { cantidad: number; total: number }
  precios?: Map<number, number | null>
}

export function crearAnulacionesEnMemoria(
  pagos: PagoEnBase[],
  { deudaVencida = { cantidad: 0, total: 0 }, precios = new Map() }: DatosDePreviaEnBase = {},
) {
  const anulaciones = new Map<
    number,
    { motivo: string; detalle: string | null; creadoPor: string }
  >()
  const clave = (turnoId: number, fecha: string) => `${turnoId}|${fecha}`

  const leer = (pagoId: number) => {
    const pago = pagos.find((p) => p.id === pagoId)
    return pago ? structuredClone(pago) : null
  }

  /** Ocurrencias con un pago vigente: lo que el motor lee como `PAGADO`. */
  function pagadas(): Map<string, number> {
    const mapa = new Map<string, number>()
    for (const pago of pagos.filter((p) => p.estado === 'VIGENTE')) {
      for (const { turnoId, fecha } of pago.turnos) mapa.set(clave(turnoId, fecha), pago.id)
    }
    return mapa
  }

  let cola: Promise<unknown> = Promise.resolve()

  const anular = vi.fn<AnulacionesRepository['anular']>((entrada, verificar, actor) => {
    const ejecucion = cola.then(async () => {
      const pago = leer(entrada.pagoId)
      // Cede el turno entre la lectura y la escritura: sin la cola, otra escritura se colaría acá.
      await new Promise((resolver) => setTimeout(resolver, 0))
      const aAnular = verificar(pago)
      const enBase = pagos.find((p) => p.id === aAnular.id)
      if (enBase) enBase.estado = 'ANULADO'
      anulaciones.set(aAnular.id, {
        motivo: entrada.motivo,
        detalle: entrada.detalle,
        creadoPor: actor.userId,
      })
      return aAnular.turnos.length
    })
    cola = ejecucion.catch(() => undefined)
    return ejecucion
  })

  const leerPago = vi.fn<AnulacionesRepository['leerPago']>(async (pagoId) => leer(pagoId))

  const leerContextoDePrevia = vi.fn<AnulacionesRepository['leerContextoDePrevia']>(
    async (pago) => ({
      deudaVencida,
      precios,
      otrosPagos: pago.transferencia
        ? pagos
            .filter(
              (p) =>
                p.id !== pago.id &&
                p.estado === 'VIGENTE' &&
                p.transferencia?.operacion === pago.transferencia?.operacion &&
                p.transferencia?.banco === pago.transferencia?.banco,
            )
            .map(({ id, numeroComprobante, alumno }) => ({ id, numeroComprobante, alumno }))
        : [],
    }),
  )

  /**
   * Un pago nuevo de estas ocurrencias, en la misma cola que las anulaciones: falla con `YA_PAGADO`
   * si alguna ya tiene un pago vigente (el único de `pago_turno`) y, si no, queda vigente.
   */
  function cobrar(nuevo: PagoEnBase) {
    const ejecucion = cola.then(() => {
      const ya = pagadas()
      if (nuevo.turnos.some((t) => ya.has(clave(t.turnoId, t.fecha)))) {
        throw new ConflictError('Alguno de los turnos ya fue pagado')
      }
      pagos.push(nuevo)
    })
    cola = ejecucion.catch(() => undefined)
    return ejecucion
  }

  return {
    repository: { leerPago, leerContextoDePrevia, anular },
    anulaciones,
    pagadas,
    cobrar,
  }
}
