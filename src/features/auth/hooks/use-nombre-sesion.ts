import { authClient } from '../auth-client'

/**
 * Nombre y apellido del usuario de la sesión (`'Laura Gómez'`), o `null` mientras no hay sesión.
 * Es el "Emitido por" de los documentos imprimibles: quien imprime, no quien cargó el dato.
 */
export function useNombreSesion(): string | null {
  const { data: session } = authClient.useSession()
  if (!session) return null
  return [session.user.name, session.user.apellido].filter(Boolean).join(' ')
}
