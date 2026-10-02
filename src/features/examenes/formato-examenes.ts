import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'

import type { Role } from '@/types'
import { formatoInstante } from '@/utils/auditoria'

import { TIPOS_EXAMEN } from './examenes.schema'
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
