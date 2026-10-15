import { useQuery } from '@tanstack/react-query'

import { useDebounce } from '@/hooks/use-debounce'
import type { ApiError } from '@/utils/fetch-json'

import { datosParaSugerir } from '../acceso-portal'
import {
  type DatosUsuarioSugerido,
  obtenerUsuarioSugerido,
  usuarioSugeridoKey,
} from '../api/acceso.api'

/**
 * El usuario del portal que se le asignaría al alumno del alta (`GET /alumnos/usuario-sugerido`),
 * con debounce mientras se escribe. No pide nada hasta que están nombre, apellido y un DNI válido.
 * Mientras llega el nuevo, conserva el anterior (`placeholderData`).
 */
export function useAccesoUsuarioSugerido(datos: DatosUsuarioSugerido) {
  const debounced = useDebounce(datos, 400)
  const pedido = datosParaSugerir(debounced)

  return useQuery<{ usuario: string }, ApiError>({
    queryKey: usuarioSugeridoKey(pedido ?? { nombre: '', apellido: '', dni: '' }),
    queryFn: () => obtenerUsuarioSugerido(pedido as DatosUsuarioSugerido),
    enabled: pedido !== null,
    placeholderData: (anterior) => anterior,
  })
}
