import type { TipoExamen } from '@/server/features/examenes/examenes.condiciones'
import { etiquetaEstadoConPlazo } from '@/server/features/turnos/ocurrencias.condiciones'
import { fechaConDia, fechaDocumento, rangoHoras } from '@/server/shared/formato'
import type {
  CanceladoDelDocumento,
  FiltrosDelDocumento,
  MotivoDeCancelacion,
  NivelEscolaridad,
} from './historiales.documentos'
import type {
  BloqueDelHistorial,
  ClaseDelHistorial,
  GrupoDelHistorial,
  ResumenDelHistorial,
} from './historiales.validation'

// Los textos del documento PDF del historial académico (T-110). Devuelven lo mismo que los de la
// pantalla (`src/features/historiales/formato-historiales.ts`, `features/examenes/` y
// `features/alumnos/`): el backend no importa código del frontend, así que tiene los suyos.
// Funciones puras.
//
// El estado de una hora y su plazo **no** se escriben acá: los publica `ocurrencias.condiciones`
// (`etiquetaEstado` y `etiquetaEstadoConPlazo`) y hay una sola definición para todos los
// documentos. Las etiquetas de `TipoExamen`, `MotivoCancelacion` y `NivelEscolaridad` sí, porque
// el backend no las tenía.

const PORCENTAJE = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

const ETIQUETA_TIPO_EXAMEN: Record<TipoExamen, string> = {
  PARCIAL: 'Parcial',
  FINAL: 'Final',
  RECUPERATORIO: 'Recuperatorio',
  TRABAJO_PRACTICO: 'Trabajo práctico',
  OTRO: 'Otro',
}

/** `'TRABAJO_PRACTICO'` → `'Trabajo práctico'`. */
export function etiquetaTipoExamen(tipo: TipoExamen): string {
  return ETIQUETA_TIPO_EXAMEN[tipo]
}

const ETIQUETA_MOTIVO: Record<MotivoDeCancelacion, string> = {
  CANCELACION_ALUMNO: 'Cancelación por el alumno',
  CANCELACION_PROFESOR: 'Cancelación por el profesor',
  PROBLEMA_ADMINISTRATIVO: 'Problema administrativo',
  OTRO: 'Otro',
}

/** `'CANCELACION_ALUMNO'` → `'Cancelación por el alumno'`. */
export function etiquetaMotivoCancelacion(motivo: MotivoDeCancelacion): string {
  return ETIQUETA_MOTIVO[motivo]
}

const ETIQUETA_NIVEL: Record<NivelEscolaridad, string> = {
  INICIAL: 'Inicial',
  PRIMARIO: 'Primario',
  SECUNDARIO: 'Secundario',
  TERCIARIO: 'Terciario',
  UNIVERSITARIO: 'Universitario',
}

/** `'SECUNDARIO'` → `'Secundario'`; sin nivel cargado, `null` (el campo muestra `—`). */
export function etiquetaNivelEscolaridad(nivel: NivelEscolaridad | null): string | null {
  return nivel === null ? null : ETIQUETA_NIVEL[nivel]
}

/** `{ apellido: 'Pérez', nombre: 'Ana' }` → `'Pérez, Ana'`, como en los selectores y los filtros. */
export function nombreProfesor({ apellido, nombre }: { apellido: string; nombre: string }): string {
  return `${apellido}, ${nombre}`
}

/** El mes del documento con sus bordes: `'01/10/2026 al 31/10/2026'`. */
export function textoMesDelHistorial(desde: string, hasta: string): string {
  return desde === hasta
    ? fechaDocumento(desde)
    : `${fechaDocumento(desde)} al ${fechaDocumento(hasta)}`
}

/**
 * Los filtros aplicados: `'Materia: Álgebra · Profesor: Pérez, Ana'`, o `null` si no se filtró.
 * Un id que no está en el historial del alumno se escribe como id (`'Materia: #99'`).
 */
export function textoFiltrosDelHistorial(filtros: FiltrosDelDocumento): string | null {
  const partes = [
    filtros.materiaId === null ? null : `Materia: ${filtros.materia ?? `#${filtros.materiaId}`}`,
    filtros.profesorId === null
      ? null
      : `Profesor: ${filtros.profesor ? nombreProfesor(filtros.profesor) : `#${filtros.profesorId}`}`,
  ].filter((parte) => parte !== null)
  return partes.length === 0 ? null : partes.join(' · ')
}

