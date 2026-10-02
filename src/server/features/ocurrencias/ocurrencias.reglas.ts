import { ValidationError } from '@/server/errors'
import type { EstadoOcurrencia, TipoTurno } from '@/server/features/turnos/ocurrencias.condiciones'

// Reglas puras de `ocurrencias`: sin Prisma y sin `hoy()` (lo recibe quien llama). El estado de
// pago **no se evalúa acá** (a pedido explícito: hoy no hay de dónde traer los datos de `Pago`).
// Por eso "cancelar" y "registrarPago" no miran si la ocurrencia está pagada ni pendiente, aunque
// el ticket original (T-43) lo pida: es una simplificación consciente, no un olvido.

export const MENSAJE_RANGO_INVERTIDO = '`hasta` no puede ser anterior a `desde`'
export const MENSAJE_FUERA_DE_VENTANA = 'El rango tiene que estar dentro del año en curso'

/**
 * Ventana permitida de `GET /ocurrencias` (T-43, acotada al año en curso por T-66: antes era un
 * rango relativo a hoy, 30 días atrás / 56 adelante): cualquier fecha entre el 1 de enero y el 31
 * de diciembre del año de `fechaHoy`. Los valores por defecto (sin `desde`/`hasta`) son también los
 * bordes de la ventana, como antes.
 */
export function ventanaOcurrencias(fechaHoy: string): { desde: string; hasta: string } {
  const anio = fechaHoy.slice(0, 4)
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` }
}

/**
 * El rango pedido está en orden y dentro de la ventana permitida (ver `ventanaOcurrencias`); si
 * no, 400 en `hasta` (mismo criterio que `validarRangoAgenda`: el default depende de `hoy`, así
 * que se valida acá y no en el schema).
 */
export function validarRangoOcurrencias(desde: string, hasta: string, fechaHoy: string): void {
  if (hasta < desde) {
    throw new ValidationError(MENSAJE_RANGO_INVERTIDO, {
      details: [{ path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO }],
    })
  }
  const ventana = ventanaOcurrencias(fechaHoy)
  if (desde < ventana.desde || hasta > ventana.hasta) {
    throw new ValidationError(MENSAJE_FUERA_DE_VENTANA, {
      details: [{ path: ['hasta'], message: MENSAJE_FUERA_DE_VENTANA }],
    })
  }
}

/**
 * Una fila de la serie del turno que es de su **misma hora** (`serieId` y `bloqueAgendaId`,
 * decisión T-103): el propio turno y sus otros tramos. Es el conjunto sobre el que actúa
 * "Finalizar" (decisión T-104). Sin el resto de la fila: sólo lo que mira `calcularAcciones`.
 */
export type FilaDeLaHora = {
  /** La guardada (finalizar no la modifica); `null` = sin fin. */
  fechaFin: string | null
  /** Tiene una `FinalizacionRecurrencia`. */
  finalizada: boolean
}

/** Alguna fila de la hora tiene finalización: la hora ya se finalizó, desde cualquier tramo. */
function estaFinalizada(filas: readonly FilaDeLaHora[]): boolean {
  return filas.some((fila) => fila.finalizada)
}

/**
 * La hora sigue vigente si alguna de sus filas no tiene `fechaFin` o no pasó todavía: el mismo
 * criterio con el que `POST /finalizaciones` acepta el pedido (decisión T-75), así que si el botón
 * se ve, el POST no rechaza por "no vigente".
 */
function estaVigente(filas: readonly FilaDeLaHora[], fechaHoy: string): boolean {
  return filas.some((fila) => fila.fechaFin === null || fila.fechaFin >= fechaHoy)
}

export type AccionSimple = { visible: boolean }
export type AccionCancelar = { visible: boolean; habilitada: boolean }

export type Acciones = {
  cancelar: AccionCancelar
  finalizar: AccionSimple
  reprogramar: AccionSimple
  registrarPago: AccionSimple
}

/** Las cuatro acciones en `false`/no visibles: lo que ve un `PROFESOR` que no es dueño del turno. */
export const ACCIONES_SIN_PERMISO: Acciones = {
  cancelar: { visible: false, habilitada: false },
  finalizar: { visible: false },
  reprogramar: { visible: false },
  registrarPago: { visible: false },
}

/**
 * Las acciones permitidas sobre una ocurrencia (T-43), sin mirar el pago (ver el comentario de
 * arriba del archivo):
 * - `cancelar`: agendada (que ya implica hoy o posterior: una ocurrencia pasada y no cancelada es
 *   `SIN_REGISTRAR`, nunca `AGENDADO` — `estadoDeOcurrencia` en `turnos.reglas.ts`).
 * - `finalizar`: recurrente, con su hora vigente y sin finalizar. Se mira el conjunto de
 *   `filasDeLaHora` (todos los tramos de esa hora en su serie), no sólo la fila de la ocurrencia:
 *   un tramo anterior de una hora ya finalizada en un tramo posterior no la ofrece, y la otra hora
 *   de la misma serie sí. Sin filas (quien llama no la necesita), no visible.
 * - `reprogramar`: agendada, mismo criterio que cancelar.
 * - `registrarPago`: no cancelada.
 */
export function calcularAcciones(
  ocurrencia: { estado: EstadoOcurrencia; tipo: TipoTurno },
  filasDeLaHora: readonly FilaDeLaHora[],
  fechaHoy: string,
): Acciones {
  const agendada = ocurrencia.estado === 'AGENDADO'
  return {
    cancelar: { visible: agendada, habilitada: agendada },
    finalizar: {
      visible:
        ocurrencia.tipo === 'RECURRENTE' &&
        estaVigente(filasDeLaHora, fechaHoy) &&
        !estaFinalizada(filasDeLaHora),
    },
    reprogramar: { visible: agendada },
    registrarPago: { visible: ocurrencia.estado !== 'CANCELADO' },
  }
}
