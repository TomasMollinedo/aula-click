import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import { type MiPerfil, miPerfilKey, obtenerMiPerfil } from '../api/mi-perfil.api'

/**
 * El perfil del alumno de la sesión (`GET /alumnos/mi-perfil`, rol `ALUMNO`): nombre y foto para el
 * menú del portal. `habilitado` en `false` no pide nada (los demás roles no tienen perfil de
 * alumno). La foto es una URL prefirmada de 15 min: se vuelve a pedir a los 10.
 */
export function useMiPerfil({ habilitado }: { habilitado: boolean }) {
  return useQuery<MiPerfil, ApiError>({
    queryKey: miPerfilKey(),
    queryFn: obtenerMiPerfil,
    enabled: habilitado,
    staleTime: 10 * 60 * 1000,
  })
}