/** Un grupo del historial: `'Matemática — Prof. Pérez'` (HU-31). */
export function tituloGrupo(grupo: Pick<GrupoDelHistorial, 'materia' | 'profesor'>): string {
  return `${grupo.materia.nombre} — Prof. ${grupo.profesor.apellido}`
}

/** El porcentaje que manda la API (0 a 100, un decimal): `33.3` → `'33,3 %'`. */
export function textoPorcentaje(porcentaje: number): string {
  return `${PORCENTAJE.format(porcentaje)} %`
}

/** El resumen de un grupo: `'3 realizadas · 1 ausencia · 75 %'`. */
export function textoResumen(resumen: ResumenDelHistorial): string {
  const ausencias = resumen.ausencias === 1 ? '1 ausencia' : `${resumen.ausencias} ausencias`
  return `${resumen.realizadas} realizadas · ${ausencias} · ${textoPorcentaje(resumen.porcentaje)}`
}

/** `1` → `'1 h'`. La cantidad de horas del bloque la manda la API. */
export function textoHoras(horas: number): string {
  return `${horas} h`
}

/** El horario de un bloque con cuántas horas tiene: `'8:00 a 10:00 · 2 h'`. */
export function horarioDelBloque(
  bloque: Pick<BloqueDelHistorial, 'horaInicio' | 'horaFin' | 'horas'>,
): string {
  return `${rangoHoras(bloque.horaInicio, bloque.horaFin)} · ${textoHoras(bloque.horas)}`
}

/** La fecha de un bloque con su día: `'lunes 13/10'`. */
export function fechaDelBloque(bloque: Pick<BloqueDelHistorial, 'fecha'>): string {
  return fechaConDia(bloque.fecha)
}

/**
 * El estado de **una hora** del bloque: `'8:00 a 9:00 · Realizado'` y, en un "Sin registrar", con
 * su plazo o su cierre del sistema (`etiquetaEstadoConPlazo`). Sin la observación de la ausencia:
 * es interna y el documento no la lleva (HU-32).
 */
export function textoEstadoDeLaHora(
  clase: Pick<ClaseDelHistorial, 'horaInicio' | 'horaFin' | 'estado' | 'plazoAsistencia'>,
): string {
  const estado = etiquetaEstadoConPlazo(clase.estado, clase.plazoAsistencia)
  return `${rangoHoras(clase.horaInicio, clase.horaFin)} · ${estado}`
}

/**
 * "Qué se trabajó" e "Indicaciones" de un bloque, **una sola vez**, y debajo los de la hora que
 * tenga otros (`textosPropios`), con su horario adelante. Vacío si el bloque no tiene ninguno: la
 * celda queda en `—`.
 */
export function textosDelBloque(bloque: BloqueDelHistorial): string[] {
  const textos = (
    valores: { trabajado: string | null; indicaciones: string | null },
    prefijo = '',
  ): string[] =>
    [
      valores.trabajado ? `${prefijo}Qué se trabajó: ${valores.trabajado}` : null,
      valores.indicaciones ? `${prefijo}Indicaciones: ${valores.indicaciones}` : null,
    ].filter((texto) => texto !== null)

  return [
    ...(bloque.textos ? textos(bloque.textos) : []),
    ...bloque.clases.flatMap((clase) =>
      clase.textosPropios
        ? textos(clase.textosPropios, `${rangoHoras(clase.horaInicio, clase.horaFin)} — `)
        : [],
    ),
  ]
}

/** El motivo de una hora cancelada, con su detalle si lo tiene. */
export function textoMotivoDeCancelado(
  cancelado: Pick<CanceladoDelDocumento, 'motivo' | 'detalle'>,
): string {
  const motivo = etiquetaMotivoCancelacion(cancelado.motivo)
  return cancelado.detalle ? `${motivo} — ${cancelado.detalle}` : motivo
}

/** La nota de un examen: `'7,5'`, `'Ausente'` o `'Sin nota'` (igual que la pestaña "Exámenes"). */
export function textoNotaDelExamen(examen: {
  resultado: 'CON_NOTA' | 'AUSENTE' | null
  nota: number | null
}): string {
  if (examen.resultado === 'AUSENTE') return 'Ausente'
  if (examen.resultado === 'CON_NOTA' && examen.nota !== null) {
    return String(examen.nota).replace('.', ',')
  }
  return 'Sin nota'
}
