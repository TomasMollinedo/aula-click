import { vi } from 'vitest'
import { sumarDias } from '@/server/shared/fechas'
import type { FinalizacionesRepository } from '../finalizaciones.repository'
import type {
  OcurrenciaDeLaSerie,
  SnapshotFinalizacion,
  TurnoAFinalizar,
} from '../finalizaciones.reglas'

// `finalizacionesRepository` en memoria para los tests del service (T-47), con el patrón de la
// cancelación en memoria: `finalizar` ejecuta las escrituras **de a una** con una cola (como el
// `FOR UPDATE` del alumno en Postgres, que es la garantía real), arma el snapshot con los datos de
// ese momento y ejecuta el `verificar` real que le pasa el service. Si `verificar` lanza, no se
// escribe nada.

/** Un turno con las ocurrencias que devolvería el motor (por fecha; las reglas sólo usan las de `fechaDesde` en adelante). */
export type TurnoEnBase = TurnoAFinalizar & {
  materiaId: number
  bloqueAgendaId: number
  ocurrencias: OcurrenciaDeLaSerie[]
}

/** Ocurrencias semanales `AGENDADO` y pendientes de 9 a 10, de `desde` a `hasta` (incluidas). */
export function semanales(desde: string, hasta: string): OcurrenciaDeLaSerie[] {
  const ocurrencias: OcurrenciaDeLaSerie[] = []
  for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 7)) {
    ocurrencias.push({
      fecha,
      horaInicio: 540,
      horaFin: 600,
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

  const finalizado = (turno: TurnoEnBase) => turno.tieneFinalizacion || finalizaciones.has(turno.id)

  /** Como `leerSnapshot` del repository: estado al momento de leer. */
  function leer(turnoId: number, fechaDesde: string): SnapshotFinalizacion {
    const turno = turnos.find((t) => t.id === turnoId)
    if (!turno) return { turno: null, ocurrencias: [], otrosTramos: [] }
    const { materiaId, bloqueAgendaId, ocurrencias, ...datos } = turno
    return {
      turno: { ...datos, tieneFinalizacion: finalizado(turno) },
      ocurrencias: ocurrencias.map((o) => ({ ...o, pago: { ...o.pago } })),
      otrosTramos: turnos
        .filter(
          (t) =>
            t.tipo === 'RECURRENTE' &&
            t.activo &&
            t.alumnoId === turno.alumnoId &&
            t.materiaId === materiaId &&
            t.bloqueAgendaId === bloqueAgendaId &&
            t.fechaInicio > turno.fechaInicio &&
            !finalizado(t) &&
            (t.fechaFin === null || t.fechaFin >= fechaDesde),
        )
        .map((t) => ({ turnoId: t.id, fechaInicio: t.fechaInicio, fechaFin: t.fechaFin })),
    }
  }

  let cola: Promise<unknown> = Promise.resolve()
  const finalizar = vi.fn<FinalizacionesRepository['finalizar']>((entrada, verificar, actor) => {
    const ejecucion = cola.then(async () => {
      const snapshot = leer(entrada.turnoId, entrada.fechaDesde)
      // Cede el turno entre la lectura y la escritura: sin la cola, otra escritura se colaría acá.
      await new Promise((resolver) => setTimeout(resolver, 0))
      const plan = verificar(snapshot)
      finalizaciones.set(entrada.turnoId, {
        fechaDesde: entrada.fechaDesde,
        motivo: entrada.motivo,
        detalle: entrada.detalle,
        createdById: actor.userId,
      })
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
      const turno = turnos.find((t) => t.id === turnoId)
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
    }, turnoId)

  return { repository: { leerSnapshot, finalizar }, finalizaciones, pagar, pasarASesionUnica }
}
