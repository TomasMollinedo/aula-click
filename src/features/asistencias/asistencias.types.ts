import type { EstadoOcurrencia } from '@/types/ocurrencia'

// Tipos de la API de asistencias (docs/contrato-api.md → Asistencias; OpenAPI de
// /api/v1/asistencias). Fechas: `YYYY-MM-DD`. Horas: `HH:mm`.

export type EstadoAsistencia = 'PRESENTE' | 'AUSENTE'

/** Plazo para registrar o corregir: último día (`vence`) y si ya pasó. Lo calcula la API. */
export type PlazoAsistencia = { vence: string; vencido: boolean }

export type AsistenciaRegistrada = {
  estado: EstadoAsistencia
  trabajado: string | null
  indicaciones: string | null
  observacion: string | null
}

/** Una hora de una fila, con su propio estado y su asistencia (`null` si no se registró). */
export type HoraAsistencia = {
  turnoId: number
  fecha: string
  horaInicio: string
  horaFin: string
  estado: EstadoOcurrencia
  asistencia: AsistenciaRegistrada | null
}

/** Una fila de la pantalla: las horas seguidas de un alumno. */
export type FilaAsistencia = {
  alumno: { id: number; apellido: string; nombre: string; fotoUrl: string | null }
  materia: { id: number; nombre: string }
  temas: string | null
  horaInicio: string
  horaFin: string
  horas: number
  ocurrencias: HoraAsistencia[]
  indicacionesAnteriores: { fecha: string; indicaciones: string } | null
}

/** Una hora de un bloque del profesor, con las filas que empiezan en ella. */
export type ClaseAsistencia = {
  bloqueAgendaId: number
  horaInicio: string
  horaFin: string
  aula: { id: number; nombre: string }
  filas: FilaAsistencia[]
}

/** `GET /asistencias?fecha`. */
export type AsistenciasDelDia = {
  fecha: string
  plazo: PlazoAsistencia
  /** El plazo no venció: se puede registrar y corregir. */
  editable: boolean
  clases: ClaseAsistencia[]
}

/** `GET /asistencias/pendientes`. */
export type AsistenciasPendientes = {
  cantidad: number
  masAntiguo: { fecha: string; vence: string } | null
}

/** Un registro del `PUT /asistencias`: una fila, o una hora con "Ajustar por hora". */
export type RegistroAsistencia = {
  ocurrencias: { turnoId: number; fecha: string }[]
  estado: EstadoAsistencia
  trabajado?: string | null
  indicaciones?: string | null
  observacion?: string | null
}

export type RegistrarAsistencias = { registros: RegistroAsistencia[] }

/** Respuesta del `PUT /asistencias`: las filas registradas, con la forma del `GET`. */
export type AsistenciasRegistradas = { filas: FilaAsistencia[] }
