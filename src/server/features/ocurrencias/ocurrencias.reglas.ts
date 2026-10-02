import { ValidationError } from '@/server/errors'
import { MENSAJES_NO_CANCELABLE } from '@/server/features/cancelaciones/cancelaciones.condiciones'
import { limiteDeCobro } from '@/server/features/pagos/pagos.condiciones'
import type {
  EstadoOcurrencia,
  EstadoPagoOcurrencia,
  TipoTurno,
} from '@/server/features/turnos/ocurrencias.condiciones'

// Reglas puras de `ocurrencias`: sin Prisma y sin `hoy()` (lo recibe quien llama). Las acciones
// miran el pago de la ocurrencia, que ya trae el motor (`Ocurrencia.pago`). Lo que es de otra
// feature no se repite acá: el mensaje de "pagado" es el de `cancelaciones` y el tope de cobro, el
// de `pagos`.

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
/** `motivo`: por qué está deshabilitada (sólo viene cuando se ve y no se puede usar). */
export type AccionCancelar = { visible: boolean; habilitada: boolean; motivo?: string }

export type Acciones = {
  cancelar: AccionCancelar
  finalizar: AccionSimple
  reprogramar: AccionSimple
  registrarPago: AccionSimple
}

/** Las cuatro acciones en `false`/no visibles: lo que ve un `PROFESOR` (sólo lee). */
export const ACCIONES_SIN_PERMISO: Acciones = {
  cancelar: { visible: false, habilitada: false },
  finalizar: { visible: false },
  reprogramar: { visible: false },
  registrarPago: { visible: false },
}

/** Lo que `calcularAcciones` mira de una ocurrencia (una `Ocurrencia` del motor lo cumple). */
export type OcurrenciaParaAcciones = {
  fecha: string
  estado: EstadoOcurrencia
  tipo: TipoTurno
  pago: { estado: EstadoPagoOcurrencia }
}

/**
 * Las acciones permitidas sobre una ocurrencia (T-43):
 * - `cancelar` (HU-13): visible si está agendada (que ya implica hoy o posterior: una ocurrencia
 *   pasada y no cancelada es `SIN_REGISTRAR`, nunca `AGENDADO` — `estadoDeOcurrencia` en
 *   `turnos.reglas.ts`). Si además está pagada, se muestra deshabilitada con el `motivo` con el que
 *   `POST /cancelaciones` la rechazaría (definición D: un turno pagado no se cancela).
 * - `finalizar` (HU-14): recurrente, con su hora vigente y sin finalizar. Se mira el conjunto de
 *   `filasDeLaHora` (todos los tramos de esa hora en su serie), no sólo la fila de la ocurrencia:
 *   un tramo anterior de una hora ya finalizada en un tramo posterior no la ofrece, y la otra hora
 *   de la misma serie sí. Sin filas (quien llama no la necesita), no visible. No mira el pago de
 *   esta ocurrencia: las pagadas de la hora se validan al finalizar (409 `TURNOS_PAGADOS`).
 * - `reprogramar` (HU-20): agendada. Una pagada se reprograma igual: el pago acompaña al turno.
 * - `registrarPago` (HU-15): no cancelada, pago `PENDIENTE` y fecha dentro del tope de cobro
 *   (`limiteDeCobro(hoy)`, el de `POST /pagos`; las pasadas no tienen tope), así no se ofrece algo
 *   que la API rechaza con `FUERA_DE_RANGO`. Una materia sin precio sí lo muestra: decide el 409
 *   `SIN_PRECIO` del cobro.
 */
export function calcularAcciones(
  ocurrencia: OcurrenciaParaAcciones,
  filasDeLaHora: readonly FilaDeLaHora[],
  fechaHoy: string,
): Acciones {
  const agendada = ocurrencia.estado === 'AGENDADO'
  const pagada = ocurrencia.pago.estado === 'PAGADO'
  return {
    cancelar: !agendada
      ? { visible: false, habilitada: false }
      : pagada
        ? { visible: true, habilitada: false, motivo: MENSAJES_NO_CANCELABLE.PAGADO }
        : { visible: true, habilitada: true },
    finalizar: {
      visible:
        ocurrencia.tipo === 'RECURRENTE' &&
        estaVigente(filasDeLaHora, fechaHoy) &&
        !estaFinalizada(filasDeLaHora),
    },
    reprogramar: { visible: agendada },
    registrarPago: {
      visible:
        ocurrencia.estado !== 'CANCELADO' && !pagada && ocurrencia.fecha <= limiteDeCobro(fechaHoy),
    },
  }
}
