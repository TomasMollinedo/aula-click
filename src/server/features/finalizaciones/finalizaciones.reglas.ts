import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import {
  MENSAJE_FECHA_PASADA,
  nombreDia,
  type Ocurrencia,
  type TipoTurno,
} from '@/server/features/turnos/ocurrencias.condiciones'
import { diaSemanaISO, sumarDias } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import type { PreviaFinalizacion, TramoPosterior } from './finalizaciones.validation'

// Reglas puras de la finalización (HU-14, T-47): qué turno se puede finalizar, desde qué fecha y
// qué se libera. Sin Prisma y sin `hoy()` adentro (lo recibe quien llama). Las usan el service
// (chequeo previo, sin lock) y el repository (con lo releído bajo lock, como callback `verificar`):
// una sola implementación.

export const CODIGO_TURNOS_PAGADOS = 'TURNOS_PAGADOS'

export const MENSAJE_TURNO_NO_ENCONTRADO = 'Turno no encontrado'
export const MENSAJE_NO_RECURRENTE = 'Sólo se puede finalizar un turno recurrente'
export const MENSAJE_NO_VIGENTE = 'El turno ya no está vigente: no se puede finalizar'
export const MENSAJE_YA_FINALIZADO = 'El turno ya fue finalizado'

/** `YYYY-MM-DD` → `DD/MM`. */
function diaMes(fecha: string): string {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`
}

export const mensajeOtroDia = (diaSemana: number) => `La fecha debe caer en ${nombreDia(diaSemana)}`
export const mensajeNoPosteriorAlInicio = (fechaInicio: string) =>
  `Elegí una fecha posterior al inicio del turno (${diaMes(fechaInicio)}). Para liberar sólo esa fecha, cancelá el turno.`
export const mensajePosteriorAlFin = (fechaFin: string) =>
  `La fecha es posterior al fin del turno (${diaMes(fechaFin)})`
export const mensajeTurnosPagados = (ultimaFechaPagada: string) =>
  `Hay turnos pagados desde esa fecha: elegí una fecha posterior al último turno pagado (${diaMes(ultimaFechaPagada)})`
export const mensajePagadosHastaElFinal = (ultimaFechaPagada: string) =>
  `Los turnos pagados llegan hasta el final de la serie (${diaMes(ultimaFechaPagada)}): no se puede finalizar`

/** El turno (o tramo) que se quiere finalizar, como está guardado. */
export type TurnoAFinalizar = {
  id: number
  alumnoId: number
  tipo: TipoTurno
  /** `Turno.estado = ACTIVO` (un `CANCELADO` es anterior al Sprint 2, decisión T-56). */
  activo: boolean
  fechaInicio: string
  /** La guardada: finalizar no la modifica (definición C). */
  fechaFin: string | null
  /** Día de la semana (ISO) de su bloque. */
  diaSemana: number
  tieneFinalizacion: boolean
}

/** Lo que las reglas necesitan de una ocurrencia leída por el motor. */
export type OcurrenciaDeLaSerie = Pick<
  Ocurrencia,
  'fecha' | 'horaInicio' | 'horaFin' | 'estado'
> & {
  pago: Pick<Ocurrencia['pago'], 'estado' | 'importeAplicado'>
}

/**
 * Lo leído para decidir: el turno (`null` si no existe), sus ocurrencias desde la mayor entre hoy y `fechaDesde` hasta su
 * fin (o, sin fin, hasta la última fecha que importa: la del pedido o la del último pago) por
 * fecha, y los tramos posteriores.
 */
export type SnapshotFinalizacion = {
  turno: TurnoAFinalizar | null
  ocurrencias: OcurrenciaDeLaSerie[]
  otrosTramos: TramoPosterior[]
}

function errorDeFecha(mensaje: string): ValidationError {
  return new ValidationError(mensaje, { details: [{ path: ['fechaDesde'], message: mensaje }] })
}

/**
 * Valida el pedido contra el snapshot y devuelve el turno. Lanza, en este orden (el primero que
 * falla gana):
 * 1. 404 si el turno no existe.
 * 2. 409 si no es `RECURRENTE`, si no está vigente o si ya tiene una finalización. **Vigente**
 *    acá es `ACTIVO` con `fechaFin` nula o `>= hoy`: el criterio con el que el detalle (T-43)
 *    muestra "Finalizar", no la regla completa de T-52 (una serie con todas sus fechas restantes
 *    canceladas se puede finalizar igual).
 * 3. 400 en `["fechaDesde"]` si es anterior a hoy, no cae en el día de la serie, no es posterior a
 *    `fechaInicio` o es posterior a `fechaFin`. Pasado esto, `fechaDesde` es una fecha de la serie.
 */
export function validarFinalizacion(
  snapshot: SnapshotFinalizacion,
  fechaDesde: string,
  fechaHoy: string,
): TurnoAFinalizar {
  const { turno } = snapshot
  if (!turno) throw new NotFoundError(MENSAJE_TURNO_NO_ENCONTRADO)

  if (turno.tipo !== 'RECURRENTE') throw new ConflictError(MENSAJE_NO_RECURRENTE)
  if (!turno.activo || (turno.fechaFin !== null && turno.fechaFin < fechaHoy)) {
    throw new ConflictError(MENSAJE_NO_VIGENTE)
  }
  if (turno.tieneFinalizacion) throw new ConflictError(MENSAJE_YA_FINALIZADO)

  if (fechaDesde < fechaHoy) throw errorDeFecha(MENSAJE_FECHA_PASADA)
  if (diaSemanaISO(fechaDesde) !== turno.diaSemana) {
    throw errorDeFecha(mensajeOtroDia(turno.diaSemana))
  }
  if (fechaDesde <= turno.fechaInicio) {
    throw errorDeFecha(mensajeNoPosteriorAlInicio(turno.fechaInicio))
  }
  if (turno.fechaFin !== null && fechaDesde > turno.fechaFin) {
    throw errorDeFecha(mensajePosteriorAlFin(turno.fechaFin))
  }
  return turno
}

/**
 * Qué se libera al finalizar desde `fechaDesde` (ya validada):
 * - `cantidad`: las ocurrencias no canceladas (las canceladas ya están libres) desde `fechaDesde`;
 *   `null` si la serie no tiene fin.
 * - `desde` = `fechaDesde`; `hasta` = la última ocurrencia de la serie, o `null` si no tiene fin.
 * - `pagadas`: las pagadas desde `fechaDesde` (definición D), `ultimaFechaPagada` y
 *   `fechaDesdeMinima` (la ocurrencia siguiente a la última pagada; `null` si no hay pagadas o si
 *   esa fecha ya pasa el fin de la serie: no queda ninguna fecha para elegir).
 */
export function armarPrevia(
  snapshot: SnapshotFinalizacion,
  turno: TurnoAFinalizar,
  fechaDesde: string,
): PreviaFinalizacion {
  const liberadas = snapshot.ocurrencias.filter((o) => o.fecha >= fechaDesde)
  const sinFin = turno.fechaFin === null
  const pagadas = liberadas
    .filter((o) => o.pago.estado === 'PAGADO')
    .map((o) => ({
      fecha: o.fecha,
      horaInicio: minutosAHora(o.horaInicio),
      horaFin: minutosAHora(o.horaFin),
      importe: o.pago.importeAplicado ?? 0,
    }))
  const ultimaFechaPagada = pagadas.at(-1)?.fecha ?? null
  const siguiente = ultimaFechaPagada && sumarDias(ultimaFechaPagada, 7)

  return {
    cantidad: sinFin ? null : liberadas.filter((o) => o.estado !== 'CANCELADO').length,
    desde: fechaDesde,
    hasta: sinFin ? null : (liberadas.at(-1)?.fecha ?? fechaDesde),
    pagadas,
    ultimaFechaPagada,
    fechaDesdeMinima:
      siguiente && (turno.fechaFin === null || siguiente <= turno.fechaFin) ? siguiente : null,
    otrosTramos: snapshot.otrosTramos,
  }
}

/**
 * Decide una finalización: `validarFinalizacion` y, si hay ocurrencias pagadas desde `fechaDesde`,
 * 409 `TURNOS_PAGADOS` con `details` `{ ultimaFechaPagada, fechaDesdeMinima, pagadas }` (no se
 * anulan pagos: hay que elegir una fecha posterior al último pagado). Si no lanza, devuelve la
 * previa, que es lo que se libera.
 */
export function planificarFinalizacion(
  snapshot: SnapshotFinalizacion,
  fechaDesde: string,
  fechaHoy: string,
): PreviaFinalizacion {
  const turno = validarFinalizacion(snapshot, fechaDesde, fechaHoy)
  const previa = armarPrevia(snapshot, turno, fechaDesde)
  const { ultimaFechaPagada, fechaDesdeMinima, pagadas } = previa
  if (ultimaFechaPagada !== null) {
    throw new ConflictError(
      fechaDesdeMinima === null
        ? mensajePagadosHastaElFinal(ultimaFechaPagada)
        : mensajeTurnosPagados(ultimaFechaPagada),
      { code: CODIGO_TURNOS_PAGADOS, details: { ultimaFechaPagada, fechaDesdeMinima, pagadas } },
    )
  }
  return previa
}
