import { addDays, addMonths, format, getISODay, parseISO, startOfMonth } from 'date-fns'

// Grilla de un calendario mensual y qué días se pueden elegir (la usa `CalendarioFecha` de
// components/ui). Todo con fechas `YYYY-MM-DD` (docs/arquitectura-frontend.md → Fechas y horas):
// `parseISO` las lee como hora local, nunca `new Date('YYYY-MM-DD')`. Es una restricción de la UI,
// no una regla: quien usa el calendario valida igual (por ejemplo, la API).

/** Qué días se pueden elegir. */
export type RestriccionFechas = {
  /** Primera fecha elegible (`YYYY-MM-DD`), o sin mínimo. */
  min?: string
  /** Solo ese día de la semana (ISO: 1 = lunes … 7 = domingo), o todos. */
  diaSemana?: number
}

const FORMATO = 'yyyy-MM-dd'

/** El día se puede elegir según la restricción. */
export function esFechaHabilitada(fecha: string, { min, diaSemana }: RestriccionFechas): boolean {
  // `YYYY-MM-DD`: la comparación de textos es la de fechas.
  if (min !== undefined && fecha < min) return false
  return diaSemana === undefined || getISODay(parseISO(fecha)) === diaSemana
}

/** Primer día del mes de `fecha`, como `YYYY-MM-01`. */
export function inicioDeMes(fecha: string): string {
  return format(startOfMonth(parseISO(fecha)), FORMATO)
}

/** El primer día del mes `meses` después (o antes, si es negativo) del de `mes`. */
export function sumarMeses(mes: string, meses: number): string {
  return format(startOfMonth(addMonths(parseISO(mes), meses)), FORMATO)
}

/** `fecha` más `dias` días (negativo: antes). */
export function sumarDias(fecha: string, dias: number): string {
  return format(addDays(parseISO(fecha), dias), FORMATO)
}

/**
 * Las semanas del mes de `mes` (lunes a domingo, como la semana ISO): cada celda es una fecha del
 * mes o `null` si cae en el mes anterior o el siguiente.
 */
export function semanasDelMes(mes: string): (string | null)[][] {
  const inicio = parseISO(inicioDeMes(mes))
  const vacias = getISODay(inicio) - 1
  const celdas: (string | null)[] = Array.from({ length: vacias }, () => null)
  for (let dia = inicio; dia.getMonth() === inicio.getMonth(); dia = addDays(dia, 1)) {
    celdas.push(format(dia, FORMATO))
  }
  while (celdas.length % 7 !== 0) celdas.push(null)
  return Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7))
}

/**
 * La próxima fecha elegible desde `fecha` moviéndose de a `paso` días (positivo o negativo), sin
 * pasar de `limite` días recorridos. `null` si no hay ninguna.
 */
export function siguienteHabilitada(
  fecha: string,
  paso: number,
  restriccion: RestriccionFechas,
  limite = 366,
): string | null {
  for (let recorrido = paso; Math.abs(recorrido) <= limite; recorrido += paso) {
    const candidata = sumarDias(fecha, recorrido)
    if (esFechaHabilitada(candidata, restriccion)) return candidata
  }
  return null
}

/** La primera fecha elegible del mes de `mes`, o `null` si no hay ninguna. */
export function primeraHabilitadaDelMes(
  mes: string,
  restriccion: RestriccionFechas,
): string | null {
  return (
    semanasDelMes(mes)
      .flat()
      .find((fecha): fecha is string => fecha !== null && esFechaHabilitada(fecha, restriccion)) ??
    null
  )
}
