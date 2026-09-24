// Días de la semana en formato ISO, como viajan en la API (docs/contrato-api.md → Formatos):
// 1 = lunes … 7 = domingo. Los usan el horario de los profesores, los turnos y las agendas.

export const DIAS_SEMANA = [
  { dia: 1, nombre: 'Lunes' },
  { dia: 2, nombre: 'Martes' },
  { dia: 3, nombre: 'Miércoles' },
  { dia: 4, nombre: 'Jueves' },
  { dia: 5, nombre: 'Viernes' },
  { dia: 6, nombre: 'Sábado' },
  { dia: 7, nombre: 'Domingo' },
] as const

/**
 * Nombre del día ISO, con mayúscula inicial (`nombreDiaSemana(1)` → `'Lunes'`). Lanza
 * `RangeError` si no es un entero de 1 a 7.
 */
export function nombreDiaSemana(dia: number): string {
  const encontrado = DIAS_SEMANA.find((d) => d.dia === dia)
  if (!encontrado) throw new RangeError(`Día de la semana inválido: ${dia} (se espera 1 a 7)`)
  return encontrado.nombre
}
