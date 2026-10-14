import { isValid, parseISO } from 'date-fns'

// El día de la pantalla "Asistencia" en la URL (`?fecha=`). Único lugar que conoce el parámetro.
// "Hoy" sale del navegador, solo para proponer el día: qué es hoy para las reglas lo decide la API.

export const PARAMETRO_FECHA = 'fecha'

const FORMATO = /^\d{4}-\d{2}-\d{2}$/

/**
 * El día de la URL, o `hoy` si no hay, no es una fecha real (`YYYY-MM-DD`) o es posterior a hoy
 * (la pantalla no ofrece fechas futuras; la API igual las rechaza).
 */
export function parsearFechaAsistencia(valor: string | null, hoy: string): string {
  if (!valor || !FORMATO.test(valor) || !isValid(parseISO(valor))) return hoy
  return valor > hoy ? hoy : valor
}

/** Los parámetros con el día elegido; hoy no se escribe. Los demás parámetros se conservan. */
export function paramsDeFecha(
  params: URLSearchParams,
  fecha: string,
  hoy: string,
): URLSearchParams {
  const nuevos = new URLSearchParams(params)
  if (fecha === hoy) nuevos.delete(PARAMETRO_FECHA)
  else nuevos.set(PARAMETRO_FECHA, fecha)
  return nuevos
}
