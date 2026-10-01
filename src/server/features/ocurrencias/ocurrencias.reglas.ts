import { ValidationError } from '@/server/errors'
import { MENSAJES_NO_CANCELABLE } from '@/server/features/cancelaciones/cancelaciones.condiciones'
import { limiteDeCobro } from '@/server/features/pagos/pagos.condiciones'
import { fechaADate } from '@/server/shared/fechas'
import type {
  EstadoOcurrencia,
  EstadoPagoOcurrencia,
  TipoTurno,
} from '@/server/features/turnos/ocurrencias.condiciones'

// Reglas puras de `ocurrencias`: sin Prisma y sin `hoy()` (lo recibe quien llama). Las acciones
// miran el pago de la ocurrencia, que ya trae el motor (`Ocurrencia.pago`). Lo que es de otra
// feature no se repite acá: el mensaje de "pagado" es el de `cancelaciones` y el tope de cobro, el
// de `pagos`.

/** Días hacia atrás y hacia adelante del rango por defecto de `GET /ocurrencias` (T-43). */
export const DIAS_ATRAS_POR_DEFECTO = 30
export const DIAS_ADELANTE_POR_DEFECTO = 56

export const MENSAJE_RANGO_INVERTIDO = '`hasta` no puede ser anterior a `desde`'
export const MENSAJE_FUERA_DE_VENTANA = `El rango no puede exceder ${DIAS_ATRAS_POR_DEFECTO} días atrás ni ${DIAS_ADELANTE_POR_DEFECTO} días adelante de hoy`

const MS_POR_DIA = 24 * 60 * 60 * 1000

function sumarDias(fecha: string, dias: number): string {
  const fecha2 = new Date(fechaADate(fecha).getTime() + dias * MS_POR_DIA)
  return fecha2.toISOString().slice(0, 10)
}

/**
 * Ventana permitida de `GET /ocurrencias` (definición del ticket: "por defecto desde 30 días
 * atrás hasta 8 semanas adelante, rango máximo acotado, como las agendas"): los valores por
 * defecto son también los bordes de la ventana — no hay un tercer número de tope escrito en
 * ningún lado, así que se toma la ventana descripta como el máximo permitido.
 */
export function ventanaOcurrencias(fechaHoy: string): { desde: string; hasta: string } {
  return {
    desde: sumarDias(fechaHoy, -DIAS_ATRAS_POR_DEFECTO),
    hasta: sumarDias(fechaHoy, DIAS_ADELANTE_POR_DEFECTO),
  }
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

/** Datos de la serie que necesita `calcularAcciones`, sin el resto de la `Ocurrencia`. */
export type SerieParaAcciones = {
  fechaFin: string | null
  finEfectivo: string | null
}

/**
 * La serie ya tiene una `FinalizacionRecurrencia` aplicada: su fin efectivo quedó por debajo de
 * `fechaFin` (`finEfectivo` la única cuenta que los distingue — T-30). Sin finalización, son
 * iguales (los dos `null`, o los dos la misma fecha).
 */
function estaFinalizada(serie: SerieParaAcciones): boolean {
  return serie.finEfectivo !== serie.fechaFin
}

/** Una serie recurrente sigue vigente si no tiene fin efectivo o si ese fin no pasó todavía. */
function estaVigente(serie: SerieParaAcciones, fechaHoy: string): boolean {
  return serie.finEfectivo === null || serie.finEfectivo >= fechaHoy
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
  serie: SerieParaAcciones
  pago: { estado: EstadoPagoOcurrencia }
}

/**
 * Las acciones permitidas sobre una ocurrencia (T-43):
 * - `cancelar` (HU-13): visible si está agendada (que ya implica hoy o posterior: una ocurrencia
 *   pasada y no cancelada es `SIN_REGISTRAR`, nunca `AGENDADO` — `estadoDeOcurrencia` en
 *   `turnos.reglas.ts`). Si además está pagada, se muestra deshabilitada con el `motivo` con el que
 *   `POST /cancelaciones` la rechazaría (definición D: un turno pagado no se cancela).
 * - `finalizar` (HU-14): recurrente, vigente y sin una finalización ya aplicada. No mira el pago de
 *   esta ocurrencia: las pagadas de la serie se validan al finalizar (409 `TURNOS_PAGADOS`).
 * - `reprogramar` (HU-20): agendada. Una pagada se reprograma igual: el pago acompaña al turno.
 * - `registrarPago` (HU-15): no cancelada, pago `PENDIENTE` y fecha dentro del tope de cobro
 *   (`limiteDeCobro(hoy)`, el de `POST /pagos`; las pasadas no tienen tope), así no se ofrece algo
 *   que la API rechaza con `FUERA_DE_RANGO`. Una materia sin precio sí lo muestra: decide el 409
 *   `SIN_PRECIO` del cobro.
 */
export function calcularAcciones(ocurrencia: OcurrenciaParaAcciones, fechaHoy: string): Acciones {
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
        estaVigente(ocurrencia.serie, fechaHoy) &&
        !estaFinalizada(ocurrencia.serie),
    },
    reprogramar: { visible: agendada },
    registrarPago: {
      visible:
        ocurrencia.estado !== 'CANCELADO' && !pagada && ocurrencia.fecha <= limiteDeCobro(fechaHoy),
    },
  }
}
