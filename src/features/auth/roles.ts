import type { Role } from '@/types'

// Única correspondencia rol → segmento de URL (docs/arquitectura-frontend.md → Roles y URLs).
// ALUMNO queda en null porque /portal no se crea en este sprint: mandarlo ahí sería un 404.
// "/" lo deja con un aviso en lugar de redirigirlo.
const SEGMENTO_POR_ROL: Record<Role, string | null> = {
  MESA_ENTRADAS: '/mesa',
  PROFESOR: '/profesor',
  GERENTE: '/gerente',
  ALUMNO: null,
}

// El rol llega de la sesión tipado como string; que sea uno de Role lo garantiza la API.
export function segmentoDeRol(role: string | null | undefined): string | null {
  if (!role) return null
  return SEGMENTO_POR_ROL[role as Role] ?? null
}

const LABEL_POR_ROL: Record<Role, string> = {
  MESA_ENTRADAS: 'Mesa de Entradas',
  PROFESOR: 'Profesor',
  GERENTE: 'Gerente',
  ALUMNO: 'Alumno',
}

// Texto legible del rol para la UI (por ejemplo, debajo del nombre en UserMenu).
export function rolLabel(role: string | null | undefined): string {
  if (!role) return ''
  return LABEL_POR_ROL[role as Role] ?? role
}
