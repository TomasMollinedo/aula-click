import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { AlumnoDetalle } from '../alumnos.types'
import { crearAcceso, restablecerContrasena } from '../api/acceso.api'
import { alumnosKeys } from '../api/alumnos.keys'

/**
 * Crear el acceso al portal y restablecer la contraseña (HU-27). Las dos devuelven el detalle del
 * alumno: se deja en la cache y se invalida el detalle. Un 409 (ya tenía acceso, o no lo tenía)
 * dice que la ficha tenía datos viejos: también se vuelve a pedir.
 */
function useMutacionAcceso(alumnoId: number, mutationFn: (id: number) => Promise<AlumnoDetalle>) {
  const queryClient = useQueryClient()
  const invalidarDetalle = () =>
    queryClient.invalidateQueries({ queryKey: alumnosKeys.detail(alumnoId) })

  return useMutation<AlumnoDetalle, ApiError, void>({
    mutationFn: () => mutationFn(alumnoId),
    onSuccess: (alumno) => {
      queryClient.setQueryData(alumnosKeys.detail(alumnoId), alumno)
      void invalidarDetalle()
    },
    onError: (error) => {
      if (error.status === 409) void invalidarDetalle()
    },
  })
}

/** `POST /alumnos/{id}/acceso`. */
export function useAccesoCrear(alumnoId: number) {
  return useMutacionAcceso(alumnoId, crearAcceso)
}

/** `POST /alumnos/{id}/acceso/restablecimiento`. */
export function useAccesoRestablecer(alumnoId: number) {
  return useMutacionAcceso(alumnoId, restablecerContrasena)
}
