import type {
  AsistenciaDeOcurrencia,
  AsistenciaDelPortal,
  EstadoOcurrencia,
  HoraSeguida,
  HorasSeguidas,
  PlazoAsistenciaOcurrencia,
  TextosAsistencia,
  UsuarioAuditoriaConRol,
} from '@/types/ocurrencia'
import { formatoInstante, nombreUsuarioAuditoria } from '@/utils/auditoria'
import { fechaCorta } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'

// Qué muestra la sección "Asistencia" del detalle de un turno (el del personal y el del portal).
// Funciones puras, sin reglas de negocio: el estado, el plazo, el cierre y qué textos van una sola
// vez o aparte los decide la API (T-84); acá solo se traducen a líneas de texto. Ninguna compara
// textos ni calcula fechas.

/** Etiqueta y texto de un dato de la asistencia (`['Qué se trabajó', 'Fracciones']`). */
export type TextoAsistencia = [etiqueta: string, texto: string]

/**
 * La asistencia tal como la reciben las piezas de la sección: la del personal o la del portal, que
 * no trae observación ni auditoría.
 */
export type AsistenciaVisible = AsistenciaDelPortal &
  Partial<
    Pick<
      AsistenciaDeOcurrencia,
      'observacion' | 'registradaPor' | 'registradaEl' | 'modificadaPor' | 'modificadaEl'
    >
  >

/** Una hora de las horas seguidas: la del portal no trae `registrable` ni `observacion`. */
export type HoraSeguidaVisible = Omit<HoraSeguida, 'registrable' | 'observacion'> & {
  observacion?: string | null
}

export type HorasSeguidasVisibles = Omit<HorasSeguidas, 'ocurrencias'> & {
  ocurrencias: HoraSeguidaVisible[]
}

const TRABAJADO = 'Qué se trabajó'
const INDICACIONES = 'Indicaciones para la próxima sesión'
const OBSERVACION = 'Observación'

/** Solo los que tienen texto. */
function conTexto(textos: [string, string | null | undefined][]): TextoAsistencia[] {
  return textos.filter((t): t is TextoAsistencia => Boolean(t[1]))
}

/** "Qué se trabajó" e indicaciones, los que tengan texto. */
export function textosDeTrabajo(textos: TextosAsistencia | null): TextoAsistencia[] {
  if (!textos) return []
  return conTexto([
    [TRABAJADO, textos.trabajado],
    [INDICACIONES, textos.indicaciones],
  ])
}

/**
 * Hay sección "Asistencia" si la API manda algo de ella: una agendada a futuro o una cancelada no
 * traen asistencia, plazo ni horas seguidas.
 */
export function mostrarSeccionAsistencia(datos: {
  asistencia: unknown
  plazoAsistencia: unknown
  horasSeguidas: unknown
}): boolean {
  return datos.asistencia !== null || datos.plazoAsistencia !== null || datos.horasSeguidas !== null
}

/** `'Cerrado por el sistema el 12/10'`: la fecha es `plazoAsistencia.vence`, de la API. */
export function textoCierreSistema(plazo: PlazoAsistenciaOcurrencia | null): string {
  return plazo ? `Cerrado por el sistema el ${fechaCorta(plazo.vence)}` : 'Cerrado por el sistema'
}

/** Lo que se muestra de la asistencia de esa hora, debajo de su estado. */
export type VistaAsistenciaHora = {
  /** `'Cerrado por el sistema el 12/10'`, solo si la cerró el sistema. */
  cierre: string | null
  /** Qué se trabajó e indicaciones (presente) u observación (ausente o cierre). */
  textos: TextoAsistencia[]
  /** `'Registrada por Ana Pérez, 05/10/2026, 09:10'` y la de la modificación. */
  registro: string[]
}

/**
 * La asistencia de esa hora. Con `conHorasSeguidas`, "Qué se trabajó" e indicaciones no van acá:
 * van una sola vez en el grupo (y, si esta hora difiere, en sus `textosPropios`). Sin asistencia
 * (agendada o sin registrar dentro del plazo), nada: el estado ya lo dice el badge.
 */
export function vistaAsistenciaHora(
  asistencia: AsistenciaVisible | null,
  plazo: PlazoAsistenciaOcurrencia | null,
  { conHorasSeguidas }: { conHorasSeguidas: boolean },
): VistaAsistenciaHora {
  if (!asistencia) return { cierre: null, textos: [], registro: [] }

  if (asistencia.cerradaPorSistema) {
    return {
      cierre: textoCierreSistema(plazo),
      textos: conTexto([[OBSERVACION, asistencia.observacion]]),
      registro: [],
    }
  }

  const textos =
    asistencia.estado === 'PRESENTE'
      ? conHorasSeguidas
        ? []
        : textosDeTrabajo(asistencia)
      : conTexto([[OBSERVACION, asistencia.observacion]])

  const registro: string[] = []
  if (asistencia.registradaEl) {
    registro.push(
      `Registrada por ${nombreUsuarioAuditoria(asistencia.registradaPor ?? null)}, ${formatoInstante(asistencia.registradaEl)}`,
    )
  }
  if (asistencia.modificadaEl) {
    registro.push(
      `Modificada por ${nombreUsuarioAuditoria(asistencia.modificadaPor ?? null)}, ${formatoInstante(asistencia.modificadaEl)}`,
    )
  }

  return { cierre: null, textos, registro }
}

/** `'8:00 a 10:00 · 2 h'`. */
export function etiquetaHorasSeguidas(
  grupo: Pick<HorasSeguidas, 'horaInicio' | 'horaFin' | 'horas'>,
) {
  return `${rangoHoras(grupo.horaInicio, grupo.horaFin)} · ${grupo.horas} h`
}

/** Una hora del grupo, lista para pintar. */
export type VistaHoraSeguida = {
  turnoId: number
  fecha: string
  /** `'9:00 a 10:00'`. */
  horario: string
  estado: EstadoOcurrencia
  plazo: PlazoAsistenciaOcurrencia | null
  actual: boolean
  /** Sus `textosPropios` y la observación de un ausente, tal como los manda la API. */
  textos: TextoAsistencia[]
}

export type VistaHorasSeguidas = {
  etiqueta: string
  /** Los del grupo, una sola vez. */
  textos: TextoAsistencia[]
  horas: VistaHoraSeguida[]
}

export function vistaHorasSeguidas(grupo: HorasSeguidasVisibles): VistaHorasSeguidas {
  return {
    etiqueta: etiquetaHorasSeguidas(grupo),
    textos: textosDeTrabajo(grupo.textos),
    horas: grupo.ocurrencias.map((hora) => ({
      turnoId: hora.turnoId,
      fecha: hora.fecha,
      horario: rangoHoras(hora.horaInicio, hora.horaFin),
      estado: hora.estado,
      plazo: hora.plazoAsistencia,
      actual: hora.actual,
      textos: [
        ...textosDeTrabajo(hora.textosPropios),
        ...conTexto([[OBSERVACION, hora.observacion]]),
      ],
    })),
  }
}

/**
 * La línea de creación de la trazabilidad cuando el turno lo sacó el alumno desde el portal
 * (HU-29); `undefined` en otro caso, y la trazabilidad dice "Creado por …" como siempre.
 */
export function textoCreacionTurno(
  createdBy: UsuarioAuditoriaConRol | null,
  createdAt: string,
): string | undefined {
  if (createdBy?.rol !== 'ALUMNO') return undefined
  return `Registrado por el alumno desde el portal · ${formatoInstante(createdAt)}`
}
