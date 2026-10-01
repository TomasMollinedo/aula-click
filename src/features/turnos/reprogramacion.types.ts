// Tipos de la API de reprogramaciones (docs/contrato-api.md → Reprogramaciones), escritos a mano
// (D-07). Fechas: string `YYYY-MM-DD`.

/** Body de `POST /reprogramaciones`: la ocurrencia que se mueve y la hora y fecha de destino. */
export type ReprogramarTurnoBody = {
  turnoId: number
  /** La fecha de la ocurrencia (no la del turno). */
  fecha: string
  /** La hora de destino: `bloqueId` de una hora de la disponibilidad. */
  bloqueAgendaDestinoId: number
  fechaDestino: string
}

export type ReprogramacionCreada = {
  /**
   * El turno de la fecha movida: el mismo si era una sesión única; si era una fecha de un
   * recurrente, la sesión única nueva. El detalle se vuelve a pedir con este id y `fechaDestino`.
   */
  turnoId: number
  /** Texto del cambio armado por la API. */
  cambio: string
}
