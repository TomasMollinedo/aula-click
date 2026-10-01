import { diaSemanaDeFecha, nombreDiaSemana } from '@/utils/dias-semana'
import { fechaConDia, fechaCorta } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'
import { formatearPesos } from '@/utils/moneda'

import type {
  FinalizacionCreada,
  PreviaFinalizacion,
  TramoPosterior,
  TurnoPagado,
} from './finalizaciones.types'

// Presentación de la finalización: el resumen de la previa, los avisos y el mensaje de éxito, como
// los pide la HU. Sin reglas: qué se libera, qué turnos están pagados y desde qué fecha se puede
// finalizar lo dice la API. Los turnos pagados sólo se informan (definición D de las PO).

type TurnoAFinalizar = {
  fecha: string
  horaInicio: string
  horaFin: string
  materia: { nombre: string }
  alumno: { nombre: string; apellido: string }
}

/** `'Matemática de Lucía González, los lunes de 9:00 a 10:00'`. El día sale de la ocurrencia. */
export function resumenTurno(o: TurnoAFinalizar): string {
  const dia = nombreDiaSemana(diaSemanaDeFecha(o.fecha)).toLowerCase()
  return `${o.materia.nombre} de ${o.alumno.nombre} ${o.alumno.apellido}, los ${dia} de ${rangoHoras(o.horaInicio, o.horaFin)}`
}

/** `'del 19/10 al 30/11'`, o `'el 19/10'` si es una sola fecha. */
function rango(desde: string, hasta: string): string {
  return desde === hasta
    ? `el ${fechaCorta(desde)}`
    : `del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`
}

/**
 * Qué se libera si se finaliza desde esa fecha: `'Se liberan 7 turnos, del 19/10 al 30/11'`,
 * `'Se libera 1 turno, el 19/10'` o, en una serie sin fin, `'Se liberan todos los turnos desde el
 * 19/10'`. Con `cantidad: 0` (todas las fechas que quedaban ya estaban canceladas) no se libera
 * ninguno, pero la serie termina igual.
 */
export function resumenPrevia({
  cantidad,
  desde,
  hasta,
}: Pick<PreviaFinalizacion, 'cantidad' | 'desde' | 'hasta'>): string {
  if (hasta === null || cantidad === null) {
    return `Se liberan todos los turnos desde el ${fechaCorta(desde)}`
  }
  if (cantidad === 0) {
    const cancelados =
      desde === hasta
        ? `el del ${fechaCorta(desde)} ya está cancelado`
        : `los ${rango(desde, hasta)} ya están cancelados`
    return `No se libera ningún turno: ${cancelados}. La serie termina igual desde el ${fechaCorta(desde)}`
  }
  return cantidad === 1
    ? `Se libera 1 turno, ${rango(desde, hasta)}`
    : `Se liberan ${cantidad} turnos, ${rango(desde, hasta)}`
}

/** `'lunes 16/11 de 9:00 a 10:00 · $ 7.500,00'`. */
export function lineaPagado(p: TurnoPagado): string {
  return `${fechaConDia(p.fecha)} de ${rangoHoras(p.horaInicio, p.horaFin)} · ${formatearPesos(p.importe)}`
}

/**
 * Qué hacer cuando hay turnos pagados desde la fecha elegida. Con `fechaDesdeMinima: null` los
 * pagados llegan hasta el final de la serie y no queda fecha para elegir.
 */
export function avisoPagados({
  ultimaFechaPagada,
  fechaDesdeMinima,
}: {
  ultimaFechaPagada: string
  fechaDesdeMinima: string | null
}): string {
  return fechaDesdeMinima === null
    ? `Los turnos pagados llegan hasta el final de la serie (${fechaCorta(ultimaFechaPagada)}): no se puede finalizar`
    : `Elegí una fecha posterior al último turno pagado (${fechaCorta(ultimaFechaPagada)})`
}

/** Texto del botón que pone en el calendario la primera fecha que se puede elegir. */
export function textoUsarFecha(fecha: string): string {
  return `Usar el ${fechaCorta(fecha)}`
}

/** `'del 14/12 al 28/12'` o `'desde el 14/12, sin fecha de fin'`. */
export function textoTramo(t: TramoPosterior): string {
  return t.fechaFin === null
    ? `desde el ${fechaCorta(t.fechaInicio)}, sin fecha de fin`
    : rango(t.fechaInicio, t.fechaFin)
}

/** Aviso de los tramos posteriores de la misma hora y materia, que no se finalizan con este. */
export function avisoOtrosTramos(tramos: readonly TramoPosterior[]): string {
  if (tramos.length === 1) {
    return `El alumno tiene otro tramo posterior de la misma hora y materia (${textoTramo(tramos[0])}). No se finaliza con este: se finaliza desde su propio detalle.`
  }
  const lista = tramos.map(textoTramo).join('; ')
  return `El alumno tiene ${tramos.length} tramos posteriores de la misma hora y materia (${lista}). No se finalizan con este: cada uno se finaliza desde su propio detalle.`
}

/** Mensaje del toast cuando la API confirma. */
export function mensajeFinalizado({
  cantidad,
  desde,
}: Pick<FinalizacionCreada, 'cantidad' | 'desde'>): string {
  const base = `Turno finalizado desde el ${fechaCorta(desde)}.`
  if (cantidad === null) return `${base} Los lugares quedaron disponibles.`
  if (cantidad === 0) return base
  return cantidad === 1 ? `${base} Se liberó 1 turno.` : `${base} Se liberaron ${cantidad} turnos.`
}
