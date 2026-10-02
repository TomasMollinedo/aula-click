import { ConflictError, NotFoundError, ValidationError } from '@/server/errors'
import {
  MENSAJE_FECHA_PASADA,
  nombreDia,
  type FilaDeSerie,
  type Ocurrencia,
} from '@/server/features/turnos/ocurrencias.condiciones'
import { diaSemanaISO, sumarDias } from '@/server/shared/fechas'
import { minutosAHora } from '@/server/shared/zod'
import type { OtraHora, PreviaFinalizacion } from './finalizaciones.validation'

// Reglas puras de la finalización (HU-14, T-47; por hora desde la decisión T-104): qué se puede
// finalizar, desde qué fecha y qué se libera. Sin Prisma y sin `hoy()` adentro (lo recibe quien
// llama). Las usan el service (chequeo previo, sin lock) y el repository (con lo releído bajo lock,
// como callback `verificar`): una sola implementación.
//
// Finalizar actúa sobre el **conjunto**: las filas de la serie del turno pedido (`Turno.serieId`,
// decisión T-103) que son de su misma hora (`bloqueAgendaId`), en todos sus tramos. Las otras horas
// de la serie no se finalizan: se informan (`otrasHoras`). Con `serieId` nulo el conjunto es sólo
// el turno pedido.

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

export type { FilaDeSerie }

/** Lo que las reglas necesitan de una ocurrencia leída por el motor. */
export type OcurrenciaDeLaSerie = Pick<
  Ocurrencia,
  'turnoId' | 'fecha' | 'horaInicio' | 'horaFin' | 'estado'
> & {
  pago: Pick<Ocurrencia['pago'], 'estado' | 'importeAplicado'>
}

/**
 * Lo leído para decidir: el turno pedido (`null` si no existe), las filas de su serie (todas sus
 * horas y sus tramos: `leerFilasDeLaSerie`) y las ocurrencias de esas filas desde la mayor entre
 * hoy y `fechaDesde`, por fecha (las anteriores no se usan: la vigencia sale de `fechaFin`).
 */
export type SnapshotFinalizacion = {
  turno: FilaDeSerie | null
  filas: FilaDeSerie[]
  ocurrencias: OcurrenciaDeLaSerie[]
}

/** Las filas de la hora que se finaliza (todos sus tramos), con sus extremos. */
export type ConjuntoAFinalizar = {
  turno: FilaDeSerie
  filas: FilaDeSerie[]
  /** El menor `fechaInicio` del conjunto. */
  primerInicio: string
  /** El mayor `fechaFin` guardado del conjunto; `null` si alguna fila no tiene fin. */
  ultimoFin: string | null
}

/** Lo que decide `planificarFinalizacion`: lo que se libera y en qué turnos se registra. */
export type PlanFinalizacion = {
  previa: PreviaFinalizacion
  /** Filas del conjunto con fechas desde `fechaDesde`: cada una lleva su `FinalizacionRecurrencia`. */
  turnoIds: number[]
}

function errorDeFecha(mensaje: string): ValidationError {
  return new ValidationError(mensaje, { details: [{ path: ['fechaDesde'], message: mensaje }] })
}

/**
 * Valida el pedido contra el snapshot y devuelve el conjunto que se finaliza. Lanza, en este orden
 * (el primero que falla gana):
 * 1. 404 si el turno no existe.
 * 2. 409 si no es `RECURRENTE`, si no está vigente o si ya está finalizado, **sobre el conjunto**:
 *    - **Vigente** es que el turno pedido esté `ACTIVO` y alguna fila del conjunto tenga `fechaFin`
 *      nula o `>= hoy`: el criterio con el que el detalle (T-43) muestra "Finalizar" (decisión
 *      T-75), no la regla completa de T-52 (una serie con todas sus fechas restantes canceladas se
 *      puede finalizar igual).
 *    - **Ya finalizado** es que alguna fila del conjunto tenga finalización.
 * 3. 400 en `["fechaDesde"]` si es anterior a hoy, no cae en el día de la serie, no es posterior al
 *    primer inicio del conjunto o es posterior a su último fin. Una fecha que cae en un hueco entre
 *    dos tramos es válida: se liberan las que siguen.
 */
export function validarFinalizacion(
  snapshot: SnapshotFinalizacion,
  fechaDesde: string,
  fechaHoy: string,
): ConjuntoAFinalizar {
  const { turno } = snapshot
  if (!turno) throw new NotFoundError(MENSAJE_TURNO_NO_ENCONTRADO)

  if (turno.tipo !== 'RECURRENTE') throw new ConflictError(MENSAJE_NO_RECURRENTE)
  const filas = snapshot.filas.filter((fila) => fila.bloqueAgendaId === turno.bloqueAgendaId)
  const vigente = filas.some((fila) => fila.fechaFin === null || fila.fechaFin >= fechaHoy)
  if (!turno.activo || !vigente) throw new ConflictError(MENSAJE_NO_VIGENTE)
  if (filas.some((fila) => fila.finalizadaDesde !== null)) {
    throw new ConflictError(MENSAJE_YA_FINALIZADO)
  }

  const primerInicio = filas.reduce((min, f) => (f.fechaInicio < min ? f.fechaInicio : min), '9999')
  const ultimoFin = filas.reduce<string | null>(
    (max, f) => (max === null || f.fechaFin === null ? null : f.fechaFin > max ? f.fechaFin : max),
    '',
  )

  if (fechaDesde < fechaHoy) throw errorDeFecha(MENSAJE_FECHA_PASADA)
  if (diaSemanaISO(fechaDesde) !== turno.diaSemana) {
    throw errorDeFecha(mensajeOtroDia(turno.diaSemana))
  }
  if (fechaDesde <= primerInicio) throw errorDeFecha(mensajeNoPosteriorAlInicio(primerInicio))
  if (ultimoFin !== null && fechaDesde > ultimoFin) {
    throw errorDeFecha(mensajePosteriorAlFin(ultimoFin))
  }
  return { turno, filas, primerInicio, ultimoFin }
}

