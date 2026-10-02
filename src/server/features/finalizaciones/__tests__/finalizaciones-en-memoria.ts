import { vi } from 'vitest'
import { ConflictError } from '@/server/errors'
import { sumarDias } from '@/server/shared/fechas'
import type { FinalizacionesRepository } from '../finalizaciones.repository'
import {
  MENSAJE_YA_FINALIZADO,
  type FilaDeSerie,
  type OcurrenciaDeLaSerie,
  type SnapshotFinalizacion,
} from '../finalizaciones.reglas'

// `finalizacionesRepository` en memoria para los tests del service (T-47), con el patrón de la
// cancelación en memoria: `finalizar` ejecuta las escrituras **de a una** con una cola (como el
// `FOR UPDATE` del alumno en Postgres, que es la garantía real), arma el snapshot con los datos de
// ese momento y ejecuta el `verificar` real que le pasa el service. Si `verificar` lanza, no se
// escribe nada.

/**
 * Una fila `turno` con las ocurrencias que devolvería el motor si no estuviera finalizada (por
 * fecha): el snapshot las corta en su fin efectivo y desde `fechaDesde`.
 */
export type TurnoEnBase = FilaDeSerie & { ocurrencias: OcurrenciaDeLaSerie[] }

/** Ocurrencias semanales `AGENDADO` y pendientes de una hora, de `desde` a `hasta` (incluidas). */
export function semanales(
  desde: string,
  hasta: string,
  turnoId = 41,
  horaInicio = 540,
): OcurrenciaDeLaSerie[] {
  const ocurrencias: OcurrenciaDeLaSerie[] = []
  for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 7)) {
    ocurrencias.push({
      turnoId,
      fecha,
      horaInicio,
      horaFin: horaInicio + 60,
      estado: 'AGENDADO',
      pago: { estado: 'PENDIENTE' },
    })
  }
  return ocurrencias
}

export function crearFinalizacionesEnMemoria(turnos: TurnoEnBase[]) {
  /** Finalizaciones por `turnoId`: el único de `finalizacion_recurrencia`. */
  const finalizaciones = new Map<
    number,
    { fechaDesde: string; motivo: string; detalle: string | null; createdById: string }
  >()

  const finalizadaDesde = (turno: TurnoEnBase) =>
    finalizaciones.get(turno.turnoId)?.fechaDesde ?? turno.finalizadaDesde

  /** Como `leerSnapshot` del repository: estado al momento de leer. */
  function leer(turnoId: number, fechaDesde: string): SnapshotFinalizacion {
    const pedido = turnos.find((t) => t.turnoId === turnoId)
    if (!pedido) return { turno: null, filas: [], ocurrencias: [] }
    // Como `leerFilasDeLaSerie`: los `RECURRENTE` `ACTIVO` de su serie; sin `serieId`, sólo él.
    const deLaSerie = turnos.filter(
      (t) =>
        t.tipo === 'RECURRENTE' &&
        t.activo &&
        (pedido.serieId === null ? t === pedido : t.serieId === pedido.serieId),
    )
    const aFila = ({ ocurrencias, ...fila }: TurnoEnBase): FilaDeSerie => {
      void ocurrencias
      return fila
    }
    return {
      turno: { ...aFila(pedido), finalizadaDesde: finalizadaDesde(pedido) },
      filas: deLaSerie.map((t) => ({ ...aFila(t), finalizadaDesde: finalizadaDesde(t) })),
      // Como el motor: desde `fechaDesde`, dentro del fin efectivo y por fecha, hora y turno.
      ocurrencias: deLaSerie
        .flatMap((t) => {
          const corte = finalizadaDesde(t)
          return t.ocurrencias.filter(
            (o) => o.fecha >= fechaDesde && (corte === null || o.fecha < corte),
          )
        })
        .map((o) => ({ ...o, pago: { ...o.pago } }))
        .sort(
          (a, b) =>
            (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) ||
            a.horaInicio - b.horaInicio ||
            a.turnoId - b.turnoId,
        ),
    }
  }

  let cola: Promise<unknown> = Promise.resolve()
  const finalizar = vi.fn<FinalizacionesRepository['finalizar']>((entrada, verificar, actor) => {
    const ejecucion = cola.then(async () => {
      const snapshot = leer(entrada.turnoId, entrada.fechaDesde)
      // Cede el turno entre la lectura y la escritura: sin la cola, otra escritura se colaría acá.
      await new Promise((resolver) => setTimeout(resolver, 0))
      const plan = verificar(snapshot)
      // El único de `turno_id` (P2002): todo o nada.
      if (plan.turnoIds.some((id) => finalizaciones.has(id))) {
        throw new ConflictError(MENSAJE_YA_FINALIZADO)
      }
      for (const turnoId of plan.turnoIds) {
        finalizaciones.set(turnoId, {
          fechaDesde: entrada.fechaDesde,
          motivo: entrada.motivo,
          detalle: entrada.detalle,
          createdById: actor.userId,
        })
      }
      return plan
    })
    cola = ejecucion.catch(() => undefined)
    return ejecucion
  })

  const leerSnapshot = vi.fn<FinalizacionesRepository['leerSnapshot']>(
    async (turnoId, fechaDesde) => leer(turnoId, fechaDesde),
  )

  /** Otra escritura del mismo alumno, en la misma cola que las finalizaciones. */
  function encolar(cambio: (turno: TurnoEnBase) => void, turnoId: number) {
    cola = cola.then(() => {
      const turno = turnos.find((t) => t.turnoId === turnoId)
      if (turno) cambio(turno)
    })
    return cola
  }

  /** Un pago simultáneo de esa ocurrencia. */
  const pagar = (turnoId: number, fecha: string, importe = 8500) =>
    encolar((turno) => {
      const ocurrencia = turno.ocurrencias.find((o) => o.fecha === fecha)
      if (ocurrencia) ocurrencia.pago = { estado: 'PAGADO', importeAplicado: importe }
    }, turnoId)

  /** Una reprogramación simultánea de su única fecha: el turno pasa a ser sesión única (T-49). */
  const pasarASesionUnica = (turnoId: number) =>
    encolar((turno) => {
      turno.tipo = 'SESION_UNICA'
      turno.serieId = null
    }, turnoId)

  return { repository: { leerSnapshot, finalizar }, finalizaciones, pagar, pasarASesionUnica }
}
