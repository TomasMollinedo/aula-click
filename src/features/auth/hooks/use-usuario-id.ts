'use client'

import { authClient } from '../auth-client'

/**
 * Id del usuario de la sesión, o `null` mientras carga o si no hay sesión. Para las features que
 * necesitan recordar algo por usuario (por ejemplo, la última vista de la agenda) sin depender del
 * `authClient`: de otra feature solo se usan sus hooks.
 */
export function useUsuarioId(): string | null {
  const { data: session } = authClient.useSession()
  return session?.user.id ?? null
}
