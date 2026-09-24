import { horaAMinutos } from '@/server/shared/zod'

// Reglas de negocio puras (sin HTTP ni Prisma): se testean directo.

/**
 * Parte un rango [horaInicio, horaFin) en tramos de una hora exacta (T-17, T-29 de
 * `decisiones.md`: una fila por hora, no una fila que abarque varias). `horaInicio` y `horaFin`
 * ya están validados como horas en punto con `horaFin` posterior a `horaInicio`
 * (`crearBloqueSchema`), así que el rango siempre es múltiplo de 60 minutos.
 */
export function partirEnHoras(
  horaInicio: string,
  horaFin: string,
): { horaInicio: number; horaFin: number }[] {
  const inicio = horaAMinutos(horaInicio)
  const fin = horaAMinutos(horaFin)
  const horas: { horaInicio: number; horaFin: number }[] = []
  for (let minuto = inicio; minuto < fin; minuto += 60) {
    horas.push({ horaInicio: minuto, horaFin: minuto + 60 })
  }
  return horas
}
