import { format, parseISO } from 'date-fns'

import type { UsuarioAuditoria } from '@/types'

/**
 * Instante de auditoría (ISO 8601 en UTC) en hora local: `'2026-09-22T13:45:00.000Z'` →
 * `'22/09/2026, 10:45'` en Argentina. `parseISO` respeta la `Z`.
 */
export function formatoInstante(instante: string): string {
  return format(parseISO(instante), 'dd/MM/yyyy, HH:mm')
}

/** Nombre de quien creó o modificó un registro; `'Sistema'` si lo cargó el seed (`null`). */
export function nombreUsuarioAuditoria(usuario: UsuarioAuditoria | null): string {
  return usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Sistema'
}
