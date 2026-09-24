import { useQuery } from '@tanstack/react-query'

import type { ApiError } from '@/utils/fetch-json'

import type { BloqueDetalle } from '../profesores.types'
import { obtenerBloque } from '../api/profesores.api'
import { profesoresKeys } from '../api/profesores.keys'

/** Detalle de una hora del horario, con su auditoría (modal de detalle de la sección Horario). */
export function useBloque(bloqueId: number) {
  return useQuery<BloqueDetalle, ApiError>({
    queryKey: profesoresKeys.bloque(bloqueId),
    queryFn: () => obtenerBloque(bloqueId),
    enabled: bloqueId > 0,
  })
}
