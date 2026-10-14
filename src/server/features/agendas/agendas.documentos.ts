import type { Prioridad } from '@/server/features/examenes/examenes.condiciones'
import type { EstadoOcurrencia } from '@/server/features/turnos/ocurrencias.condiciones'

// Lo propio del documento PDF de la agenda que no es dibujo: la forma de lo que el service le pasa
// a la plantilla y el nombre de archivo (docs/contrato-api.md → Documentos PDF). `respuestaPdf` lo
// sanea (tildes, espacios, mayúsculas).

/** Una fila del PDF de la agenda: sólo lo que el documento muestra (sin pago, prioridad ni cupo). */
export type TurnoDeAgendaDocumento = {
  turnoId: number
  fecha: string
  horaInicio: string
  horaFin: string
  alumno: { nombre: string; apellido: string }
  profesor: { nombre: string; apellido: string }
  materia: { nombre: string }
  aula: { nombre: string }
  estado: EstadoOcurrencia
}

/**
 * Estado de un turno como lo muestra el PDF de la agenda: igual que las vistas de las agendas
 * (variante "sin asistencia" de la UI, decisión de las PO, T-86). "Agendado" y "Cancelado" como
 * siempre y un turno pasado no cancelado sin estado (`—`), tenga o no asistencia: la asistencia se
 * ve sólo en el detalle del turno. No usa `etiquetaEstado` del motor, que sí distingue "Realizado",
 * "Ausente" y "Sin registrar". Un estado nuevo del motor no compila hasta decidir cómo se ve acá.
 */
const ESTADO_EN_AGENDA: Record<EstadoOcurrencia, string> = {
  AGENDADO: 'Agendado',
  CANCELADO: 'Cancelado',
  SIN_REGISTRAR: '—',
  REALIZADO: '—',
  AUSENTE: '—',
}

/** `'REALIZADO'` → `'—'`; `'AGENDADO'` → `'Agendado'` (ver `ESTADO_EN_AGENDA`). */
export function etiquetaEstadoEnAgenda(estado: EstadoOcurrencia): string {
  return ESTADO_EN_AGENDA[estado]
}

/** Lo que va en el PDF de la agenda diaria de un profesor. */
export type AgendaDocumento = {
  /** El día de la agenda: el pedido o, sin él, hoy. */
  fecha: string
  profesor: { nombre: string; apellido: string }
  /** Se pidieron también las canceladas. */
  incluyeCancelados: boolean
  /** La prioridad por la que se filtró; `null` sin filtro. */
  prioridad: Prioridad | null
  /** Todas las del día, ya filtradas y ordenadas por hora. */
  turnos: TurnoDeAgendaDocumento[]
}

/** `agenda-2026-10-02-cornejo-bautista` (sin extensión). */
export function nombreArchivoAgenda(
  documento: Pick<AgendaDocumento, 'fecha' | 'profesor'>,
): string {
  const { fecha, profesor } = documento
  return `agenda-${fecha}-${profesor.apellido}-${profesor.nombre}`
}
