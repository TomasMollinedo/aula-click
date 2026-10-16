import type { MotivoCancelacion } from '@/types/ocurrencia'
import { fechaConDia } from '@/utils/formato-fechas'
import { rangoHoras } from '@/utils/horas'

import type { BloqueDelHistorial, GrupoDelHistorial } from './historiales.types'

// Presentación del historial académico: los textos del grupo y del bloque. Sin reglas: el estado,
// el plazo, el porcentaje y qué textos van una sola vez los decide la API (T-108), y los bloques y
// los grupos vienen en el orden en que se muestran.

/**
 * Etiqueta de un motivo de cancelación. Duplica la lista de `features/cancelaciones` (la misma de
 * la API), igual que `features/ocurrencias/motivo-cancelacion.ts`: una feature no importa el
 * `schema` de otra, sólo sus `hooks` (docs/arquitectura-frontend.md → Quién importa a quién).
 */
const ETIQUETA_MOTIVO: Record<MotivoCancelacion, string> = {
  CANCELACION_ALUMNO: 'Cancelación por el alumno',
  CANCELACION_PROFESOR: 'Cancelación por el profesor',
  PROBLEMA_ADMINISTRATIVO: 'Problema administrativo',
  OTRO: 'Otro',
}

export function etiquetaMotivoCancelacion(motivo: MotivoCancelacion): string {
  return ETIQUETA_MOTIVO[motivo]
}

/** Un grupo del historial: `'Matemática — Prof. Pérez'` (HU-31). */
export function tituloGrupo(grupo: Pick<GrupoDelHistorial, 'materia' | 'profesor'>): string {
  return `${grupo.materia.nombre} — Prof. ${grupo.profesor.apellido}`
}

/** El profesor de un filtro, `'Pérez, Ana'`, como en el resto de los selectores. */
export function nombreProfesor(profesor: { nombre: string; apellido: string }): string {
  return `${profesor.apellido}, ${profesor.nombre}`
}

/** `1` → `'1 h'`; `2` → `'2 h'`. La cantidad de clases (de horas) del bloque la manda la API. */
export function textoHoras(horas: number): string {
  return `${horas} h`
}

/** El encabezado de un bloque: `'lunes 13/10 · 8:00 a 10:00 · 2 h'`. */
export function tituloBloque(
  bloque: Pick<BloqueDelHistorial, 'fecha' | 'horaInicio' | 'horaFin' | 'horas'>,
): string {
  return [
    fechaConDia(bloque.fecha),
    rangoHoras(bloque.horaInicio, bloque.horaFin),
    textoHoras(bloque.horas),
  ].join(' · ')
}

/** El período que devolvió la API, para rotular lo que se ve: `'del 01/10 al 31/10'`. */
export function textoPeriodo(desde: string, hasta: string): string {
  return desde === hasta
    ? `del ${fechaConDia(desde)}`
    : `del ${fechaConDia(desde)} al ${fechaConDia(hasta)}`
}
