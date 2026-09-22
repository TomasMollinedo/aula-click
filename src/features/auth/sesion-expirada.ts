// Motivos con los que app/providers.tsx manda a /login y que lee AvisoSesionExpirada. Es el único
// lugar que conoce estos nombres (docs/arquitectura-frontend.md → Manejo de errores en la UI).
export const MOTIVO_SESION_EXPIRADA = 'sesion_expirada'
export const MOTIVO_USUARIO_INHABILITADO = 'usuario_inhabilitado'

export type MotivoDeSalida = typeof MOTIVO_SESION_EXPIRADA | typeof MOTIVO_USUARIO_INHABILITADO

const AVISO_POR_MOTIVO: Record<MotivoDeSalida, string> = {
  [MOTIVO_SESION_EXPIRADA]: 'Tu sesión expiró. Volvé a iniciar sesión.',
  [MOTIVO_USUARIO_INHABILITADO]: 'Su usuario no está habilitado',
}

// El motivo llega de la URL, así que puede ser cualquier cosa: solo se muestran los conocidos.
export function avisoDeMotivo(motivo: string | null | undefined): string | null {
  if (!motivo) return null
  return AVISO_POR_MOTIVO[motivo as MotivoDeSalida] ?? null
}

export function urlDeLoginConMotivo(motivo: MotivoDeSalida): string {
  return `/login?motivo=${motivo}`
}
