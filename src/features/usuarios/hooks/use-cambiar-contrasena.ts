import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { cambiarContrasena } from '../api/usuarios.api'
import { usuariosKeys } from '../api/usuarios.keys'
import type { CambiarContrasenaBody, MiUsuario } from '../usuarios.types'

/**
 * Cambia la contraseña. La respuesta es mi usuario con `contrasenaInicial: false`: se deja en la
 * cache y se invalida, así el aviso de la contraseña inicial se va enseguida.
 */
export function useCambiarContrasena() {
  const queryClient = useQueryClient()

  return useMutation<MiUsuario, ApiError, CambiarContrasenaBody>({
    mutationFn: cambiarContrasena,
    onSuccess: (miUsuario) => {
      queryClient.setQueryData(usuariosKeys.miUsuario(), miUsuario)
      void queryClient.invalidateQueries({ queryKey: usuariosKeys.miUsuario() })
    },
  })
}
