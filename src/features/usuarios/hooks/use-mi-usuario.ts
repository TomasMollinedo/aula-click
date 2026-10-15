import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { obtenerMiUsuario } from '../api/usuarios.api'
import { usuariosKeys } from '../api/usuarios.keys'
import type { MiUsuario } from '../usuarios.types'

/**
 * El usuario de la sesión (`GET /usuarios/mi-usuario`). Se vuelve a pedir al volver a la pestaña,
 * así un restablecimiento de la mesa de entrada hace aparecer otra vez el aviso.
 */
export function useMiUsuario() {
  return useQuery<MiUsuario, ApiError>({
    queryKey: usuariosKeys.miUsuario(),
    queryFn: obtenerMiUsuario,
  })
}
