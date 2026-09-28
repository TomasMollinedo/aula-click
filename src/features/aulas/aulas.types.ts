/** Ítem del selector de aulas disponibles (`GET /api/v1/aulas/disponibles`). */
export type AulaDisponible = {
  id: number
  nombre: string
  capacidad: number
}

/**
 * Horario para el que se piden las aulas libres: día ISO (1 = lunes … 7 = domingo) y rango de horas
 * `HH:mm` en punto. `excluirBloqueId` es para la edición: esa fila no ocupa su aula.
 */
export type AulasDisponiblesParams = {
  diaSemana: number
  horaInicio: string
  horaFin: string
  excluirBloqueId?: number
}
