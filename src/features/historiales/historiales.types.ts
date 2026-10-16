import type { EstadoTurno, PlazoAsistencia } from '@/components/turno/indicadores-turno'
import type { MotivoCancelacion } from '@/types/ocurrencia'

// Tipos de lo que devuelve la API de historiales (docs/contrato-api.md → Historiales; HU-31, T-108),
// escritos a mano (D-07): el frontend no importa los schemas del servidor. Fechas: string
// `YYYY-MM-DD`. Horas: string `HH:mm`. El estado, el plazo, el porcentaje y qué textos van una sola
// vez los decide la API: la pantalla sólo los pinta.

/** "Qué se trabajó" e "Indicaciones para la próxima sesión" de una clase presente. */
export type TextosDelHistorial = { trabajado: string | null; indicaciones: string | null }

/**
 * Una **clase**: una hora, con su propio estado. `turnoId` y `fecha` son los del detalle del turno
 * (`?detalle=&fecha=`). `textosPropios` sólo viene si difieren de los `textos` del bloque.
 */
export type ClaseDelHistorial = {
  turnoId: number
  fecha: string
  horaInicio: string
  horaFin: string
  estado: EstadoTurno
  plazoAsistencia: PlazoAsistencia | null
  /** Un "Sin registrar" con el plazo vencido. Lo distingue el badge con `plazo.vencido`. */
  cerradaPorSistema: boolean
  textosPropios: TextosDelHistorial | null
  /** La de la ausencia, o la del cierre del sistema. */
  observacion: string | null
  cancelacion: { motivo: MotivoCancelacion; detalle: string | null } | null
}

/**
 * Un **bloque**: las horas seguidas de un día, con los textos una sola vez (`null` si ninguna
 * clase está presente). `horas` es la cantidad de clases del bloque. Vienen de la fecha más
 * reciente a la más antigua.
 */
export type BloqueDelHistorial = {
  fecha: string
  horaInicio: string
  horaFin: string
  horas: number
  textos: TextosDelHistorial | null
  clases: ClaseDelHistorial[]
}

/** Clases realizadas, ausencias y porcentaje de asistencia, calculados por la API. */
export type ResumenDelHistorial = { realizadas: number; ausencias: number; porcentaje: number }

/** Un grupo: una materia con un profesor ("Matemática — Prof. Pérez"). */
export type GrupoDelHistorial = {
  materia: { id: number; nombre: string }
  profesor: { id: number; nombre: string; apellido: string }
  resumen: ResumenDelHistorial
  bloques: BloqueDelHistorial[]
}

/**
 * Materias y profesores del historial **completo** del alumno (no del período filtrado): con eso
 * se llenan los selects de los filtros, que no se quedan sin opciones al elegir un mes sin clases.
 */
export type OpcionesDelHistorial = {
  materias: { id: number; nombre: string }[]
  profesores: { id: number; nombre: string; apellido: string }[]
}

/** `GET /historiales/alumnos/{alumnoId}`. `desde` y `hasta` son los del período pedido. */
export type HistorialDelAlumno = {
  alumno: { id: number; nombre: string; apellido: string; dni: string }
  desde: string
  hasta: string
  grupos: GrupoDelHistorial[]
  opciones: OpcionesDelHistorial
}

/** El query de la API: `desde` y `hasta` siempre; materia y profesor sólo si están puestos. */
export type HistorialParams = {
  desde: string
  hasta: string
  materiaId?: number
  profesorId?: number
}

/**
 * Una materia de "Mis materias" (`GET /historiales/mis-materias`, HU-33): el próximo turno no
 * cancelado (`null` si no tiene) y el porcentaje de asistencia de todo su historial, de la API.
 */
export type MateriaDelPortal = {
  materia: { id: number; nombre: string }
  profesor: { id: number; nombre: string; apellido: string }
  proximoTurno: { fecha: string; horaInicio: string; horaFin: string } | null
  porcentaje: number
}

/**
 * Una clase del historial del portal: sin plazo, cierre del sistema, observación ni cancelación
 * (el alumno no los ve). "Realizado", "Ausente", "Cancelado" y "Sin registrar" (que no cuenta para
 * el porcentaje); la API omite las agendadas (decisión T-169).
 */
export type ClaseDelPortal = Pick<
  ClaseDelHistorial,
  'turnoId' | 'fecha' | 'horaInicio' | 'horaFin' | 'estado' | 'textosPropios'
>

/** Un bloque del portal. `horas` es el total del bloque: puede ser mayor que `clases.length`. */
export type BloqueDelPortal = Omit<BloqueDelHistorial, 'clases'> & { clases: ClaseDelPortal[] }

/** `GET /historiales/mis-materias/{materiaId}/{profesorId}?mes` (HU-33). */
export type MiHistorialDeMateria = {
  materia: { id: number; nombre: string }
  profesor: { id: number; nombre: string; apellido: string }
  /** `AAAA-MM`. */
  mes: string
  /** Las de la última clase realizada con indicaciones, de cualquier mes. */
  indicacionesProximaClase: { fecha: string; indicaciones: string } | null
  resumen: ResumenDelHistorial
  bloques: BloqueDelPortal[]
}
