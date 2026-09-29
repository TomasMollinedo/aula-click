import { ValidationError } from '@/server/errors'
import { fechaADate } from '@/server/shared/fechas'

// Reglas puras de las agendas: el rango de fechas que se puede pedir. Sin Prisma y sin `hoy()`.

/** Días que puede abarcar un rango de agenda, extremos incluidos (decisión T-43). */
export const MAX_DIAS_AGENDA = 31

export const MENSAJE_RANGO_INVERTIDO = '`hasta` no puede ser anterior a `desde`'
export const MENSAJE_RANGO_MAXIMO = `El rango no puede superar los ${MAX_DIAS_AGENDA} días`

const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * El rango `[desde, hasta]` está en orden y no supera `MAX_DIAS_AGENDA` días (extremos incluidos);
 * si no, 400 en `hasta`. Se valida acá y no en el schema porque los dos extremos pueden venir de
 * un default que depende de hoy (`desde` sin mandar es hoy; `hasta` sin mandar es `desde`).
 */
export function validarRangoAgenda(desde: string, hasta: string): void {
  if (hasta < desde) {
    throw new ValidationError(MENSAJE_RANGO_INVERTIDO, {
      details: [{ path: ['hasta'], message: MENSAJE_RANGO_INVERTIDO }],
    })
  }
  const dias = (fechaADate(hasta).getTime() - fechaADate(desde).getTime()) / MS_POR_DIA + 1
  if (dias > MAX_DIAS_AGENDA) {
    throw new ValidationError(MENSAJE_RANGO_MAXIMO, {
      details: [{ path: ['hasta'], message: MENSAJE_RANGO_MAXIMO }],
    })
  }
}
