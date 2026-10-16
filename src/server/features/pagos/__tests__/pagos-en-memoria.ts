import { vi } from 'vitest'
import { ValidationError } from '@/server/errors'
import {
  CODIGO_ADJUNTO_INVALIDO,
  MENSAJE_ADJUNTO_INVALIDO,
} from '@/server/features/adjuntos/adjuntos.condiciones'
import type { PagosRepository } from '../pagos.repository'
import type { OcurrenciaCobro, PlanPago, SnapshotPago } from '../pagos.reglas'
import type { ComprobanteGuardado, EntradaPago, OcurrenciaPedida } from '../pagos.validation'

// `pagosRepository` en memoria para los tests del service (T-51), con el patrón de la reserva en
// memoria de `turnos.service.test.ts`: `registrar` ejecuta los pagos **de a uno** con una cola
// (como el `FOR UPDATE` del alumno en Postgres, que es la garantía real), arma el snapshot con los
// datos de ese momento y ejecuta el `verificar` real que le pasa el service. Si `verificar` lanza,
// no se escribe nada. El comprobante adjunto se vincula como `vincularAdjunto` (T-95): sólo uno
// disponible (sin pago) que subió quien cobra; si no, el mismo 400 y no queda nada escrito. Cada
// pago guarda el porcentaje del centro de `vigente` al registrarse (T-122): cambiarlo después no
// toca los pagos ya registrados.

/** Una ocurrencia de la "base": lo que devuelve el motor, más los datos del comprobante. */
export type OcurrenciaEnBase = OcurrenciaCobro & {
  horaInicio: number
  profesor: { id: number; nombre: string; apellido: string }
}

/** El nombre de cada forma de pago en el catálogo del seed. */
const NOMBRE_FORMA = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Tarjeta de débito',
} as const

type PagoEnBase = {
  id: number
  numeroComprobante: number
  entrada: EntradaPago
  plan: PlanPago
  porcentaje: number
}

/** Un comprobante subido con `POST /adjuntos`: quién lo subió y a qué pago quedó vinculado. */
export type AdjuntoEnBase = { subidoPor: string; pagoId: number | null }

export function crearPagosEnMemoria(
  ocurrencias: OcurrenciaEnBase[],
  precios: Map<number, number | null>,
  adjuntos: Map<number, AdjuntoEnBase> = new Map(),
  vigente: { porcentaje: number } = { porcentaje: 15 },
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
  const registrar = vi.fn<PagosRepository['registrar']>((entrada, verificar, actor) => {
    const ejecucion = cola.then(async () => {
      const snapshot = leer(entrada.ocurrencias)
      // Cede el turno entre la lectura y la escritura: sin la cola, otro pago se colaría acá.
      await new Promise((resolver) => setTimeout(resolver, 0))
      const plan = verificar(snapshot)
      const id = 31 + pagos.length
      const { medio } = entrada
      if (medio.formaPago !== 'EFECTIVO' && medio.comprobanteAdjuntoId !== null) {
        const adjunto = adjuntos.get(medio.comprobanteAdjuntoId)
        if (!adjunto || adjunto.pagoId !== null || adjunto.subidoPor !== actor.userId) {
          throw new ValidationError(MENSAJE_ADJUNTO_INVALIDO, {
            code: CODIGO_ADJUNTO_INVALIDO,
            details: [{ path: ['comprobanteAdjuntoId'], message: MENSAJE_ADJUNTO_INVALIDO }],
          })
        }
        adjunto.pagoId = id
      }
      const pago: PagoEnBase = {
        id,
        numeroComprobante: 1024 + pagos.length,
        entrada,
        plan,
        porcentaje: vigente.porcentaje,
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
    const { medio } = pago.entrada
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
          porcentaje: pago.porcentaje,
        }
      }),
      total: pago.plan.total,
      montoRecibido: medio.formaPago === 'EFECTIVO' ? medio.montoRecibido : null,
      formaPago: { codigo: medio.formaPago, nombre: NOMBRE_FORMA[medio.formaPago] },
      transferencia:
        medio.formaPago === 'TRANSFERENCIA'
          ? { ...medio.transferencia, titular: medio.transferencia.titular ?? null }
          : null,
      debito:
        medio.formaPago === 'DEBITO'
          ? { ...medio.debito, ultimos4: medio.debito.ultimos4 ?? null }
          : null,
      estado: 'VIGENTE',
      anulacion: null,
      observaciones: pago.entrada.observaciones,
      registradoPor: { id: 'usr_mesa', nombre: 'Laura', apellido: 'Gómez' },
      registradoEl: '2026-10-05T15:00:00.000Z',
    }
    return comprobante
  })

  // Los pagos realizados, "Mis pagos" y el adjunto (T-98) no los simula la base en memoria: cada test
  // les pone su respuesta.
  const listarRealizados = vi.fn<PagosRepository['listarRealizados']>()
  const listarDelAlumno = vi.fn<PagosRepository['listarDelAlumno']>()
  const buscarAdjunto = vi.fn<PagosRepository['buscarAdjunto']>(async () => null)

  return {
    repository: {
      leerSnapshot,
      registrar,
      buscarComprobante,
      listarRealizados,
      listarDelAlumno,
      buscarAdjunto,
    },
    pagos,
    pagadas,
    vigente,
  }
}