/**
 * Las otras horas de la serie que siguen agendadas desde `fechaDesde`: una por hora
 * (`bloqueAgendaId`) distinta de la que se finaliza, si ninguna de sus filas tiene finalización y
 * alguna tiene una ocurrencia desde `fechaDesde`. Cada una lleva esa primera ocurrencia
 * (`turnoId` + `fecha`), que es la que abre su detalle. Una hora que termina antes de `fechaDesde`
 * no se informa: no queda nada que avisar. Por hora de inicio.
 */
function otrasHorasDe(snapshot: SnapshotFinalizacion, conjunto: ConjuntoAFinalizar): OtraHora[] {
  const finalizadas = new Set(
    snapshot.filas.filter((f) => f.finalizadaDesde !== null).map((f) => f.bloqueAgendaId),
  )
  const horaDe = new Map(snapshot.filas.map((fila) => [fila.turnoId, fila.bloqueAgendaId]))
  // Las ocurrencias vienen por fecha (y ya son `>= fechaDesde`): la primera de cada hora gana.
  const primeras = new Map<number, OcurrenciaDeLaSerie>()
  for (const ocurrencia of snapshot.ocurrencias) {
    const hora = horaDe.get(ocurrencia.turnoId)
    if (
      hora === undefined ||
      hora === conjunto.turno.bloqueAgendaId ||
      finalizadas.has(hora) ||
      primeras.has(hora)
    ) {
      continue
    }
    primeras.set(hora, ocurrencia)
  }
  return [...primeras.values()]
    .sort((a, b) => a.horaInicio - b.horaInicio || a.turnoId - b.turnoId)
    .map((o) => ({
      turnoId: o.turnoId,
      fecha: o.fecha,
      horaInicio: minutosAHora(o.horaInicio),
      horaFin: minutosAHora(o.horaFin),
    }))
}

/**
 * Qué se libera al finalizar la hora desde `fechaDesde` (ya validada), contando **todos los tramos
 * del conjunto**:
 * - `cantidad`: las ocurrencias no canceladas (las canceladas ya están libres) desde `fechaDesde`;
 *   `null` si algún tramo no tiene fin.
 * - `desde` = `fechaDesde`; `hasta` = la última ocurrencia del conjunto, o `null` si no tiene fin.
 * - `pagadas`: las pagadas desde `fechaDesde`, de cualquier tramo (definición D),
 *   `ultimaFechaPagada` y `fechaDesdeMinima` (la semana siguiente a la última pagada; `null` si no
 *   hay pagadas o si esa fecha ya pasa el último fin: no queda ninguna fecha para elegir).
 * - `otrasHoras`: ver `otrasHorasDe`.
 */
export function armarPrevia(
  snapshot: SnapshotFinalizacion,
  conjunto: ConjuntoAFinalizar,
  fechaDesde: string,
): PreviaFinalizacion {
  const ids = new Set(conjunto.filas.map((fila) => fila.turnoId))
  const liberadas = snapshot.ocurrencias.filter((o) => ids.has(o.turnoId) && o.fecha >= fechaDesde)
  const { ultimoFin } = conjunto
  const sinFin = ultimoFin === null
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
      siguiente && (ultimoFin === null || siguiente <= ultimoFin) ? siguiente : null,
    otrasHoras: otrasHorasDe(snapshot, conjunto),
  }
}

/**
 * Decide una finalización: `validarFinalizacion` y, si hay ocurrencias pagadas desde `fechaDesde`
 * en cualquier tramo del conjunto, 409 `TURNOS_PAGADOS` con `details`
 * `{ ultimaFechaPagada, fechaDesdeMinima, pagadas }` (no se anulan pagos: hay que elegir una fecha
 * posterior al último pagado). Si no lanza, devuelve la previa (lo que se libera) y los turnos que
 * llevan la finalización: las filas del conjunto con alguna fecha desde `fechaDesde` (`fechaFin`
 * nula o `>= fechaDesde`). Un tramo que termina antes no cambia.
 */
export function planificarFinalizacion(
  snapshot: SnapshotFinalizacion,
  fechaDesde: string,
  fechaHoy: string,
): PlanFinalizacion {
  const conjunto = validarFinalizacion(snapshot, fechaDesde, fechaHoy)
  const previa = armarPrevia(snapshot, conjunto, fechaDesde)
  const { ultimaFechaPagada, fechaDesdeMinima, pagadas } = previa
  if (ultimaFechaPagada !== null) {
    throw new ConflictError(
      fechaDesdeMinima === null
        ? mensajePagadosHastaElFinal(ultimaFechaPagada)
        : mensajeTurnosPagados(ultimaFechaPagada),
      { code: CODIGO_TURNOS_PAGADOS, details: { ultimaFechaPagada, fechaDesdeMinima, pagadas } },
    )
  }
  return {
    previa,
    turnoIds: conjunto.filas
      .filter((fila) => fila.fechaFin === null || fila.fechaFin >= fechaDesde)
      .map((fila) => fila.turnoId),
  }
}
