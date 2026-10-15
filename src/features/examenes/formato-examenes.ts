import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'

import type { Role } from '@/types'
import { formatoInstante } from '@/utils/auditoria'

import { TIPOS_EXAMEN, notaConComa } from './examenes.schema'
import type { ExamenItem, ExamenUsuarioAuditoria, TipoExamen } from './examenes.types'

// Textos de la pestaña "Exámenes". No calculan nada del negocio: los días que faltan los manda la
// API (`diasRestantes`).

const ROLES: Record<Role, string> = {
  MESA_ENTRADAS: 'Mesa de entradas',
  PROFESOR: 'Profesor',
  GERENTE: 'Gerente',
  ALUMNO: 'Alumno',
}

/** `'TRABAJO_PRACTICO'` → `'Trabajo práctico'`. */
export function etiquetaTipo(tipo: TipoExamen): string {
  return TIPOS_EXAMEN.find((t) => t.valor === tipo)?.etiqueta ?? tipo
}

/** `'2026-10-15'` → `'jueves 15/10/2026'`. */
export function fechaExamen(fecha: string): string {
  return format(parseISO(fecha), 'EEEE dd/MM/yyyy', { locale: es })
}

/** Los `diasRestantes` de la API en palabras: 0 → "hoy", 1 → "mañana", 5 → "en 5 días". */
export function textoDiasRestantes(dias: number): string {
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'mañana'
  return `en ${dias} días`
}

/** "Luis Gómez (Profesor)"; lo que cargó el seed (`null`), "Sistema". */
function usuarioConRol(usuario: ExamenUsuarioAuditoria | null): string {
  if (!usuario) return 'Sistema'
  return `${usuario.nombre} ${usuario.apellido} (${ROLES[usuario.role] ?? usuario.role})`
}

/** "Cargado por Luis Gómez (Profesor) el 22/09/2026, 10:45". */
export function textoCargadoPor(examen: Pick<ExamenItem, 'createdBy' | 'createdAt'>): string {
  return `Cargado por ${usuarioConRol(examen.createdBy)} el ${formatoInstante(examen.createdAt)}`
}

/** "Última modificación por … (Mesa de entradas) el …", o `null` si nunca se modificó. */
export function textoModificadoPor(
  examen: Pick<ExamenItem, 'createdAt' | 'updatedAt' | 'updatedBy'>,
): string | null {
  if (examen.updatedAt === examen.createdAt) return null
  return `Última modificación por ${usuarioConRol(examen.updatedBy)} el ${formatoInstante(examen.updatedAt)}`
}

/**
 * La fecha elegida ya pasó, según el "hoy" del navegador (`hoy`, `YYYY-MM-DD`). Es solo el aviso
 * del formulario: qué es "hoy" para las reglas lo decide la API, que acepta la fecha igual.
 */
export function esFechaPasada(fecha: string, hoy: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha < hoy
}

/** "Parcial del jueves 15/10/2026", para el examen existente de un 409 y la confirmación. */
export function resumenExamen(examen: { tipo: TipoExamen; fecha: string }): string {
  return `${etiquetaTipo(examen.tipo)} del ${fechaExamen(examen.fecha)}`
}

// ---------- Nota (HU-34) ----------

/** La nota en la lista: `'7,5'`, `'Ausente'` o `'Sin nota'`. */
export function textoNota(examen: Pick<ExamenItem, 'resultado' | 'nota'>): string {
  if (examen.resultado === 'AUSENTE') return 'Ausente'
  if (examen.resultado === 'CON_NOTA' && examen.nota !== null) return notaConComa(examen.nota)
  return 'Sin nota'
}

/** "Nota cargada por Luis Gómez (Profesor) el 02/10/2026, 11:00", o `null` si no tiene nota. */
export function textoNotaCargadaPor(
  examen: Pick<ExamenItem, 'notaCreatedBy' | 'notaCreatedAt'>,
): string | null {
  if (!examen.notaCreatedAt) return null
  return `Nota cargada por ${usuarioConRol(examen.notaCreatedBy)} el ${formatoInstante(examen.notaCreatedAt)}`
}

/** "Nota modificada por … (Mesa de entradas) el …", o `null` si nunca se corrigió. */
export function textoNotaModificadaPor(
  examen: Pick<ExamenItem, 'notaCreatedAt' | 'notaUpdatedAt' | 'notaUpdatedBy'>,
): string | null {
  if (!examen.notaUpdatedAt || examen.notaUpdatedAt === examen.notaCreatedAt) return null
  return `Nota modificada por ${usuarioConRol(examen.notaUpdatedBy)} el ${formatoInstante(examen.notaUpdatedAt)}`
}

/** El aviso de la pestaña: "2 exámenes rendidos sin nota", o `null` si no hay. */
export function textoRendidosSinNota(cantidad: number): string | null {
  if (cantidad <= 0) return null
  return cantidad === 1 ? '1 examen rendido sin nota' : `${cantidad} exámenes rendidos sin nota`
}

/**
 * Tramos de la nota para el color del badge (propuesta, **pendiente de confirmar con las PO**: ni
 * HU-34 ni `dominio.md` definen desde qué nota se aprueba). Sólo cambia el color: el badge sigue
 * diciendo la nota, nunca "Aprobado" o "Desaprobado". Si las PO definen otra escala, se cambia acá.
 */
export const TRAMOS_NOTA = { alta: 7, media: 4 } as const

export type TramoNota = 'alta' | 'media' | 'baja'

/** `7` a `10` → `'alta'`; `4` a `6,99` → `'media'`; menos de `4` → `'baja'`. */
export function tramoNota(nota: number): TramoNota {
  if (nota >= TRAMOS_NOTA.alta) return 'alta'
  if (nota >= TRAMOS_NOTA.media) return 'media'
  return 'baja'
}
