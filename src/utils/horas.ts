// Horas `HH:mm` para mostrar (docs/arquitectura-frontend.md → Fechas y horas). Solo presentación:
// el frontend no las convierte a minutos. Las usan el horario de los profesores y los turnos.

/** `HH:mm` para mostrar, sin el cero adelante de la hora (`'08:00'` → `'8:00'`). */
export function horaCorta(hora: string): string {
  return hora.replace(/^0(\d)/, '$1')
}

/** Rango para mostrar: `'8:00 a 12:00'`. */
export function rangoHoras(horaInicio: string, horaFin: string): string {
  return `${horaCorta(horaInicio)} a ${horaCorta(horaFin)}`
}
