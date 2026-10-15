import type { FechasSinTurno, TipoTurno } from './turnos.types'

// Tipos de "Sacar turno" del portal del alumno (docs/contrato-api.md → Turnos → Sacar un turno
// desde el portal), escritos a mano (D-07). Ningún endpoint recibe `alumnoId`: el alumno sale de la
// sesión. Fechas: string `YYYY-MM-DD`. Horas: string `HH:mm`. Día de la semana: entero ISO.

type PersonaResumen = { id: number; nombre: string; apellido: string }
type Referencia = { id: number; nombre: string }

/** `GET /turnos/mis-turnos/habilitacion`: si puede sacar un turno (deuda vencida, HU-29). */
export type Habilitacion = {
  habilitado: boolean
  /** Con deuda vencida, su cantidad de turnos y su total; si no, `null`. */
  deuda: { cantidad: number; total: number } | null
}

/** `GET /turnos/mis-turnos/materias`: las materias que se pueden elegir en el paso 1. */
export type MateriaOfertada = Referencia

/** Parámetros de `GET /turnos/mis-turnos/disponibilidad` (los mismos que la búsqueda de la mesa). */
export type MiDisponibilidadParams = {
  materiaId: number
  diaSemana?: number
  profesorId?: number
  fecha?: string
}

/** Una hora de un resultado: sólo si se puede elegir, sin cupos ni ocupación. */
export type HoraOfertada = {
  bloqueId: number
  horaInicio: string
  horaFin: string
  disponible: boolean
}

/** Horas contiguas del mismo profesor, día y aula, con el valor por clase de la materia. */
export type BloqueOfertado = {
  profesor: PersonaResumen
  diaSemana: number
  /** La fecha de la disponibilidad: la pedida o la próxima del día, desde mañana. */
  fecha: string
  aula: Referencia
  horaInicio: string
  horaFin: string
  /** Precio por hora vigente de la materia (HU-12), o `null` si no tiene. */
  valorPorClase: number | null
  horas: HoraOfertada[]
}

/** Body de `POST /turnos/mis-turnos`: el de la mesa sin `alumnoId` ni `observaciones`. */
export type MiTurnoCrear = {
  materiaId: number
  bloqueIds: number[]
  tipo: TipoTurno
  fechaInicio: string
  /** `RECURRENTE`: última fecha, o `null` si no tiene fin. `SESION_UNICA`: no se manda. */
  fechaFin?: string | null
  /** "¿Qué querés trabajar en la clase?": obligatorio en `SESION_UNICA`. */
  temas?: string
  asignarDondeHayLugar?: boolean
}

/** Un turno creado (una hora y un tramo de fechas), en el resumen de "Turno reservado". */
export type MiTurnoCreado = {
  id: number
  bloqueId: number
  horaInicio: string
  horaFin: string
  fechaInicio: string
  /** `null` en un recurrente sin fin. */
  fechaFin: string | null
}

/** Respuesta 201 de `POST /turnos/mis-turnos`: el resumen de "Turno reservado". */
export type MiTurnoReservado = {
  cantidad: number
  tipo: TipoTurno
  diaSemana: number
  materia: Referencia
  profesor: PersonaResumen
  aula: Referencia
  temas: string | null
  turnos: MiTurnoCreado[]
  fechasSinTurno: FechasSinTurno[]
}
