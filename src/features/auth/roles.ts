import type { Role } from '@/types'

// Única correspondencia rol → segmento de URL (docs/arquitectura-frontend.md → Roles y URLs).
// GERENTE y ALUMNO quedan en null porque /gerente y /portal no se crean en este sprint: mandarlos
// ahí sería un 404. "/" los deja con un aviso en lugar de redirigirlos.
const SEGMENTO_POR_ROL: Record<Role, string | null> = {
  MESA_ENTRADAS: '/mesa',
  PROFESOR: '/profesor',
  GERENTE: null,
  ALUMNO: null,
}

// El rol llega de la sesión tipado como string; que sea uno de Role lo garantiza la API.
export function segmentoDeRol(role: string | null | undefined): string | null {
  if (!role) return null
  return SEGMENTO_POR_ROL[role as Role] ?? null
}
